"""GMX V2 GM pool liquidity (Arbitrum One) — the one *Pro, user-signed* strategy.

Unlike Aave and the Uniswap stable LP (gasless, USDC-only, session-key, funds
pinned on-chain), GMX V2 has hard requirements that don't fit the hands-off model:

  * A **native ETH execution fee** must be sent to a keeper (`sendWnt`). Our
    gasless accounts hold only USDC, so this can't be paid by the session.
  * Deposits/withdrawals are **asynchronous** — your transaction only *creates*
    the request; a keeper executes it a few seconds later. So we verify the
    create tx and record a *pending* position, then reconcile from the GM balance.
  * `createDeposit` takes a **dynamic struct**, so a session CallPolicy can't pin
    the receiver at a fixed calldata offset.

Because of that, GMX is exposed as an explicit, **user-signed** action (the user
signs their own tx in their wallet, so the receiver is always themselves — no
agent key is ever trusted with it). It is gated behind the Aggressive tier +
one-time market-risk consent, and it carries real market risk (GM LPs are the
counterparty to leveraged traders).

Addresses/struct verified against:
  * GMX contract source: contracts/deposit/IDepositUtils.sol,
    contracts/withdrawal/IWithdrawalUtils.sol (nested addresses + dataList).
  * GMX docs (ExchangeRouter) + Arbiscan (market token, vaults, router).
"""

from __future__ import annotations

from typing import Any

from eth_abi import encode
from eth_utils import function_signature_to_4byte_selector, to_checksum_address
from web3 import Web3

from chain_config import ARBITRUM_ONE_CHAIN_ID
from config import get_settings

# --- Arbitrum One canonical addresses (GMX V2.1+). --------------------------
EXCHANGE_ROUTER = "0x69C527fC77291722b52649E45c838e41be8Bf5d5"  # writes: orders/deposits/withdrawals
GMX_ROUTER = "0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6"  # ERC20 approval target (not ExchangeRouter)
DEPOSIT_VAULT = "0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55"
WITHDRAWAL_VAULT = "0x0628D46b5D145f183AdB6Ef1f2c97eD1C4701c55"
# GM: ETH/USD [WETH-USDC] — the deepest, most liquid GM market.
GM_ETH_USD_MARKET = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336"
WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"  # market long token
USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"  # market short token

USDC_DECIMALS = 6
GM_DECIMALS = 18
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

# Execution-fee sizing. Underpaying reverts the whole create tx (funds never
# move — safe, just retryable); overpaying is refunded by GMX after execution.
# We size generously off live gas price with a floor/cap so it "just works".
_DEPOSIT_GAS_UNITS = 3_000_000
_MIN_EXECUTION_FEE_WEI = 300_000_000_000_000  # 0.0003 ETH floor
_MAX_EXECUTION_FEE_WEI = 3_000_000_000_000_000  # 0.003 ETH cap

# Solidity signatures (nested tuples flattened, matching the GMX source structs).
SEND_WNT_SIG = "sendWnt(address,uint256)"
SEND_TOKENS_SIG = "sendTokens(address,address,uint256)"
MULTICALL_SIG = "multicall(bytes[])"
CREATE_DEPOSIT_SIG = (
    "createDeposit("
    "((address,address,address,address,address,address,address[],address[]),"
    "uint256,bool,uint256,uint256,bytes32[]))"
)
CREATE_WITHDRAWAL_SIG = (
    "createWithdrawal("
    "((address,address,address,address,address[],address[]),"
    "uint256,uint256,bool,uint256,uint256,bytes32[]))"
)
APPROVE_SIG = "approve(address,uint256)"

# eth_abi type strings for the single struct argument of each create* call.
_DEPOSIT_PARAMS_TYPE = (
    "((address,address,address,address,address,address,address[],address[]),"
    "uint256,bool,uint256,uint256,bytes32[])"
)
_WITHDRAWAL_PARAMS_TYPE = (
    "((address,address,address,address,address[],address[]),"
    "uint256,uint256,bool,uint256,uint256,bytes32[])"
)

CREATE_DEPOSIT_SELECTOR = "0x" + function_signature_to_4byte_selector(CREATE_DEPOSIT_SIG).hex()
CREATE_WITHDRAWAL_SELECTOR = "0x" + function_signature_to_4byte_selector(CREATE_WITHDRAWAL_SIG).hex()
MULTICALL_SELECTOR = "0x" + function_signature_to_4byte_selector(MULTICALL_SIG).hex()

_ERC20_ABI = [
    {
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]


def _encode_call(signature: str, types: list[str], args: list[Any]) -> bytes:
    return function_signature_to_4byte_selector(signature) + encode(types, args)


def _hex(data: bytes) -> str:
    return "0x" + data.hex()


def _w3() -> Web3:
    return Web3(Web3.HTTPProvider(get_settings().arbitrum_rpc))


def _chain_id() -> int:
    return int(get_settings().arbitrum_chain_id)


def _require_arbitrum_one() -> None:
    if _chain_id() != ARBITRUM_ONE_CHAIN_ID:
        raise ValueError("GMX GM pools are only available on Arbitrum One (42161).")


def usdc_to_raw(amount_usdc: float) -> int:
    return int(round(amount_usdc * (10**USDC_DECIMALS)))


def estimate_execution_fee_wei() -> int:
    """Size the keeper execution fee off live gas price, clamped to a safe band."""
    try:
        gas_price = int(_w3().eth.gas_price)
    except Exception:
        gas_price = 100_000_000  # 0.1 gwei fallback (typical Arbitrum)
    fee = gas_price * _DEPOSIT_GAS_UNITS
    return max(_MIN_EXECUTION_FEE_WEI, min(fee, _MAX_EXECUTION_FEE_WEI))


def get_gm_balance(owner: str, market: str = GM_ETH_USD_MARKET) -> int:
    """Raw GM token balance (18 decimals) held by the owner for a market."""
    w3 = _w3()
    token = w3.eth.contract(address=to_checksum_address(market), abi=_ERC20_ABI)
    return int(token.functions.balanceOf(to_checksum_address(owner)).call())


def _multicall_tx(inner_calls: list[bytes], value_wei: int) -> dict[str, Any]:
    data = _encode_call(MULTICALL_SIG, ["bytes[]"], [inner_calls])
    return {
        "purpose": "gmx_multicall",
        "to": to_checksum_address(EXCHANGE_ROUTER),
        "data": _hex(data),
        "value": hex(value_wei),
        "chain_id": ARBITRUM_ONE_CHAIN_ID,
    }


def _approve_tx(token: str, spender: str, amount_raw: int, purpose: str) -> dict[str, Any]:
    return {
        "purpose": purpose,
        "to": to_checksum_address(token),
        "data": _hex(
            _encode_call(APPROVE_SIG, ["address", "uint256"], [to_checksum_address(spender), amount_raw])
        ),
        "value": "0x0",
        "chain_id": ARBITRUM_ONE_CHAIN_ID,
    }


def build_gm_deposit_txs(
    *,
    owner: str,
    usdc_amount: float,
    execution_fee_wei: int | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """
    Build user-signed txs to add USDC liquidity to the GM ETH/USD pool.

    Returns (txs, execution_fee_wei). `txs` = [approve USDC->Router, multicall].
    The multicall sends the ETH execution fee + USDC to the DepositVault and
    creates the deposit with `receiver` = owner (GM tokens minted to the user).
    """
    _require_arbitrum_one()
    owner_cs = to_checksum_address(owner)
    usdc_raw = usdc_to_raw(usdc_amount)
    if usdc_raw <= 0:
        raise ValueError("Deposit amount must be greater than zero.")
    fee = int(execution_fee_wei) if execution_fee_wei else estimate_execution_fee_wei()

    send_wnt = _encode_call(
        SEND_WNT_SIG, ["address", "uint256"], [to_checksum_address(DEPOSIT_VAULT), fee]
    )
    send_tokens = _encode_call(
        SEND_TOKENS_SIG,
        ["address", "address", "uint256"],
        [to_checksum_address(USDC_ARBITRUM), to_checksum_address(DEPOSIT_VAULT), usdc_raw],
    )
    deposit_params = (
        (
            owner_cs,  # receiver
            ZERO_ADDRESS,  # callbackContract
            ZERO_ADDRESS,  # uiFeeReceiver
            to_checksum_address(GM_ETH_USD_MARKET),  # market
            to_checksum_address(WETH_ARBITRUM),  # initialLongToken
            to_checksum_address(USDC_ARBITRUM),  # initialShortToken
            [],  # longTokenSwapPath
            [],  # shortTokenSwapPath
        ),
        0,  # minMarketTokens (keeper prices; 0 = accept market)
        False,  # shouldUnwrapNativeToken
        fee,  # executionFee
        0,  # callbackGasLimit
        [],  # dataList
    )
    create_deposit = _encode_call(CREATE_DEPOSIT_SIG, [_DEPOSIT_PARAMS_TYPE], [deposit_params])

    txs = [
        _approve_tx(USDC_ARBITRUM, GMX_ROUTER, usdc_raw, "approve_usdc_gmx_router"),
        _multicall_tx([send_wnt, send_tokens, create_deposit], fee),
    ]
    return txs, fee


def build_gm_withdraw_txs(
    *,
    owner: str,
    gm_amount_raw: int,
    execution_fee_wei: int | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """
    Build user-signed txs to redeem GM ETH/USD tokens back to the owner.

    Returns (txs, execution_fee_wei). `txs` = [approve GM->Router, multicall].
    The multicall sends the ETH execution fee + GM tokens to the WithdrawalVault
    and creates the withdrawal with `receiver` = owner. shouldUnwrapNativeToken
    returns the WETH leg as native ETH; the USDC leg is returned as USDC.
    """
    _require_arbitrum_one()
    owner_cs = to_checksum_address(owner)
    if gm_amount_raw <= 0:
        raise ValueError("A positive GM token amount is required to withdraw.")
    fee = int(execution_fee_wei) if execution_fee_wei else estimate_execution_fee_wei()

    send_wnt = _encode_call(
        SEND_WNT_SIG, ["address", "uint256"], [to_checksum_address(WITHDRAWAL_VAULT), fee]
    )
    send_tokens = _encode_call(
        SEND_TOKENS_SIG,
        ["address", "address", "uint256"],
        [to_checksum_address(GM_ETH_USD_MARKET), to_checksum_address(WITHDRAWAL_VAULT), gm_amount_raw],
    )
    withdrawal_params = (
        (
            owner_cs,  # receiver
            ZERO_ADDRESS,  # callbackContract
            ZERO_ADDRESS,  # uiFeeReceiver
            to_checksum_address(GM_ETH_USD_MARKET),  # market
            [],  # longTokenSwapPath
            [],  # shortTokenSwapPath
        ),
        0,  # minLongTokenAmount
        0,  # minShortTokenAmount
        True,  # shouldUnwrapNativeToken (WETH -> ETH)
        fee,  # executionFee
        0,  # callbackGasLimit
        [],  # dataList
    )
    create_withdrawal = _encode_call(
        CREATE_WITHDRAWAL_SIG, [_WITHDRAWAL_PARAMS_TYPE], [withdrawal_params]
    )

    txs = [
        _approve_tx(GM_ETH_USD_MARKET, GMX_ROUTER, gm_amount_raw, "approve_gm_gmx_router"),
        _multicall_tx([send_wnt, send_tokens, create_withdrawal], fee),
    ]
    return txs, fee
