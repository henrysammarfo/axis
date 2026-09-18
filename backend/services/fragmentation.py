"""Fragmentation Desk — same company, many instruments, fail-closed compare."""

from __future__ import annotations

from typing import Any

from services.instrument_truth import UNDERLYINGS, instruments_for_underlying, truth_card


def _diff_fields(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    keys = (
        "claim_type",
        "issuer",
        "chain",
        "mint_redeem",
        "testnet",
        "axis_routeable",
        "address_verified",
        "is_share",
    )
    diffs: list[dict[str, Any]] = []
    for key in keys:
        values = {str(r.get(key)) for r in rows}
        if len(values) > 1:
            diffs.append(
                {
                    "field": key,
                    "values": [
                        {
                            "instrument_id": r["instrument_id"],
                            "display_symbol": r["display_symbol"],
                            "value": r.get(key),
                        }
                        for r in rows
                    ],
                }
            )
    return diffs


def compare_underlying(symbol: str) -> dict[str, Any]:
    sym = symbol.upper().strip()
    if sym not in UNDERLYINGS:
        return {
            "status": "unknown_underlying",
            "underlying": sym,
            "instruments": [],
            "warnings": [f"{sym} is not on the AXIS desk underlyings set."],
            "fungible": False,
            "axis_action": "refuse",
            "honesty": "Fail-closed: unknown company — no invented instruments.",
        }

    instruments = instruments_for_underlying(sym)
    verified = [i for i in instruments if i.get("address_verified")]
    routeable = [i for i in instruments if i.get("axis_routeable")]
    warnings: list[str] = [
        "Instruments are NOT fungible — do not average prices or bridge as if identical.",
        "None of these tokens is a Nasdaq share certificate (is_share=false).",
    ]
    if any(i.get("geo", {}).get("us_persons") in ("blocked", "typically_blocked") for i in instruments):
        warnings.append("At least one issuer product blocks or restricts U.S. persons.")
    if any(i.get("weekend_trading") for i in instruments):
        warnings.append(
            "24/7 token markets can diverge from Nasdaq when the cash equity is closed."
        )
    unverified = [i for i in instruments if not i.get("address_verified")]
    if unverified:
        warnings.append(
            f"{len(unverified)} issuer product(s) lack a verified address in AXIS — shown as gaps only."
        )

    return {
        "status": "ok",
        "underlying": sym,
        "company": UNDERLYINGS[sym],
        "instruments": instruments,
        "verified_instruments": verified,
        "axis_routeable": routeable,
        "diffs": _diff_fields(instruments),
        "fungible": False,
        "axis_action": "route_rh_testnet_only" if routeable else "compare_only",
        "primary_route": truth_card(sym).get("primary_route"),
        "warnings": warnings,
        "honesty": (
            "Fragmentation desk is read-only compare. AXIS fills only RH public testnet "
            "routeable legs after Activate hold — never invents Ondo/xStocks fills."
        ),
    }


def desk_catalog() -> dict[str, Any]:
    underlyings = sorted(UNDERLYINGS.keys())
    return {
        "underlyings": [
            {
                "symbol": s,
                "name": UNDERLYINGS[s]["name"],
                "instrument_count": len(instruments_for_underlying(s)),
                "verified_count": sum(
                    1 for i in instruments_for_underlying(s) if i.get("address_verified")
                ),
            }
            for s in underlyings
        ],
        "honesty": (
            "Desk covers the RH faucet tech set. Verified cross-issuer contracts today: "
            "TSLA → RH testnet + TSLAon (ETH) + TSLAx (Solana)."
        ),
    }
