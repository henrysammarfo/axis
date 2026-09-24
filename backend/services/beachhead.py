"""Beachhead GTM — EU/APAC crypto holders, geo honesty, demo script.

Not legal advice. Soft self-attestation only — no IP hard-block that invents
compliance. US persons see issuer restrictions; RH public testnet remains a
builder/demo rail.
"""

from __future__ import annotations

from typing import Any, Literal

Region = Literal[
    "eu",
    "apac",
    "uk",
    "us",
    "ca",
    "other",
    "prefer_not",
]

BEACHHEAD_REGIONS = ("eu", "apac")

REGION_LABELS: dict[str, str] = {
    "eu": "European Union / EEA",
    "apac": "Asia-Pacific (ex-US)",
    "uk": "United Kingdom",
    "us": "United States",
    "ca": "Canada",
    "other": "Other",
    "prefer_not": "Prefer not to say",
}


def normalize_region(raw: str | None) -> str:
    key = (raw or "prefer_not").strip().lower().replace(" ", "_")
    if key in REGION_LABELS:
        return key
    return "prefer_not"


def evaluate_geo(region: str | None) -> dict[str, Any]:
    """Soft eligibility hints for the continuity neobroker wedge."""
    r = normalize_region(region)
    beachhead = r in BEACHHEAD_REGIONS
    # Issuer products (Ondo / xStocks / RH Classic coverage) typically restrict US.
    us_sensitive = r in ("us", "ca")
    return {
        "region": r,
        "region_label": REGION_LABELS[r],
        "beachhead": beachhead,
        "beachhead_markets": ["eu", "apac"],
        "axis_demo": {
            "arb_yield": True,
            "rh_testnet_stocks": True,
            "notes": (
                "Arb yield + RH public testnet stock demo available for builders regardless "
                "of region. Mainnet stock / issuer mint paths follow issuer geo rules."
            ),
        },
        "issuer_hints": {
            "ondo_xstocks_us_persons": "typically_blocked" if us_sensitive or r == "us" else "check_issuer",
            "rh_classic_stock_tokens": "geo_restricted_per_issuer",
            "honesty": (
                "AXIS does not replace issuer KYC/geo. Fragmentation desk shows claim + geo "
                "hints; we refuse to invent eligibility."
            ),
        },
        "gtm_message": (
            "Primary beachhead: crypto-native EU/APAC users who already refuse MetaMask — "
            "continuity Google UA → Arb yield → labeled RH stock path."
            if beachhead
            else (
                "Outside primary beachhead: you can still run the Arb + RH testnet demo. "
                "Mainnet stock products may be unavailable per issuer geo."
                if not us_sensitive
                else (
                    "US/CA self-attestation: many tokenized-stock issuers restrict U.S. persons. "
                    "AXIS keeps Arb yield + RH public testnet demo; we do not invent a retail "
                    "mainnet stock offer for restricted geos."
                )
            )
        ),
        "cta": "join_waitlist" if beachhead or r in ("uk", "other", "prefer_not") else "demo_only",
    }


def beachhead_pack() -> dict[str, Any]:
    return {
        "title": "Beachhead GTM",
        "wedge": (
            "Distribution + account UX for crypto-native EU/APAC — not issuance, not "
            "Aave-wrapper, not borrow-against-TSLA."
        ),
        "primary_markets": [
            {"id": "eu", "label": REGION_LABELS["eu"], "why": "RH-eligible crypto users; Google continuity"},
            {"id": "apac", "label": REGION_LABELS["apac"], "why": "Open House SG beachhead; refuse MetaMask cohort"},
        ],
        "channels": [
            {"id": "google_ua", "label": "Google → UA onboard", "status": "live"},
            {"id": "hackquest", "label": "HackQuest / Founder House demo", "status": "in_progress"},
            {"id": "partner_faucet", "label": "Partner RH faucet script", "status": "documented"},
            {"id": "waitlist", "label": "Stock-path waitlist", "status": "live_api"},
        ],
        "regions": [{"id": k, "label": v} for k, v in REGION_LABELS.items()],
        "geo_law": (
            "Self-attestation only. No IP hard-block. No legal advice. Fail-closed on "
            "invented eligibility for Ondo/xStocks/RH Classic."
        ),
        "demo_script": demo_script(),
    }


def demo_script() -> dict[str, Any]:
    return {
        "title": "Judge / partner faucet demo script",
        "duration_min": 6,
        "steps": [
            {
                "n": 1,
                "title": "Google login",
                "say": "Mom UX — no MetaMask. Magic + Particle + ZeroDev on Arbitrum One.",
                "show": "/onboard → UA + EIP-7702 + SRA on /proof",
            },
            {
                "n": 2,
                "title": "Arb yield live",
                "say": "Set.Forget.Earn stays on Arb. Stock work is additive, not a wrap of Aave.",
                "show": "/dashboard Activate · Type-4 + SRA evidence",
            },
            {
                "n": 3,
                "title": "English basket + oil block",
                "say": "tech yes, oil no — BasketPolicy, not a fake index.",
                "show": "/dashboard?tab=baskets → Preview → Save plan",
            },
            {
                "n": 4,
                "title": "Instrument truth + fragmentation",
                "say": "Same ticker ≠ same instrument. TSLA vs TSLAon vs TSLAx.",
                "show": "Fragmentation desk · verified explorers only",
            },
            {
                "n": 5,
                "title": "Faucet → Activate hold",
                "say": "Browser faucet only. Fail-closed if unfunded — plan ≠ fill.",
                "show": "Claim faucet → Activate hold → /proof RH txs",
                "faucet": "https://faucet.testnet.chain.robinhood.com",
            },
            {
                "n": 6,
                "title": "USDG labeled path",
                "say": "Paxos-verified USDG on Arb + RH mainnet. AXIS does not OFT.",
                "show": "USDG panel + /proof checklist",
            },
            {
                "n": 7,
                "title": "Retention",
                "say": "Weekly English report + policy. Never silent stock fills.",
                "show": "Retention panel · report includes fragmentation warnings",
            },
        ],
        "partner_ops": [
            "Fund AGENT_WALLET on RH testnet via faucet before live demo",
            "Copy agent + UA addresses for judges",
            "Never claim mainnet RH stock fills",
            "If faucet empty: sync-only after user claims to UA",
        ],
    }
