"""BasketPolicy — English prefs → RH stock-token weights.

Deterministic. AI may narrate; it must not invent the mix.
Doctrine: “tech yes, oil no” · OH continuity neobroker.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any

from rh_chain import RH_OIL_BLOCKLIST, RH_TESTNET_STOCK_TOKENS, rh_default_network, rh_is_testnet
from services.stock_registry import get_stock, list_stocks

# Theme keywords → preferred symbols (subset of faucet set).
_TECH_GROWTH = ("NVDA", "AMD", "PLTR", "TSLA", "AMZN", "NFLX", "AAPL", "MSFT", "GOOGL", "META")
_AVAILABLE = tuple(RH_TESTNET_STOCK_TOKENS.keys())  # TSLA AMZN PLTR NFLX AMD

_OIL_WORDS = re.compile(
    r"\b(oil|energy|petroleum|xom|chevron|exxon|fossil|gas\s*major)\b",
    re.I,
)
_TECH_WORDS = re.compile(
    r"\b(tech|software|ai|semiconductor|chip|cloud|growth|nasdaq|faang)\b",
    re.I,
)
_SAFE_WORDS = re.compile(r"\b(safe|defensive|steady|protect|boring|dividend)\b", re.I)
_BOLD_WORDS = re.compile(r"\b(bold|aggressive|max|moon|high\s*risk)\b", re.I)


@dataclass(frozen=True)
class BasketLeg:
    symbol: str
    name: str
    address: str
    weight: float
    sector: str
    explorer_url: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class BasketPlan:
    prompt: str
    theme: str
    oil_excluded: bool
    chain_id: int
    network: str
    testnet: bool
    budget_usdc: float
    legs: list[BasketLeg]
    english_summary: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "prompt": self.prompt,
            "theme": self.theme,
            "oil_excluded": self.oil_excluded,
            "chain_id": self.chain_id,
            "network": self.network,
            "testnet": self.testnet,
            "budget_usdc": self.budget_usdc,
            "legs": [leg.to_dict() for leg in self.legs],
            "english_summary": self.english_summary,
        }


def _pick_symbols(prompt: str) -> tuple[str, list[str]]:
    text = prompt.strip() or "tech yes, oil no"
    oil_hit = bool(_OIL_WORDS.search(text))
    # Explicit oil ask still gets blocked — doctrine.
    if oil_hit and not _TECH_WORDS.search(text):
        theme = "blocked_oil"
    elif _SAFE_WORDS.search(text):
        theme = "steady_tech"
    elif _BOLD_WORDS.search(text):
        theme = "bold_tech"
    else:
        theme = "tech_growth"

    if theme == "blocked_oil":
        return theme, []

    if theme == "steady_tech":
        # Prefer larger, liquid names on the faucet set.
        ordered = [s for s in ("AMZN", "NFLX", "AMD", "TSLA", "PLTR") if s in _AVAILABLE]
    elif theme == "bold_tech":
        ordered = [s for s in ("PLTR", "TSLA", "AMD", "NFLX", "AMZN") if s in _AVAILABLE]
    else:
        ordered = [s for s in ("AMD", "PLTR", "TSLA", "AMZN", "NFLX") if s in _AVAILABLE]

    # Cap basket size
    return theme, ordered[:4]


def _weights(n: int, theme: str) -> list[float]:
    if n <= 0:
        return []
    if n == 1:
        return [1.0]
    if theme == "bold_tech":
        raw = [0.40, 0.25, 0.20, 0.15][:n]
    elif theme == "steady_tech":
        raw = [0.35, 0.30, 0.20, 0.15][:n]
    else:
        raw = [0.30, 0.25, 0.25, 0.20][:n]
    total = sum(raw)
    return [round(x / total, 4) for x in raw]


def build_basket_from_english(
    prompt: str,
    budget_usdc: float = 100.0,
    chain_id: int | None = None,
) -> BasketPlan:
    cid = chain_id or rh_default_network()
    theme, symbols = _pick_symbols(prompt)
    oil_excluded = True

    # Refuse any oil tickers if someone pastes them.
    symbols = [s for s in symbols if s.upper() not in RH_OIL_BLOCKLIST]

    legs: list[BasketLeg] = []
    weights = _weights(len(symbols), theme)
    for sym, w in zip(symbols, weights, strict=False):
        meta = get_stock(sym, cid)
        if not meta:
            continue
        legs.append(
            BasketLeg(
                symbol=sym,
                name=meta["name"],
                address=meta["address"],
                weight=w,
                sector=meta["sector"],
                explorer_url=meta["explorer_url"],
            )
        )

    if theme == "blocked_oil" or not legs:
        summary = (
            "AXIS will not build an oil basket. Try “tech yes, oil no” or name growth tech names."
        )
        return BasketPlan(
            prompt=prompt,
            theme="blocked_oil" if theme == "blocked_oil" else "empty",
            oil_excluded=True,
            chain_id=cid,
            network="robinhood-testnet" if rh_is_testnet(cid) else "robinhood",
            testnet=rh_is_testnet(cid),
            budget_usdc=float(budget_usdc),
            legs=[],
            english_summary=summary,
        )

    parts = [f"{int(leg.weight * 100)}% {leg.symbol}" for leg in legs]
    net = "Robinhood Chain testnet" if rh_is_testnet(cid) else "Robinhood Chain"
    cleaned = prompt.strip().replace('"', "'")
    summary = (
        f"Basket for '{cleaned}': " + ", ".join(parts) + f" on {net}. Oil excluded."
    )
    if budget_usdc > 0:
        summary += f" Target notional ~${budget_usdc:.0f} (plan only until funded)."

    return BasketPlan(
        prompt=prompt,
        theme=theme,
        oil_excluded=oil_excluded,
        chain_id=cid,
        network="robinhood-testnet" if rh_is_testnet(cid) else "robinhood",
        testnet=rh_is_testnet(cid),
        budget_usdc=float(budget_usdc),
        legs=legs,
        english_summary=summary,
    )


def catalog() -> list[dict[str, Any]]:
    return list_stocks()
