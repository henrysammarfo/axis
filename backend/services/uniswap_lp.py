"""Uniswap V3 USDC/USDT stable-pair LP calldata (Arbitrum One).

This is the one *market-risk* strategy (gated behind Aggressive tier + explicit
one-time consent). It is intentionally conservative:

  * Only the USDC/USDT 0.01% pool (both legs are stablecoins → minimal IL).
  * Full-range positions (no active tick management, no out-of-range risk).
  * The LP NFT `recipient` is ALWAYS the owner, and withdrawals `collect` to the
    owner. Those recipients are pinned on-chain by the session CallPolicy, so a
    leaked agent key can never route funds anywhere but back to the user.

The calldata offsets below (RECIPIENT/TOKEN/FEE) MUST stay in sync with the
manual CallPolicy rules in `src/lib/kernel-session.ts`. `tests/test_uniswap_lp.py`
locks them by encoding real calldata and asserting the pinned words.
"""

from __future__ import annotations

from typing import Any

from eth_abi import encode
from eth_utils import function_signature_to_4byte_selector, to_checksum_address
from web3 import Web3

from chain_config import ARBITRUM_ONE_CHAIN_ID
from config import get_settings

# Arbitrum One (public, canonical addresses).
USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
USDT_ARBITRUM = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"
UNISWAP_SWAP_ROUTER = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"  # SwapRouter02
UNISWAP_V3_NPM = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"  # NonfungiblePositionManager

LP_FEE = 100  # 0.01% stable pool
LP_TICK_SPACING = 1
# Full range for tickSpacing 1 (already multiples of the spacing).
FULL_RANGE_MIN_TICK = -887272
FULL_RANGE_MAX_TICK = 887272

USDC_DECIMALS = 6
USDT_DECIMALS = 6
MAX_UINT128 = (1 << 128) - 1

# token0/token1 are ordered by address; USDC (0xaf88…) < USDT (0xFd08…).
TOKEN0 = to_checksum_address(USDC_ARBITRUM)
TOKEN1 = to_checksum_address(USDT_ARBITRUM)

# --- Calldata offsets of the pinned words, measured from the start of the
# argument region (i.e. *after* the 4-byte selector). Static tuples are encoded
# inline, so field N sits at offset N*32. These are asserted by the test suite
# and mirrored by the frontend CallPolicy manual rules.
WORD = 32
MINT_TOKEN0_OFFSET = 0 * WORD
MINT_TOKEN1_OFFSET = 1 * WORD
MINT_FEE_OFFSET = 2 * WORD
MINT_RECIPIENT_OFFSET = 9 * WORD  # 288
SWAP_TOKENIN_OFFSET = 0 * WORD
SWAP_TOKENOUT_OFFSET = 1 * WORD
SWAP_FEE_OFFSET = 2 * WORD
SWAP_RECIPIENT_OFFSET = 3 * WORD  # 96
COLLECT_RECIPIENT_OFFSET = 1 * WORD  # 32

# Function signatures (SwapRouter02 has no deadline; NPM structs do).
SWAP_SIG = "exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))"
MINT_SIG = (
    "mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))"
)
DECREASE_SIG = "decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))"
COLLECT_SIG = "collect((uint256,address,uint128,uint128))"
BURN_SIG = "burn(uint256)"
APPROVE_SIG = "approve(address,uint256)"

SWAP_SELECTOR = "0x" + function_signature_to_4byte_selector(SWAP_SIG).hex()
MINT_SELECTOR = "0x" + function_signature_to_4byte_selector(MINT_SIG).hex()
DECREASE_SELECTOR = "0x" + function_signature_to_4byte_selector(DECREASE_SIG).hex()
COLLECT_SELECTOR = "0x" + function_signature_to_4byte_selector(COLLECT_SIG).hex()
BURN_SELECTOR = "0x" + function_signature_to_4byte_selector(BURN_SIG).hex()


def _encode_call(signature: str, types: list[str], args: list[Any]) -> str:
    selector = function_signature_to_4byte_selector(signature)
    return "0x" + (selector + encode(types, args)).hex()


def usdc_to_raw(amount_usdc: float) -> int:
    return int(round(amount_usdc * (10**USDC_DECIMALS)))


def _chain_id() -> int:
    return int(get_settings().arbitrum_chain_id)


def _require_arbitrum_one() -> None:
    if _chain_id() != ARBITRUM_ONE_CHAIN_ID:
        raise ValueError(
            "Uniswap V3 LP is only available on Arbitrum One (42161)."
        )


def _approve(token: str, spender: str, amount_raw: int, purpose: str, cid: int) -> dict[str, Any]:
    return {
        "purpose": purpose,
        "to": to_checksum_address(token),
        "data": _encode_call(
            APPROVE_SIG, ["address", "uint256"], [to_checksum_address(spender), amount_raw]
        ),
        "value": "0x0",
        "chain_id": cid,
    }


def build_lp_enter_calls(
    *,
    owner: str,
    usdc_amount: float,
    deadline: int,
    slippage_bps: int = 50,
) -> list[dict[str, Any]]:
    """
    Build policy-safe calls to enter the USDC/USDT full-range LP with `usdc_amount`.

    Splits USDC in half, swaps one half to USDT, then mints a full-range position
    to the owner. `recipient` is the owner on both the swap and the mint.
    """
    _require_arbitrum_one()
    owner_cs = to_checksum_address(owner)
    cid = ARBITRUM_ONE_CHAIN_ID

    total_raw = usdc_to_raw(usdc_amount)
    if total_raw <= 0:
        return []

    swap_in = total_raw // 2
    keep_usdc = total_raw - swap_in
    min_usdt_out = swap_in * (10_000 - slippage_bps) // 10_000
    if swap_in <= 0 or min_usdt_out <= 0:
        raise ValueError("LP amount too small to split into a USDC/USDT position.")

    calls: list[dict[str, Any]] = []

    # 1) Approve + swap half USDC -> USDT (recipient pinned = owner).
    calls.append(_approve(USDC_ARBITRUM, UNISWAP_SWAP_ROUTER, swap_in, "approve_usdc_router", cid))
    calls.append(
        {
            "purpose": "swap_usdc_usdt_lp",
            "to": to_checksum_address(UNISWAP_SWAP_ROUTER),
            "data": _encode_call(
                SWAP_SIG,
                ["(address,address,uint24,address,uint256,uint256,uint160)"],
                [(TOKEN0, TOKEN1, LP_FEE, owner_cs, swap_in, min_usdt_out, 0)],
            ),
            "value": "0x0",
            "chain_id": cid,
        }
    )

    # 2) Approve both tokens to the position manager.
    calls.append(_approve(USDC_ARBITRUM, UNISWAP_V3_NPM, keep_usdc, "approve_usdc_npm", cid))
    calls.append(_approve(USDT_ARBITRUM, UNISWAP_V3_NPM, min_usdt_out, "approve_usdt_npm", cid))

    # 3) Mint full-range position to the owner. amountMin=0: full-range stable add,
    #    excess is refunded by the NPM; the recipient anchor prevents any theft.
    calls.append(
        {
            "purpose": "mint_lp_usdc_usdt",
            "to": to_checksum_address(UNISWAP_V3_NPM),
            "data": _encode_call(
                MINT_SIG,
                [
                    "(address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256)"
                ],
                [
                    (
                        TOKEN0,
                        TOKEN1,
                        LP_FEE,
                        FULL_RANGE_MIN_TICK,
                        FULL_RANGE_MAX_TICK,
                        keep_usdc,
                        min_usdt_out,
                        0,
                        0,
                        owner_cs,
                        deadline,
                    )
                ],
            ),
            "value": "0x0",
            "chain_id": cid,
        }
    )
    return calls


# Minimal NonfungiblePositionManager (ERC721Enumerable) read ABI for exit discovery.
_NPM_READ_ABI = [
    {
        "inputs": [{"name": "owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "index", "type": "uint256"},
        ],
        "name": "tokenOfOwnerByIndex",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "positions",
        "outputs": [
            {"name": "nonce", "type": "uint96"},
            {"name": "operator", "type": "address"},
            {"name": "token0", "type": "address"},
            {"name": "token1", "type": "address"},
            {"name": "fee", "type": "uint24"},
            {"name": "tickLower", "type": "int24"},
            {"name": "tickUpper", "type": "int24"},
            {"name": "liquidity", "type": "uint128"},
            {"name": "feeGrowthInside0LastX128", "type": "uint256"},
            {"name": "feeGrowthInside1LastX128", "type": "uint256"},
            {"name": "tokensOwed0", "type": "uint128"},
            {"name": "tokensOwed1", "type": "uint128"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
]

# Bound on-chain enumeration so a wallet with many NFTs can't stall the request.
_MAX_LP_SCAN = 60


def find_lp_position(owner: str) -> tuple[int, int] | None:
    """
    Find the owner's live USDC/USDT 0.01% LP position on-chain (source of truth).

    Returns (token_id, liquidity) for the largest matching open position, or None.
    We read directly from the NonfungiblePositionManager instead of trusting stored
    state, so "close" always acts on the real position even after external changes.
    """
    _require_arbitrum_one()
    owner_cs = to_checksum_address(owner)
    w3 = Web3(Web3.HTTPProvider(get_settings().arbitrum_rpc))
    npm = w3.eth.contract(address=to_checksum_address(UNISWAP_V3_NPM), abi=_NPM_READ_ABI)

    try:
        balance = int(npm.functions.balanceOf(owner_cs).call())
    except Exception:
        return None
    if balance <= 0:
        return None

    best: tuple[int, int] | None = None
    for index in range(min(balance, _MAX_LP_SCAN)):
        try:
            token_id = int(npm.functions.tokenOfOwnerByIndex(owner_cs, index).call())
            pos = npm.functions.positions(token_id).call()
        except Exception:
            continue
        token0, token1, fee, liquidity = pos[2], pos[3], int(pos[4]), int(pos[7])
        if (
            liquidity > 0
            and int(fee) == LP_FEE
            and to_checksum_address(token0) == TOKEN0
            and to_checksum_address(token1) == TOKEN1
        ):
            if best is None or liquidity > best[1]:
                best = (token_id, liquidity)
    return best


def build_lp_exit_calls(
    *,
    owner: str,
    token_id: int,
    liquidity: int,
    deadline: int,
) -> list[dict[str, Any]]:
    """Build policy-safe calls to fully exit an LP position back to the owner."""
    _require_arbitrum_one()
    owner_cs = to_checksum_address(owner)
    cid = ARBITRUM_ONE_CHAIN_ID
    if token_id <= 0 or liquidity <= 0:
        raise ValueError("A positive token_id and liquidity are required to exit.")

    return [
        {
            "purpose": "decrease_liquidity_lp",
            "to": to_checksum_address(UNISWAP_V3_NPM),
            "data": _encode_call(
                DECREASE_SIG,
                ["(uint256,uint128,uint256,uint256,uint256)"],
                [(token_id, liquidity, 0, 0, deadline)],
            ),
            "value": "0x0",
            "chain_id": cid,
        },
        {
            "purpose": "collect_lp",
            "to": to_checksum_address(UNISWAP_V3_NPM),
            "data": _encode_call(
                COLLECT_SIG,
                ["(uint256,address,uint128,uint128)"],
                [(token_id, owner_cs, MAX_UINT128, MAX_UINT128)],
            ),
            "value": "0x0",
            "chain_id": cid,
        },
        {
            "purpose": "burn_lp",
            "to": to_checksum_address(UNISWAP_V3_NPM),
            "data": _encode_call(BURN_SIG, ["uint256"], [token_id]),
            "value": "0x0",
            "chain_id": cid,
        },
    ]
