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
from services.usdg_path import usdg_path


def liquidity_rails() -> dict[str, Any]:
    usdg = usdg_path()
    return {
        "title": "Arb ↔ Robinhood liquidity rails",
        "honesty": (
            "AXIS keeps Arbitrum One yield live. New stock-token work is on Robinhood Chain "
            "public testnet (46630) until labeled mainnet inventory + depth exist. "
            "USDG contracts are Paxos-verified and mapped — AXIS does not auto-bridge. "
            "No fake bridges, no invented fills."
        ),
        "lesson": (
            "Aerodrome-class lesson: a route that only exists as marketing copy is not a rail. "
            "Ship labeled testnet holds + Arb depth; promote mainnet stock rails only when "
            "registry + liquidity are verifiable. USDG is a labeled prize/stable rail, not a "
            "silent fill path."
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
                "notes": "Existing Set.Forget.Earn path. Gasless Google mom UX. Settles USDC today.",
            },
            {
                "id": "usdg-arb-rh",
                "label": "USDG (Arb One ↔ RH mainnet)",
                "chain_id": 42161,
                "role": "stable_bonus_rail",
                "assets": ["USDG"],
                "status": "contracts_verified_axis_does_not_execute",
                "proof": usdg["source"],
                "explorer": next(
                    (
                        leg.get("explorer_url")
                        for leg in usdg["legs"]
                        if leg["id"] == "usdg-arbitrum"
                    ),
                    None,
                ),
                "notes": (
                    "Paxos-verified USDG on Arb + RH mainnet + LZ OFT wrapper. "
                    "See GET /api/basket/usdg. Founder House prizes in USDG — not a live AXIS bridge."
                ),
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
                "assets": [
                    "USDC (live yield)",
                    "USDG (verified, not AXIS-executed)",
                    "stock dust (testnet)",
                ],
                "status": "labeled_separate",
                "notes": (
                    "Same Google identity; labeled networks. Plan notional $ ≠ bridge. "
                    "Judges see Arb txs and RH testnet txs separately on /proof; USDG explorers "
                    "are linked from the USDG path panel."
                ),
            },
        ],
        "usdg": {
            "axis_executes": usdg["axis_executes"],
            "status": usdg["status"],
            "source": usdg["source"],
            "legs": [
                {
                    "id": leg["id"],
                    "label": leg["label"],
                    "status": leg["status"],
                    "address": leg.get("address"),
                    "explorer_url": leg.get("explorer_url"),
                }
                for leg in usdg["legs"]
                if leg.get("asset") == "USDG" or leg["id"] == "usdg-lz-oft"
            ],
        },
        "demo_path": [
            "Google login → Arb UA / 7702 / SRA (USDC yield)",
            "English → BasketPolicy (tech yes, oil no)",
            "Faucet agent and/or UA on RH testnet",
            "Activate hold → real RH txs or synced balances",
            "Show USDG labeled path (Arb + RH mainnet explorers) — no invented OFT",
            "Weekly English report includes stock legs + fragmentation warnings",
        ],
    }
