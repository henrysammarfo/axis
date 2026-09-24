"""Retention Agent — schedule + policy hooks for English stock reports.

Attract is onboard; retain is recurring English truth + proof of what AXIS did.
Fail-closed: no invented fills in retention copy.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any


DEFAULT_POLICY: dict[str, Any] = {
    "cadence": "weekly",
    "weekday": "monday",
    "timezone": "UTC",
    "include_arb_yield": True,
    "include_stock_legs": True,
    "include_fragmentation_warnings": True,
    "rebalance_mode": "report_only",  # report_only | suggest — never silent execute stocks
    "honesty": (
        "Retention is English reporting + policy suggestions. Stock fills stay fail-closed "
        "via Activate hold / RH testnet path only."
    ),
}


def normalize_policy(raw: dict | None) -> dict[str, Any]:
    base = dict(DEFAULT_POLICY)
    if isinstance(raw, dict):
        for key in (
            "cadence",
            "weekday",
            "timezone",
            "include_arb_yield",
            "include_stock_legs",
            "include_fragmentation_warnings",
            "rebalance_mode",
        ):
            if key in raw:
                base[key] = raw[key]
    if base.get("rebalance_mode") not in ("report_only", "suggest"):
        base["rebalance_mode"] = "report_only"
    if base.get("cadence") not in ("weekly", "biweekly"):
        base["cadence"] = "weekly"
    return base


def next_due_iso(policy: dict[str, Any], *, now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    # Simple: next Monday 12:00 UTC (or +14d for biweekly from now)
    days = (7 - now.weekday()) % 7
    if days == 0 and now.hour >= 12:
        days = 7
    if policy.get("cadence") == "biweekly":
        days = days or 14
        if days < 14 and days != 0:
            pass
        elif days == 0:
            days = 14
    target = (now + timedelta(days=days)).replace(hour=12, minute=0, second=0, microsecond=0)
    return target.isoformat()


def retention_status(
    *,
    policy: dict | None,
    stock_basket: dict | None,
    rh_holds: dict | None,
    last_report_at: str | None = None,
) -> dict[str, Any]:
    pol = normalize_policy(policy)
    holds = rh_holds if isinstance(rh_holds, dict) else {}
    basket = stock_basket if isinstance(stock_basket, dict) else {}
    legs = basket.get("legs") or []
    hold_status = holds.get("status") or "none"
    return {
        "policy": pol,
        "next_due": next_due_iso(pol),
        "last_report_at": last_report_at,
        "loop": {
            "has_basket": bool(legs),
            "hold_status": hold_status,
            "retain_ready": bool(legs) and hold_status in ("held", "partial", "planned"),
        },
        "actions_this_cycle": [
            "English weekly note with Arb yield + stock legs",
            "Fragmentation warnings when comparing issuers",
            "Suggest rebalance only — never silent RH fills",
        ],
        "honesty": pol["honesty"],
    }
