"""Packages catalog — optional revenue wedge (read-only for OH).

Not a live marketplace. English strategy packages with honest pricing thesis.
AXIS does not take payment here yet.
"""

from __future__ import annotations

from typing import Any


def package_catalog() -> dict[str, Any]:
    return {
        "title": "Package market (preview)",
        "status": "catalog_only",
        "axis_charges": False,
        "honesty": (
            "Read-only package cards for Open House revenue narrative. No checkout, no "
            "AUM fee collection, no invented subscribers. Live path remains free Arb yield + "
            "RH testnet stock demo."
        ),
        "revenue_thesis": [
            "AUM-linked advisory / subscription for continuity accounts",
            "Package marketplace take-rate on paid English strategies",
            "Future mint/redeem partner fee share — not gas or faucet tips",
        ],
        "packages": [
            {
                "id": "tech-yes-oil-no",
                "name": "Tech yes, oil no",
                "price_usdc_mo": 0,
                "status": "included",
                "summary": "Default BasketPolicy — oil excluded, RH testnet tech set.",
                "legs_hint": ["TSLA", "AMZN", "AMD", "NFLX", "PLTR"],
            },
            {
                "id": "steady-tech",
                "name": "Steady tech",
                "price_usdc_mo": 9,
                "status": "waitlist",
                "summary": "Lower-turnover English weights + weekly retention note.",
                "legs_hint": ["AMZN", "NFLX", "AMD"],
            },
            {
                "id": "ai-semi",
                "name": "AI & semiconductors",
                "price_usdc_mo": 19,
                "status": "waitlist",
                "summary": "Concentrated AI/semi English package — still fail-closed on fills.",
                "legs_hint": ["NVDA-class via AMD/PLTR desk until registry expands"],
            },
        ],
        "cta": "Join stock waitlist for paid packages — no charge today.",
    }
