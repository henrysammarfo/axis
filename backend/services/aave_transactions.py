"""Aave v3 (Arbitrum) calldata + USDC balance helpers for client-signed activation."""

from __future__ import annotations

from typing import Any

from eth_abi import encode
from eth_utils import function_signature_to_4byte_selector, to_checksum_address
from web3 import Web3

from chain_config import (
    AAVE_POOL_BY_CHAIN,
    AAVE_UNDERLYING_BY_CHAIN,
    ARBITRUM_ONE_CHAIN_ID,
)
from config import get_settings
from services.strategy_engine import AllocationPlan

# Uniswap V3 SwapRouter02 — Arbitrum One only (USDT path)
UNISWAP_ROUTER_BY_CHAIN: dict[int, str] = {
    ARBITRUM_ONE_CHAIN_ID: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
}

USDC_USDT_FEE = 100  # 0.01% stable pool
USDC_DECIMALS = 6
USDT_DECIMALS = 6

ERC20_ABI = [
    {
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function",
    },
]


def _selector(signature: str) -> bytes:
    return function_signature_to_4byte_selector(signature)


def _encode_call(signature: str, types: list[str], args: list[Any]) -> str:
    return "0x" + (_selector(signature) + encode(types, args)).hex()


def _w3() -> Web3:
    return Web3(Web3.HTTPProvider(get_settings().arbitrum_rpc))


def _chain_id() -> int:
    return int(get_settings().arbitrum_chain_id)


def underlying_token(asset: str, chain_id: int | None = None) -> str:
    cid = chain_id or _chain_id()
    table = AAVE_UNDERLYING_BY_CHAIN.get(cid) or {}
    addr = table.get(asset.upper())
    if not addr:
        raise ValueError(f"{asset} is not configured for chain {cid}")
    return to_checksum_address(addr)


def aave_pool(chain_id: int | None = None) -> str:
    cid = chain_id or _chain_id()
    addr = AAVE_POOL_BY_CHAIN.get(cid)
    if not addr:
        raise ValueError(f"Aave pool not configured for chain {cid}")
    return to_checksum_address(addr)


def usdc_to_raw(amount_usdc: float) -> int:
    return int(round(amount_usdc * (10**USDC_DECIMALS)))


def get_token_balance_usdc(owner: str, asset: str = "USDC") -> float:
    """Read ERC20 balance as human USDC/USDT units (6 decimals)."""
    w3 = _w3()
    token = w3.eth.contract(address=underlying_token(asset), abi=ERC20_ABI)
    raw = int(token.functions.balanceOf(to_checksum_address(owner)).call())
    decimals = int(token.functions.decimals().call())
    return raw / (10**decimals)


def get_native_balance_wei(owner: str) -> int:
    """Native ETH balance (wei) the account holds on the settlement chain.

    Used to decide up-front whether a venue that needs the user's own ETH (e.g.
    GMX's keeper fee) is fundable, so the one-tap route can pre-skip it cleanly
    instead of failing a leg on-chain. Returns 0 on any read error.
    """
    try:
        return int(_w3().eth.get_balance(to_checksum_address(owner)))
    except Exception:
        return 0


def require_usdc_funding(owner: str, budget_usdc: float) -> float:
    balance = get_token_balance_usdc(owner, "USDC")
    if balance + 1e-6 < budget_usdc:
        raise FundingError(
            f"Send at least ${budget_usdc:.2f} USDC to your AXIS address "
            f"({owner}) on Arbitrum. Current balance: ${balance:.2f} USDC."
        )
    return balance


class FundingError(ValueError):
    """Wallet USDC balance is below the requested budget."""


def build_activation_transactions(
    *,
    owner: str,
    plan: AllocationPlan,
) -> list[dict[str, Any]]:
    """
    Build client-signed tx intents for the locked plan.

    USDC legs: approve Aave + supply.
    USDT legs (Arbitrum One): swap USDC→USDT via Uniswap, approve Aave, supply USDT.
    """
    owner_cs = to_checksum_address(owner)
    cid = _chain_id()
    pool = aave_pool(cid)
    usdc = underlying_token("USDC", cid)
    txs: list[dict[str, Any]] = []

    for leg in plan.legs:
        amount_raw = usdc_to_raw(leg.amount_usdc)
        if amount_raw <= 0:
            continue

        if leg.asset == "USDC":
            txs.append(
                {
                    "purpose": "approve_usdc_aave",
                    "leg_asset": "USDC",
                    "amount_usdc": leg.amount_usdc,
                    "to": usdc,
                    "data": _encode_call(
                        "approve(address,uint256)",
                        ["address", "uint256"],
                        [pool, amount_raw],
                    ),
                    "value": "0x0",
                    "chain_id": cid,
                }
            )
            txs.append(
                {
                    "purpose": "supply_aave_usdc",
                    "leg_asset": "USDC",
                    "amount_usdc": leg.amount_usdc,
                    "estimated_apy": leg.estimated_apy,
                    "to": pool,
                    "data": _encode_call(
                        "supply(address,uint256,address,uint16)",
                        ["address", "uint256", "address", "uint16"],
                        [usdc, amount_raw, owner_cs, 0],
                    ),
                    "value": "0x0",
                    "chain_id": cid,
                }
            )
            continue

        if leg.asset == "USDT":
            if cid != ARBITRUM_ONE_CHAIN_ID:
                raise ValueError(
                    "USDT Aave legs require Arbitrum One. Use Protect / Grow with USDC-only or switch chain."
                )
            usdt = underlying_token("USDT", cid)
            router = to_checksum_address(UNISWAP_ROUTER_BY_CHAIN[cid])
            min_out = int(amount_raw * 995 // 1000)  # 0.5% slippage for stables

            txs.append(
                {
                    "purpose": "approve_usdc_uniswap",
                    "leg_asset": "USDT",
                    "amount_usdc": leg.amount_usdc,
                    "to": usdc,
                    "data": _encode_call(
                        "approve(address,uint256)",
                        ["address", "uint256"],
                        [router, amount_raw],
                    ),
                    "value": "0x0",
                    "chain_id": cid,
                }
            )
            # SwapRouter02 exactInputSingle — no deadline field
            swap_data = _encode_call(
                "exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))",
                ["(address,address,uint24,address,uint256,uint256,uint160)"],
                [(usdc, usdt, USDC_USDT_FEE, owner_cs, amount_raw, min_out, 0)],
            )
            txs.append(
                {
                    "purpose": "swap_usdc_usdt",
                    "leg_asset": "USDT",
                    "amount_usdc": leg.amount_usdc,
                    "to": router,
                    "data": swap_data,
                    "value": "0x0",
                    "chain_id": cid,
                }
            )
            # Approve/supply the slippage floor so supply cannot exceed post-swap balance.
            txs.append(
                {
                    "purpose": "approve_usdt_aave",
                    "leg_asset": "USDT",
                    "amount_usdc": leg.amount_usdc,
                    "to": usdt,
                    "data": _encode_call(
                        "approve(address,uint256)",
                        ["address", "uint256"],
                        [pool, min_out],
                    ),
                    "value": "0x0",
                    "chain_id": cid,
                }
            )
            txs.append(
                {
                    "purpose": "supply_aave_usdt",
                    "leg_asset": "USDT",
                    "amount_usdc": round(min_out / (10**USDT_DECIMALS), 6),
                    "estimated_apy": leg.estimated_apy,
                    "to": pool,
                    "data": _encode_call(
                        "supply(address,uint256,address,uint16)",
                        ["address", "uint256", "address", "uint16"],
                        [usdt, min_out, owner_cs, 0],
                    ),
                    "value": "0x0",
                    "chain_id": cid,
                }
            )
            continue

        raise ValueError(f"Unsupported strategy asset: {leg.asset}")

    return txs


MAX_UINT256 = (1 << 256) - 1


def _usdc_supply_calls(owner_cs: str, amount_raw: int, cid: int) -> list[dict[str, Any]]:
    pool = aave_pool(cid)
    usdc = underlying_token("USDC", cid)
    return [
        {
            "purpose": "approve_usdc_aave",
            "to": usdc,
            "data": _encode_call(
                "approve(address,uint256)", ["address", "uint256"], [pool, amount_raw]
            ),
            "value": "0x0",
            "chain_id": cid,
        },
        {
            "purpose": "supply_aave_usdc",
            "to": pool,
            "data": _encode_call(
                "supply(address,uint256,address,uint16)",
                ["address", "uint256", "address", "uint16"],
                [usdc, amount_raw, owner_cs, 0],
            ),
            "value": "0x0",
            "chain_id": cid,
        },
    ]


def build_supply_calls(*, owner: str, usdc_amount: float) -> list[dict[str, Any]]:
    """Policy-safe session calls to supply an explicit USDC amount to Aave.

    Returns [approve USDC->Pool, supply(USDC, onBehalfOf=owner)] — the exact pair
    the session CallPolicy allows. Used by the one-tap route apply to place the
    stable core gaslessly (no signing). Empty list if the amount rounds to zero.
    """
    owner_cs = to_checksum_address(owner)
    cid = _chain_id()
    amount_raw = usdc_to_raw(usdc_amount)
    if amount_raw <= 0:
        return []
    return _usdc_supply_calls(owner_cs, amount_raw, cid)


def _usdc_withdraw_all_call(owner_cs: str, cid: int) -> dict[str, Any]:
    pool = aave_pool(cid)
    usdc = underlying_token("USDC", cid)
    # Aave v3: amount = type(uint256).max withdraws the full aToken balance.
    return {
        "purpose": "withdraw_aave_usdc",
        "to": pool,
        "data": _encode_call(
            "withdraw(address,uint256,address)",
            ["address", "uint256", "address"],
            [usdc, MAX_UINT256, owner_cs],
        ),
        "value": "0x0",
        "chain_id": cid,
    }


_SAFETY_WORDS = ("safe", "safer", "withdraw", "cash", "exit", "out", "protect", "pull")
_INVEST_WORDS = ("invest", "deploy", "work", "earn", "yield", "grow", "supply")


def build_rebalance_calls(
    *,
    owner: str,
    instruction: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], str]:
    """
    Build policy-safe (USDC-only) rebalance calls for the session key.

    Returns (calls, actions, explanation). Empty calls means no on-chain action.
    """
    owner_cs = to_checksum_address(owner)
    cid = _chain_id()
    text = (instruction or "").strip().lower()

    wants_safety = any(w in text for w in _SAFETY_WORDS)
    wants_invest = any(w in text for w in _INVEST_WORDS)

    if wants_safety and not wants_invest:
        call = _usdc_withdraw_all_call(owner_cs, cid)
        return (
            [call],
            [{"action": "withdraw", "asset": "USDC", "protocol": "aave"}],
            "Moving your USDC out of Aave back to your wallet.",
        )

    # Default / invest: put idle USDC to work.
    idle = get_token_balance_usdc(owner_cs, "USDC")
    amount_raw = usdc_to_raw(idle)
    if amount_raw <= 0:
        return ([], [], "No idle USDC to put to work right now.")

    calls = _usdc_supply_calls(owner_cs, amount_raw, cid)
    return (
        calls,
        [{"action": "supply", "asset": "USDC", "protocol": "aave", "amount_usdc": round(idle, 2)}],
        f"Putting your idle ${idle:.2f} USDC to work in Aave.",
    )


def verify_tx_success(tx_hash: str) -> dict[str, Any]:
    w3 = _w3()
    if not tx_hash or not str(tx_hash).startswith("0x"):
        raise ValueError("Invalid transaction hash")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    status = int(receipt.get("status", 0))
    if status != 1:
        raise ValueError(f"Transaction failed on-chain: {tx_hash}")
    return {
        "tx_hash": tx_hash,
        "block": receipt.get("blockNumber"),
        "status": status,
    }
