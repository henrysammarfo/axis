"""Instrument Truth Layer — fail-closed stock-token facts.

Same company ticker ≠ same instrument. AXIS records claim type, issuer, chain,
geo, mint/redeem honesty, and only routes where address_verified is true.

Sources (2026-09-18 research):
- RH testnet faucet contracts: docs.robinhood.com/chain/contracts/
- Ondo TSLAon (Ethereum): 0xf6b1117ec07684D3958caD8BEb1b302bfD21103f (Etherscan / Final Terms)
- Backed TSLAx (Solana): XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB (Backed / Solflare)
"""

from __future__ import annotations

from typing import Any, Literal

from rh_chain import RH_TESTNET_STOCK_TOKENS, ROBINHOOD_TESTNET_CHAIN_ID, rh_explorer

ClaimType = Literal[
    "linked_tracker",
    "broker_stock_token",
    "derivative_note",
    "direct_register",
    "unknown",
]

# Companies AXIS can desk — underlying equity, not a token.
UNDERLYINGS: dict[str, dict[str, Any]] = {
    "TSLA": {
        "name": "Tesla, Inc.",
        "isin": "US88160R1014",
        "sector": "tech",
        "exchange": "NASDAQ",
    },
    "AMZN": {
        "name": "Amazon.com, Inc.",
        "isin": "US0231351067",
        "sector": "tech",
        "exchange": "NASDAQ",
    },
    "PLTR": {
        "name": "Palantir Technologies Inc.",
        "isin": "US69608A1088",
        "sector": "tech",
        "exchange": "NASDAQ",
    },
    "NFLX": {
        "name": "Netflix, Inc.",
        "isin": "US64110L1061",
        "sector": "tech",
        "exchange": "NASDAQ",
    },
    "AMD": {
        "name": "Advanced Micro Devices, Inc.",
        "isin": "US0079031078",
        "sector": "tech",
        "exchange": "NASDAQ",
    },
}


def _rh_leg(symbol: str) -> dict[str, Any] | None:
    meta = RH_TESTNET_STOCK_TOKENS.get(symbol)
    if not meta:
        return None
    addr = meta["address"]
    return {
        "instrument_id": f"rh-testnet:{symbol}",
        "underlying": symbol,
        "display_symbol": symbol,
        "name": meta["name"],
        "issuer": "Robinhood (testnet Stock Token)",
        "program": "robinhood_chain_testnet",
        "claim_type": "broker_stock_token",
        "claim_summary": (
            "Testnet Stock Token for integration — not mainnet equity, not a Nasdaq share."
        ),
        "chain": "robinhood-testnet",
        "chain_id": ROBINHOOD_TESTNET_CHAIN_ID,
        "address": addr,
        "address_verified": True,
        "explorer_url": f"{rh_explorer(ROBINHOOD_TESTNET_CHAIN_ID)}/token/{addr}",
        "docs_url": "https://docs.robinhood.com/chain/contracts/",
        "mint_redeem": "faucet_only",
        "mint_redeem_notes": "Browser faucet only. No AXIS mint path. Fail-closed if unfunded.",
        "geo": {
            "eligible_hint": "Developer testnet — not a retail offer",
            "blocked_hint": "Do not treat as mainnet RH Stock Tokens / Classic EU products",
            "us_persons": "n/a_testnet",
        },
        "weekend_trading": True,
        "is_share": False,
        "testnet": True,
        "axis_routeable": True,
        "honesty": "Labeled public testnet. Plan ≠ fill.",
        "source": "rh_docs_contracts",
        "verified_at": "2026-09-18",
    }


def _ondo_tsla() -> dict[str, Any]:
    addr = "0xf6b1117ec07684D3958caD8BEb1b302bfD21103f"
    return {
        "instrument_id": "ondo-eth:TSLAon",
        "underlying": "TSLA",
        "display_symbol": "TSLAon",
        "name": "Tesla (Ondo Tokenized)",
        "issuer": "Ondo Global Markets",
        "program": "ondo_stocks",
        "claim_type": "linked_tracker",
        "claim_summary": (
            "Debt / tracker instrument (ISIN VGG7001AAK03) giving economic exposure "
            "similar to TSLA with dividend reinvestment — not a Nasdaq share certificate."
        ),
        "chain": "ethereum",
        "chain_id": 1,
        "address": addr,
        "address_verified": True,
        "explorer_url": f"https://etherscan.io/token/{addr}",
        "docs_url": "https://ondo.finance/gm",
        "mint_redeem": "issuer_kyc_usdc",
        "mint_redeem_notes": (
            "Primary mint/redeem via Ondo GMTokenManager + USDon/USDC for eligible non-US users. "
            "AXIS does not mint Ondo — desk is compare-only until a live partner path ships."
        ),
        "geo": {
            "eligible_hint": "Eligible non-US / KYC per Ondo terms",
            "blocked_hint": "US persons and restricted jurisdictions blocked by issuer",
            "us_persons": "typically_blocked",
        },
        "weekend_trading": True,
        "is_share": False,
        "testnet": False,
        "axis_routeable": False,
        "honesty": "Verified Ethereum contract for compare desk — not an AXIS fill venue yet.",
        "source": "etherscan_ondo_final_terms",
        "verified_at": "2026-09-18",
    }


def _xstocks_tsla() -> dict[str, Any]:
    mint = "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB"
    return {
        "instrument_id": "xstocks-sol:TSLAx",
        "underlying": "TSLA",
        "display_symbol": "TSLAx",
        "name": "Tesla xStock",
        "issuer": "Backed Assets (JE) Limited",
        "program": "xstocks",
        "claim_type": "linked_tracker",
        "claim_summary": (
            "Tracker certificate (ISIN CH1436219252) 1:1 backed by custodied TSLA — "
            "economic exposure, not shareholder register entry."
        ),
        "chain": "solana",
        "chain_id": None,
        "address": mint,
        "address_verified": True,
        "explorer_url": f"https://solscan.io/token/{mint}",
        "docs_url": "https://assets.backed.fi/products/tesla-xstock",
        "mint_redeem": "issuer_kyc_primary",
        "mint_redeem_notes": (
            "Primary mint/redeem via Backed (KYC, market hours, minimums). Secondary on Solana DEXs. "
            "AXIS does not execute xStocks — compare-only."
        ),
        "geo": {
            "eligible_hint": "Non-US eligible crypto participants per Backed terms",
            "blocked_hint": "Not available to U.S. persons",
            "us_persons": "blocked",
        },
        "weekend_trading": True,
        "is_share": False,
        "testnet": False,
        "axis_routeable": False,
        "honesty": "Verified Solana mint for fragmentation desk — not fungible with RH or Ondo.",
        "source": "backed_solflare",
        "verified_at": "2026-09-18",
    }


def _issuer_stub(
    *,
    underlying: str,
    display_symbol: str,
    issuer: str,
    program: str,
    claim_type: ClaimType,
    chain: str,
    docs_url: str,
    claim_summary: str,
    geo_us: str,
) -> dict[str, Any]:
    """Known product family without a verified address in AXIS — fail-closed."""
    return {
        "instrument_id": f"{program}-unverified:{display_symbol}",
        "underlying": underlying,
        "display_symbol": display_symbol,
        "name": f"{UNDERLYINGS.get(underlying, {}).get('name', underlying)} ({display_symbol})",
        "issuer": issuer,
        "program": program,
        "claim_type": claim_type,
        "claim_summary": claim_summary,
        "chain": chain,
        "chain_id": None,
        "address": None,
        "address_verified": False,
        "explorer_url": None,
        "docs_url": docs_url,
        "mint_redeem": "unknown",
        "mint_redeem_notes": "Address not verified in AXIS registry — refuse to route or invent fills.",
        "geo": {
            "eligible_hint": "See issuer docs",
            "blocked_hint": "See issuer docs",
            "us_persons": geo_us,
        },
        "weekend_trading": True,
        "is_share": False,
        "testnet": False,
        "axis_routeable": False,
        "honesty": "Issuer product known; contract not verified here — fail-closed.",
        "source": "issuer_docs_unverified_address",
        "verified_at": None,
    }


def all_instruments() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for sym in RH_TESTNET_STOCK_TOKENS:
        leg = _rh_leg(sym)
        if leg:
            out.append(leg)
    out.append(_ondo_tsla())
    out.append(_xstocks_tsla())
    # Known families without verified addresses — still shown on desk as gaps.
    for sym, tip in (
        ("AMZN", ("AMZNon", "https://ondo.finance/gm")),
        ("AMD", ("AMDon", "https://ondo.finance/gm")),
        ("NFLX", ("NFLXon", "https://ondo.finance/gm")),
        ("PLTR", ("PLTRon", "https://ondo.finance/gm")),
    ):
        out.append(
            _issuer_stub(
                underlying=sym,
                display_symbol=tip[0],
                issuer="Ondo Global Markets",
                program="ondo_stocks",
                claim_type="linked_tracker",
                chain="ethereum",
                docs_url=tip[1],
                claim_summary="Ondo Stocks family — economic exposure; address pending AXIS verification.",
                geo_us="typically_blocked",
            )
        )
    for sym, tip in (
        ("AMZN", ("AMZNx", "https://assets.backed.fi/products/amazon-xstock")),
        ("AMD", ("AMDx", "https://assets.backed.fi/products/amd-xstock")),
        ("NFLX", ("NFLXx", "https://assets.backed.fi")),
        ("PLTR", ("PLTRx", "https://assets.backed.fi")),
    ):
        out.append(
            _issuer_stub(
                underlying=sym,
                display_symbol=tip[0],
                issuer="Backed Assets (JE) Limited",
                program="xstocks",
                claim_type="linked_tracker",
                chain="solana",
                docs_url=tip[1],
                claim_summary="xStocks tracker family — address pending AXIS verification.",
                geo_us="blocked",
            )
        )
    return out


def get_instrument(instrument_id: str) -> dict[str, Any] | None:
    for row in all_instruments():
        if row["instrument_id"] == instrument_id:
            return row
    return None


def instruments_for_underlying(symbol: str) -> list[dict[str, Any]]:
    sym = symbol.upper().strip()
    return [row for row in all_instruments() if row["underlying"] == sym]


def truth_card(symbol: str) -> dict[str, Any]:
    """Canonical AXIS-routeable instrument for a company (RH testnet today)."""
    sym = symbol.upper().strip()
    underlying = UNDERLYINGS.get(sym)
    routeable = [i for i in instruments_for_underlying(sym) if i.get("axis_routeable")]
    primary = routeable[0] if routeable else None
    return {
        "underlying": sym,
        "company": underlying,
        "primary_route": primary,
        "instrument_count": len(instruments_for_underlying(sym)),
        "verified_count": sum(
            1 for i in instruments_for_underlying(sym) if i.get("address_verified")
        ),
        "honesty": (
            "AXIS only routes address_verified + axis_routeable instruments. "
            "Other issuer products appear on the fragmentation desk for honesty, not fills."
        ),
    }
