"""Arb ↔ Robinhood Chain liquidity-rail map (Open House honesty).

Aerodrome lesson: label where liquidity actually lives. Do not imply seamless
mainnet stock fills on thin/test rails.
"""

from __future__ import annotations

from typing import Any

from rh_chain import (
    ROBINHOOD_MAINNET_CHAIN_ID,
    ROBINHOOD_TESTNET_CHAIN_ID,
    rh_explorer,
    rh_rpc,
)
from services.rh_hold_logic import FAUCET_URL


def liquidity_rails() -> dict[str, Any]:
    return {
        "title": "Arb ↔ Robinhood liquidity rails",
        "honesty": (
            "AXIS keeps Arbitrum One yield live. New stock-token work is on Robinhood Chain "
            "public testnet (46630) until labeled mainnet inventory + depth exist. "
            "No fake bridges, no invented fills."
        ),
        "lesson": (
            "Aerodrome-class lesson: a route that only exists as marketing copy is not a rail. "
            "Ship labeled testnet holds + Arb depth; promote mainnet stock rails only when "
            "registry + liquidity are verifiable."
        ),
        "rails": [
            {
                "id": "arb-one-yield",
                "label": "Arbitrum One yield",
                "chain_id": 42161,
                "role": "live",
                "assets": ["USDC", "Aave", "GMX GM"],
                "status": "live",
                "proof": "UA + EIP-7702 + ZeroDev SRA on /proof",
                "notes": "Existing Set.Forget.Earn path. Gasless Google mom UX.",
            },
            {
                "id": "rh-testnet-stocks",
                "label": "Robinhood Chain stock tokens",
                "chain_id": ROBINHOOD_TESTNET_CHAIN_ID,
                "role": "new_work",
                "assets": ["TSLA", "AMZN", "PLTR", "NFLX", "AMD"],
                "status": "public_testnet",
                "rpc": rh_rpc(ROBINHOOD_TESTNET_CHAIN_ID),
                "explorer": rh_explorer(ROBINHOOD_TESTNET_CHAIN_ID),
                "faucet": FAUCET_URL,
                "notes": (
                    "Canonical faucet set. BasketPolicy plans → Activate hold (fund or sync). "
                    "Always labeled testnet in UI and /proof."
                ),
            },
            {
                "id": "rh-mainnet-stocks",
                "label": "Robinhood Chain mainnet stocks",
                "chain_id": ROBINHOOD_MAINNET_CHAIN_ID,
                "role": "future",
                "assets": [],
                "status": "awaiting_registry_depth",
                "rpc": rh_rpc(ROBINHOOD_MAINNET_CHAIN_ID),
                "explorer": rh_explorer(ROBINHOOD_MAINNET_CHAIN_ID),
                "notes": (
                    "Do not hard-code invented mainnet fills. Wire live registry when inventory "
                    "is thick enough to demo honestly."
                ),
            },
            {
                "id": "cross-rail",
                "label": "Cross-rail (Arb ↔ RH)",
                "chain_id": None,
                "role": "map_only",
                "assets": ["USDC notionals (plan)", "stock-token dust (testnet)"],
                "status": "labeled_separate",
                "notes": (
                    "Today: same Google identity, two labeled networks. Notional basket $ on "
                    "dashboard is plan sizing — not an automatic bridge. Judges see Arb txs and "
                    "RH testnet txs separately on /proof."
                ),
            },
        ],
        "demo_path": [
            "Google login → Arb UA / 7702 / SRA",
            "English → BasketPolicy (tech yes, oil no)",
            "Faucet agent and/or UA on RH testnet",
            "Activate hold → real RH txs or synced balances",
            "Weekly English report includes stock legs",
        ],
    }
