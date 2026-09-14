"""Pure RH hold coverage logic — no RPC deps (unit-testable)."""

from __future__ import annotations

from typing import Any

FAUCET_URL = "https://faucet.testnet.chain.robinhood.com"


def evaluate_coverage(
    wanted: list[str],
    balances: dict[str, float],
    *,
    min_balance: float = 1e-9,
) -> dict[str, Any]:
    """Fail-closed coverage check. Plan ≠ held without balances."""
    want = [s.upper() for s in wanted]
    present = [s for s in want if float(balances.get(s, 0) or 0) > min_balance]
    missing = [s for s in want if s not in present]
    if not want:
        status = "empty_plan"
    elif not present:
        status = "awaiting_faucet"
    elif missing:
        status = "partial"
    else:
        status = "held"
    return {
        "status": status,
        "wanted": want,
        "present": present,
        "missing": missing,
        "coverage": round(len(present) / len(want), 4) if want else 0.0,
    }
