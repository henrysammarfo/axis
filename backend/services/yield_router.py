"""Best-yield router — scan every venue, pick the winner, size it safely.

Given a user's risk level + goal + budget, this scans the live yields across all
AXIS venues and produces ONE risk-adjusted allocation:

  * Aave USDC / Aave USDT  — the stable core (always eligible, lowest risk).
  * Uniswap V3 USDC/USDT   — stable LP, a little market risk (Aggressive + consent).
  * GMX V2 GM ETH/USD      — highest but real market risk (Aggressive + consent).

The router does NOT just chase the top APY (that would dump everything into GMX
and hurt users). Instead it:
  1. keeps the (risk, goal) cash buffer from the strategy matrix,
  2. reserves a stable core and picks USDC vs USDT by the higher live Aave APY,
  3. sizes a bounded "market sleeve" (only for Aggressive + consent) and routes it
     to the higher-APY market venue, capping GMX to a hard sub-share, and
  4. folds any sleeve that's below a venue's minimum back into the stable core,
     so small deposits ($10) stay safe and fully deployed.

Everything here is deterministic given the APYs, so `tests/test_yield_router.py`
can lock the behaviour. Execution stays with the existing signing-free primitives
(Aave deploy, LP open, GMX deposit) — this module only decides amounts.
"""

from __future__ import annotations

import asyncio
from dataclasses import asdict, dataclass
from typing import Any

from services.strategy_engine import (
    GMX_GM_ASSET,
    GMX_GM_PROTOCOL,
    UNISWAP_LP_ASSET,
    UNISWAP_LP_PROTOCOL,
    Goal,
    RiskLevel,
    cash_buffer_pct,
    goal_label,
    parse_goal,
    parse_risk_level,
)
from services.yield_fetcher import YieldFetcher

# Minimums must mirror the route executors in backend/routes/agent.py.
MIN_LP_USDC = 2.0
MIN_GMX_USDC = 5.0

# Venue identifiers (stable string keys the frontend + executors switch on).
VENUE_AAVE_USDC = "aave_usdc"
VENUE_AAVE_USDT = "aave_usdt"
VENUE_UNISWAP_LP = "uniswap_lp"
VENUE_GMX_GM = "gmx_gm"

RISK_STABLE = "stable"
RISK_STABLE_LP = "stable-lp"
RISK_MARKET = "market"

# Max fraction of the DEPLOYED budget the router may route into market-risk venues
# (Uniswap LP + GMX combined). Non-Aggressive tiers get 0 — stable only.
_MARKET_SLEEVE_SHARE: dict[tuple[RiskLevel, Goal], float] = {
    (RiskLevel.AGGRESSIVE, Goal.PROTECT): 0.0,
    (RiskLevel.AGGRESSIVE, Goal.GROW): 0.30,
    (RiskLevel.AGGRESSIVE, Goal.MAXIMIZE): 0.50,
}
# Hard cap on the GMX portion of the DEPLOYED budget (real market risk).
_GMX_SUBCAP_SHARE: dict[Goal, float] = {
    Goal.PROTECT: 0.0,
    Goal.GROW: 0.10,
    Goal.MAXIMIZE: 0.20,
}
_STABLE_APY_EDGE = 0.05  # min APY lead (%) before we surface a USDT-vs-USDC note


@dataclass(frozen=True)
class VenueQuote:
    venue: str
    protocol: str
    asset: str
    apy: float
    risk_tier: str
    eligible: bool
    source: str
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class RouteLeg:
    venue: str
    protocol: str
    asset: str
    action: str
    amount_usdc: float
    share_of_deployed: float
    estimated_apy: float
    risk_tier: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class RoutePlan:
    risk_level: str
    goal: str
    budget_usdc: float
    cash_buffer_usdc: float
    deployed_usdc: float
    legs: tuple[RouteLeg, ...]
    quotes: tuple[VenueQuote, ...]
    blended_apy: float
    estimated_weekly_yield_usdc: float
    market_risk_used: bool
    notes: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "risk_level": self.risk_level,
            "goal": self.goal,
            "budget_usdc": self.budget_usdc,
            "cash_buffer_usdc": self.cash_buffer_usdc,
            "deployed_usdc": self.deployed_usdc,
            "legs": [leg.to_dict() for leg in self.legs],
            "quotes": [q.to_dict() for q in self.quotes],
            "blended_apy": self.blended_apy,
            "estimated_weekly_yield_usdc": self.estimated_weekly_yield_usdc,
            "market_risk_used": self.market_risk_used,
            "notes": list(self.notes),
        }


async def fetch_venue_quotes(*, market_risk_ok: bool) -> list[VenueQuote]:
    """Fetch live APYs across all venues concurrently, tagged with eligibility.

    `market_risk_ok` = (Aggressive tier AND one-time market-risk consent). When
    False, LP/GMX are returned as ineligible (still shown, so the UI can explain
    what unlocking would offer).
    """
    fetcher = YieldFetcher()

    async def _aave(asset: str) -> float:
        try:
            data = await fetcher.get_aave_apy(asset)
            return float(data.get("supply_apy", 0) or 0)
        except Exception:
            return 0.0

    async def _lp() -> tuple[float, str]:
        try:
            data = await fetcher.get_uniswap_apy("USDC", "USDT", fee_tier=100)
            return float(data.get("estimated_apy", 0) or 0), str(data.get("source", "defillama"))
        except Exception:
            return 0.0, "unavailable"

    async def _gmx() -> tuple[float, str]:
        try:
            data = await fetcher.get_gmx_apy()
            # Prefer the top market APY (that's the GM: ETH/USD pool we deposit into).
            apy = float(data.get("top_market_apy") or data.get("apy") or 0)
            return apy, str(data.get("source", "gmx_api"))
        except Exception:
            return 0.0, "unavailable"

    usdc_apy, usdt_apy, (lp_apy, lp_src), (gmx_apy, gmx_src) = await asyncio.gather(
        _aave("USDC"), _aave("USDT"), _lp(), _gmx()
    )

    locked = "Unlock with Aggressive + one-time market-risk OK"
    return [
        VenueQuote(VENUE_AAVE_USDC, "aave", "USDC", round(usdc_apy, 2), RISK_STABLE, True, "aave"),
        VenueQuote(VENUE_AAVE_USDT, "aave", "USDT", round(usdt_apy, 2), RISK_STABLE, True, "aave"),
        VenueQuote(
            VENUE_UNISWAP_LP,
            UNISWAP_LP_PROTOCOL,
            UNISWAP_LP_ASSET,
            round(lp_apy, 2),
            RISK_STABLE_LP,
            market_risk_ok,
            lp_src,
            "" if market_risk_ok else locked,
        ),
        VenueQuote(
            VENUE_GMX_GM,
            GMX_GM_PROTOCOL,
            GMX_GM_ASSET,
            round(gmx_apy, 2),
            RISK_MARKET,
            market_risk_ok,
            gmx_src,
            "" if market_risk_ok else locked,
        ),
    ]


def build_route(
    *,
    risk_level: str | RiskLevel,
    goal: str | Goal,
    budget_usdc: float,
    quotes: list[VenueQuote],
    exclude_venues: set[str] | None = None,
) -> RoutePlan:
    """Turn live venue quotes into one deterministic, risk-adjusted allocation.

    `exclude_venues` lets a power user opt a market venue out of the auto-route
    (e.g. "no GMX"). Excluded venues are treated as ineligible, so their share
    folds back into the stable USDC core — the stable core itself can't be excluded.
    """
    risk = risk_level if isinstance(risk_level, RiskLevel) else parse_risk_level(risk_level)
    goal_e = goal if isinstance(goal, Goal) else parse_goal(goal)
    budget = max(0.0, round(float(budget_usdc), 2))
    excluded = {v.strip().lower() for v in (exclude_venues or set()) if v}

    q = {venue.venue: venue for venue in quotes}
    usdc_apy = q[VENUE_AAVE_USDC].apy if VENUE_AAVE_USDC in q else 0.0
    usdt_apy = q[VENUE_AAVE_USDT].apy if VENUE_AAVE_USDT in q else 0.0
    lp = q.get(VENUE_UNISWAP_LP)
    gmx = q.get(VENUE_GMX_GM)

    buffer_pct = cash_buffer_pct(risk, goal_e)
    cash_buffer = round(budget * buffer_pct, 2)
    deployed = round(budget - cash_buffer, 2)

    notes: list[str] = []
    lp_amt = 0.0
    gmx_amt = 0.0

    # --- Market sleeve (Aggressive + consent only) -------------------------
    sleeve_share = _MARKET_SLEEVE_SHARE.get((risk, goal_e), 0.0)
    lp_ok = bool(lp and lp.eligible and lp.apy > 0) and VENUE_UNISWAP_LP not in excluded
    gmx_ok = bool(gmx and gmx.eligible and gmx.apy > 0) and VENUE_GMX_GM not in excluded
    if VENUE_GMX_GM in excluded and gmx and gmx.eligible:
        notes.append("GMX turned off — routed to the stable core and LP instead.")
    if VENUE_UNISWAP_LP in excluded and lp and lp.eligible:
        notes.append("Stable LP turned off — routed to the stable core and GMX instead.")
    market_sleeve = round(deployed * sleeve_share, 2) if (lp_ok or gmx_ok) else 0.0

    if market_sleeve > 0:
        gmx_cap = round(deployed * _GMX_SUBCAP_SHARE.get(goal_e, 0.0), 2)
        gmx_apy = gmx.apy if gmx_ok else 0.0
        lp_apy = lp.apy if lp_ok else 0.0

        if gmx_ok and gmx_apy > lp_apy:
            gmx_amt = min(market_sleeve, gmx_cap)
            lp_amt = market_sleeve - gmx_amt if lp_ok else 0.0
            notes.append(
                f"GMX leads market APY ({gmx_apy:.2f}% vs LP {lp_apy:.2f}%); "
                f"capped at ${gmx_cap:.2f}."
            )
        elif lp_ok:
            lp_amt = market_sleeve
            notes.append(f"Stable LP leads/ties market APY ({lp_apy:.2f}% vs GMX {gmx_apy:.2f}%).")
        elif gmx_ok:
            gmx_amt = min(market_sleeve, gmx_cap)
            notes.append(f"Only GMX is live; capped at ${gmx_cap:.2f}.")

        # Fold below-minimum sleeves back so nothing dust-fails on-chain.
        if 0 < gmx_amt < MIN_GMX_USDC:
            if lp_ok:
                lp_amt += gmx_amt
            gmx_amt = 0.0
        if 0 < lp_amt < MIN_LP_USDC:
            lp_amt = 0.0

    lp_amt = round(lp_amt, 2)
    gmx_amt = round(gmx_amt, 2)
    stable_core = round(deployed - lp_amt - gmx_amt, 2)

    # --- Stable core → Aave USDC (the gasless, no-signing path) ------------
    # Aave USDT APY is shown for comparison, but USDT supply isn't in the session
    # policy, so the *executable* core stays in USDC (which is always gasless).
    legs: list[RouteLeg] = []
    if stable_core > 0:
        legs.append(
            RouteLeg(
                VENUE_AAVE_USDC, "aave", "USDC", "supply", round(stable_core, 2),
                round(stable_core / deployed, 4) if deployed else 0.0, round(usdc_apy, 2), RISK_STABLE,
            )
        )
        if usdt_apy > usdc_apy + _STABLE_APY_EDGE:
            notes.append(
                f"Aave USDT ({usdt_apy:.2f}%) edges USDC ({usdc_apy:.2f}%), but the "
                "gasless core stays in USDC."
            )

    if lp_amt > 0 and lp:
        legs.append(
            RouteLeg(
                VENUE_UNISWAP_LP, lp.protocol, lp.asset, "open_lp", lp_amt,
                round(lp_amt / deployed, 4) if deployed else 0.0, lp.apy, RISK_STABLE_LP,
            )
        )
    if gmx_amt > 0 and gmx:
        legs.append(
            RouteLeg(
                VENUE_GMX_GM, gmx.protocol, gmx.asset, "deposit_gmx", gmx_amt,
                round(gmx_amt / deployed, 4) if deployed else 0.0, gmx.apy, RISK_MARKET,
            )
        )

    blended = 0.0
    if deployed > 0 and legs:
        blended = sum(leg.amount_usdc * leg.estimated_apy for leg in legs) / deployed
    weekly = round(deployed * blended / 100 / 52, 4) if blended else 0.0

    market_used = lp_amt > 0 or gmx_amt > 0
    notes.insert(
        0,
        f"{goal_label(goal_e)} · {risk.value}: deploy ${deployed:.2f} across "
        f"{len(legs)} venue(s), hold ${cash_buffer:.2f} USDC buffer.",
    )

    return RoutePlan(
        risk_level=risk.value,
        goal=goal_e.value,
        budget_usdc=budget,
        cash_buffer_usdc=cash_buffer,
        deployed_usdc=deployed,
        legs=tuple(legs),
        quotes=tuple(quotes),
        blended_apy=round(blended, 2),
        estimated_weekly_yield_usdc=weekly,
        market_risk_used=market_used,
        notes=tuple(notes),
    )


async def route_best_yield(
    *,
    risk_level: str | RiskLevel,
    goal: str | Goal,
    budget_usdc: float,
    market_risk_ok: bool,
    exclude_venues: set[str] | None = None,
) -> RoutePlan:
    """Fetch live quotes and build the best-yield route in one call."""
    quotes = await fetch_venue_quotes(market_risk_ok=market_risk_ok)
    return build_route(
        risk_level=risk_level,
        goal=goal,
        budget_usdc=budget_usdc,
        quotes=quotes,
        exclude_venues=exclude_venues,
    )
