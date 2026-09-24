"""USDG path — fail-closed Arb One ↔ Robinhood Chain labeled spine.

Verified addresses from Paxos docs (docs.paxos.com/guides/stablecoin/usdg/mainnet)
researched 2026-09-18. AXIS does NOT execute LayerZero OFT transfers yet —
this layer is honesty map + explorer proof for Open House / Founder House USDG
prize framing, not a mint/bridge button.
"""

from __future__ import annotations

from typing import Any

from rh_chain import ROBINHOOD_MAINNET_CHAIN_ID, ROBINHOOD_TESTNET_CHAIN_ID, rh_explorer

# Paxos USDG — Global Dollar (6 decimals on EVM deployments below)
USDG_ARBITRUM = "0x004B506865409877C9fA29bfb1ebA929984B9bbC"
USDG_ROBINHOOD_MAINNET = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"
USDG_SUPPLY_CONTROL_ARB = "0x359a1Ee087abD3042151b93eC8EA462D6B27bcb6"
USDG_SUPPLY_CONTROL_RH = "0xdf5FfF9cb88B3cAb50572FAE73E2EB08599D25D4"
USDG_OFT_WRAPPER_RH = "0x0d54755f5106BfdB43f7a35f5D49a23F940628d1"
LZ_ENDPOINT_V2_RH = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B"
LZ_EID_RH = 30416

PAXOS_DOCS = "https://docs.paxos.com/guides/stablecoin/usdg/mainnet"


def usdg_path() -> dict[str, Any]:
    return {
        "title": "USDG · Arb One yield ↔ RH stock path",
        "status": "labeled_path",
        "axis_executes": False,
        "honesty": (
            "USDG contracts below are Paxos-verified. AXIS labels the path for judges "
            "(Founder House prizes settle in USDG). We do not auto-bridge, mint, or invent "
            "fills. Live AXIS yield still settles in USDC on Arb One; RH stock work remains "
            "public testnet (46630) until mainnet stock registry depth is honest."
        ),
        "hackquest_note": (
            "Buildathon prizes are largely USDC; Founder House Singapore prizes/grants are "
            "denominated in USDG. Showing a real USDG rail map is bonus honesty — not a claim "
            "that AXIS already routes user funds through OFT."
        ),
        "source": PAXOS_DOCS,
        "verified_at": "2026-09-18",
        "legs": [
            {
                "id": "arb-yield-usdc",
                "label": "Arbitrum One yield (live AXIS)",
                "chain": "arbitrum-one",
                "chain_id": 42161,
                "asset": "USDC",
                "role": "live_settlement",
                "status": "live",
                "address": None,
                "address_verified": False,
                "notes": (
                    "Current Set.Forget.Earn path. Not USDG — labeled so judges do not "
                    "confuse live yield asset with the USDG bonus rail."
                ),
            },
            {
                "id": "usdg-arbitrum",
                "label": "USDG on Arbitrum One",
                "chain": "arbitrum-one",
                "chain_id": 42161,
                "asset": "USDG",
                "role": "stable_rail",
                "status": "contract_verified",
                "address": USDG_ARBITRUM,
                "address_verified": True,
                "decimals": 6,
                "explorer_url": f"https://arbiscan.io/token/{USDG_ARBITRUM}",
                "supply_control": USDG_SUPPLY_CONTROL_ARB,
                "notes": (
                    "Paxos Global Dollar on Arb. Thin supply vs other chains — still a real "
                    "token, not marketing copy."
                ),
            },
            {
                "id": "usdg-lz-oft",
                "label": "LayerZero OFT (Arb ↔ RH mainnet)",
                "chain": "cross-chain",
                "chain_id": None,
                "asset": "USDG",
                "role": "bridge_primitive",
                "status": "issuer_path_documented",
                "address": USDG_OFT_WRAPPER_RH,
                "address_verified": True,
                "explorer_url": (
                    f"{rh_explorer(ROBINHOOD_MAINNET_CHAIN_ID)}/address/{USDG_OFT_WRAPPER_RH}"
                ),
                "layerzero": {
                    "endpoint_v2": LZ_ENDPOINT_V2_RH,
                    "eid_robinhood": LZ_EID_RH,
                    "oft_wrapper_rh": USDG_OFT_WRAPPER_RH,
                },
                "notes": (
                    "Issuer/cross-chain primitive per Paxos. AXIS has no OFT send UI — "
                    "fail-closed until a sponsored demo path ships."
                ),
            },
            {
                "id": "usdg-rh-mainnet",
                "label": "USDG on Robinhood Chain mainnet",
                "chain": "robinhood-mainnet",
                "chain_id": ROBINHOOD_MAINNET_CHAIN_ID,
                "asset": "USDG",
                "role": "rh_stable",
                "status": "contract_verified",
                "address": USDG_ROBINHOOD_MAINNET,
                "address_verified": True,
                "decimals": 6,
                "explorer_url": (
                    f"{rh_explorer(ROBINHOOD_MAINNET_CHAIN_ID)}/token/{USDG_ROBINHOOD_MAINNET}"
                ),
                "supply_control": USDG_SUPPLY_CONTROL_RH,
                "notes": "Verified RH mainnet USDG. Separate from RH public testnet stock faucet.",
            },
            {
                "id": "rh-testnet-stocks",
                "label": "RH public testnet stock tokens",
                "chain": "robinhood-testnet",
                "chain_id": ROBINHOOD_TESTNET_CHAIN_ID,
                "asset": "stock_tokens",
                "role": "stock_demo",
                "status": "public_testnet",
                "address": None,
                "address_verified": False,
                "notes": (
                    "AXIS stock holds live here. USDG is NOT claimed on testnet in this registry "
                    "— do not invent a testnet USDG mint."
                ),
            },
        ],
        "path_steps": [
            {
                "step": 1,
                "title": "Earn on Arb One",
                "detail": "Google UA · USDC yield (live AXIS).",
                "executable_today": True,
            },
            {
                "step": 2,
                "title": "Hold / acquire USDG on Arb (optional)",
                "detail": "Verified USDG token on Arb — user/issuer path; AXIS does not mint.",
                "executable_today": False,
            },
            {
                "step": 3,
                "title": "OFT to RH mainnet USDG",
                "detail": "LayerZero OFT wrapper documented by Paxos — not AXIS-executed.",
                "executable_today": False,
            },
            {
                "step": 4,
                "title": "RH stock exposure",
                "detail": (
                    "Demo: RH public testnet faucet + Activate hold. Mainnet stocks only when "
                    "registry depth is verifiable."
                ),
                "executable_today": True,
            },
        ],
        "refuse": [
            "No one-click Arb USDC → RH stock button",
            "No invented USDG testnet faucet",
            "No claiming OFT transfers AXIS did not broadcast",
        ],
    }
