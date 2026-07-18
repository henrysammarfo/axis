"""Deterministic risk × goal allocation matrix (Aave stables v1).

AI must not invent allocations — only explain a plan built here.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from enum import Enum
from typing import Any


class RiskLevel(str, Enum):
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"


class Goal(str, Enum):
    PROTECT = "protect"
    GROW = "grow"
    MAXIMIZE = "maximize"


# UI / free-text → Goal
_GOAL_ALIASES: dict[str, Goal] = {
    "protect": Goal.PROTECT,
    "protect my money": Goal.PROTECT,
    "preserve capital": Goal.PROTECT,
    "preserve": Goal.PROTECT,
    "grow": Goal.GROW,
    "grow steadily": Goal.GROW,
    "steady yield": Goal.GROW,
    "growth": Goal.GROW,
    "maximize": Goal.MAXIMIZE,
    "maximize yield": Goal.MAXIMIZE,
    "maximum yield": Goal.MAXIMIZE,
    "max yield": Goal.MAXIMIZE,
    "aggressive": Goal.MAXIMIZE,
}


# (risk, goal) → (cash_buffer_pct, usdc_weight_of_deployed, usdt_weight_of_deployed)
# Deployed legs sum to 1.0; cash_buffer is held as undeployed USDC in the wallet.
_MATRIX: dict[tuple[RiskLevel, Goal], tuple[float, float, float]] = {
    (RiskLevel.CONSERVATIVE, Goal.PROTECT): (0.10, 1.00, 0.00),
    (RiskLevel.CONSERVATIVE, Goal.GROW): (0.05, 0.85, 0.15),
    (RiskLevel.CONSERVATIVE, Goal.MAXIMIZE): (0.00, 0.70, 0.30),
    (RiskLevel.MODERATE, Goal.PROTECT): (0.05, 0.90, 0.10),
    (RiskLevel.MODERATE, Goal.GROW): (0.00, 0.60, 0.40),
    (RiskLevel.MODERATE, Goal.MAXIMIZE): (0.00, 0.40, 0.60),
    (RiskLevel.AGGRESSIVE, Goal.PROTECT): (0.00, 0.70, 0.30),
    (RiskLevel.AGGRESSIVE, Goal.GROW): (0.00, 0.40, 0.60),
    (RiskLevel.AGGRESSIVE, Goal.MAXIMIZE): (0.00, 0.20, 0.80),
}

MIN_BUDGET_USDC = 10.0
MIN_LEG_USDC = 0.50  # dust — fold into the larger leg


@dataclass(frozen=True)
class AllocationLeg:
    protocol: str
    asset: str
    action: str
    amount_usdc: float
    weight_of_deployed: float
    estimated_apy: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class AllocationPlan:
    risk_level: RiskLevel
    goal: Goal
    budget_usdc: float
    cash_buffer_usdc: float
    cash_buffer_pct: float
    deployed_usdc: float
    legs: tuple[AllocationLeg, ...]
    blended_apy: float
    estimated_weekly_yield_usdc: float
    notes: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "risk_level": self.risk_level.value,
            "goal": self.goal.value,
            "budget_usdc": self.budget_usdc,
            "cash_buffer_usdc": self.cash_buffer_usdc,
            "cash_buffer_pct": self.cash_buffer_pct,
            "deployed_usdc": self.deployed_usdc,
            "legs": [leg.to_dict() for leg in self.legs],
            "blended_apy": self.blended_apy,
            "estimated_weekly_yield_usdc": self.estimated_weekly_yield_usdc,
            "notes": list(self.notes),
        }


def parse_risk_level(value: str) -> RiskLevel:
    key = (value or "").strip().lower()
    try:
        return RiskLevel(key)
    except ValueError as exc:
        raise ValueError(
            f"Invalid risk_level '{value}'. Use conservative, moderate, or aggressive."
        ) from exc


def parse_goal(value: str) -> Goal:
    key = (value or "").strip().lower()
    if key in _GOAL_ALIASES:
        return _GOAL_ALIASES[key]
    raise ValueError(
        f"Invalid goal '{value}'. Use Protect my money, Grow steadily, or Maximize yield."
    )


def goal_label(goal: Goal) -> str:
    return {
        Goal.PROTECT: "Protect my money",
        Goal.GROW: "Grow steadily",
        Goal.MAXIMIZE: "Maximize yield",
    }[goal]


def build_plan(
    risk_level: str | RiskLevel,
    goal: str | Goal,
    budget_usdc: float,
    live_apys: dict[str, float] | None = None,
) -> AllocationPlan:
    """Build a locked allocation plan from the 3×3 matrix + live Aave APYs."""
    risk = risk_level if isinstance(risk_level, RiskLevel) else parse_risk_level(risk_level)
    goal_e = goal if isinstance(goal, Goal) else parse_goal(goal)

    if budget_usdc < MIN_BUDGET_USDC:
        raise ValueError(f"Budget must be at least ${MIN_BUDGET_USDC:.0f} USDC.")
    if budget_usdc > 100_000:
        raise ValueError("Budget exceeds maximum ($100,000 USDC).")

    apys = {k.upper(): float(v) for k, v in (live_apys or {}).items()}
    usdc_apy = apys.get("USDC", 0.0)
    usdt_apy = apys.get("USDT", 0.0)

    buffer_pct, usdc_w, usdt_w = _MATRIX[(risk, goal_e)]
    notes: list[str] = []

    # Aggressive × maximize: prefer the higher live Aave stable APY for the larger weight.
    if risk == RiskLevel.AGGRESSIVE and goal_e == Goal.MAXIMIZE:
        if usdt_apy > usdc_apy + 0.05:
            usdc_w, usdt_w = 0.20, 0.80
            notes.append(
                f"Maximize tilt: USDT Aave APY ({usdt_apy:.2f}%) leads USDC ({usdc_apy:.2f}%)."
            )
        elif usdc_apy > usdt_apy + 0.05:
            usdc_w, usdt_w = 0.80, 0.20
            notes.append(
                f"Maximize tilt: USDC Aave APY ({usdc_apy:.2f}%) leads USDT ({usdt_apy:.2f}%)."
            )

    cash_buffer = round(budget_usdc * buffer_pct, 2)
    deployed = round(budget_usdc - cash_buffer, 2)

    raw_legs: list[tuple[str, float, float]] = []
    if usdc_w > 0 and deployed > 0:
        raw_legs.append(("USDC", round(deployed * usdc_w, 2), usdc_w))
    if usdt_w > 0 and deployed > 0:
        raw_legs.append(("USDT", round(deployed * usdt_w, 2), usdt_w))

    # Fix rounding so legs sum to deployed.
    if raw_legs:
        leg_sum = sum(a for _, a, _ in raw_legs)
        delta = round(deployed - leg_sum, 2)
        if delta != 0:
            asset, amount, weight = raw_legs[0]
            raw_legs[0] = (asset, round(amount + delta, 2), weight)

    # Fold dust legs into the largest leg.
    filtered: list[tuple[str, float, float]] = []
    dust = 0.0
    for asset, amount, weight in raw_legs:
        if amount < MIN_LEG_USDC:
            dust += amount
        else:
            filtered.append((asset, amount, weight))
    if dust and filtered:
        asset, amount, weight = max(filtered, key=lambda x: x[1])
        idx = filtered.index((asset, amount, weight))
        filtered[idx] = (asset, round(amount + dust, 2), weight)
    elif dust and not filtered and deployed >= MIN_LEG_USDC:
        filtered = [("USDC", round(deployed, 2), 1.0)]

    legs: list[AllocationLeg] = []
    for asset, amount, weight in filtered:
        if amount <= 0:
            continue
        apy = usdc_apy if asset == "USDC" else usdt_apy
        legs.append(
            AllocationLeg(
                protocol="aave",
                asset=asset,
                action="supply",
                amount_usdc=amount,
                weight_of_deployed=round(weight, 4),
                estimated_apy=round(apy, 4),
            )
        )

    if not legs and deployed > 0:
        raise ValueError("Strategy produced no deployable legs for this budget.")

    blended = 0.0
    if deployed > 0 and legs:
        blended = sum(leg.amount_usdc * leg.estimated_apy for leg in legs) / deployed

    weekly = round(deployed * blended / 100 / 52, 4) if blended else 0.0

    notes.append(
        f"{goal_label(goal_e)} · {risk.value}: "
        f"deploy ${deployed:.2f} to Aave stables, hold ${cash_buffer:.2f} USDC buffer."
    )

    return AllocationPlan(
        risk_level=risk,
        goal=goal_e,
        budget_usdc=round(budget_usdc, 2),
        cash_buffer_usdc=cash_buffer,
        cash_buffer_pct=buffer_pct,
        deployed_usdc=deployed,
        legs=tuple(legs),
        blended_apy=round(blended, 4),
        estimated_weekly_yield_usdc=weekly,
        notes=tuple(notes),
    )


def preview_matrix_cell(
    risk_level: str,
    goal: str,
    budget_usdc: float,
    live_apys: dict[str, float] | None = None,
) -> dict[str, Any]:
    return build_plan(risk_level, goal, budget_usdc, live_apys).to_dict()


# Uniswap V3 USDC/USDT stable LP — the one market-risk option (Aggressive + consent).
UNISWAP_LP_PROTOCOL = "uniswap_v3"
UNISWAP_LP_ASSET = "USDC/USDT"
# Suggested share of the deployed budget to route into the LP, by aggressive goal.
_LP_SUGGESTED_SHARE: dict[Goal, float] = {
    Goal.PROTECT: 0.0,  # protect stays fully in stable Aave
    Goal.GROW: 0.25,
    Goal.MAXIMIZE: 0.40,
}


def recommend_lp_usdc(risk_level: str | RiskLevel, goal: str | Goal, budget_usdc: float) -> float:
    """Suggested USDC to route into the stable LP (Aggressive tier only; 0 otherwise)."""
    risk = risk_level if isinstance(risk_level, RiskLevel) else parse_risk_level(risk_level)
    goal_e = goal if isinstance(goal, Goal) else parse_goal(goal)
    if risk != RiskLevel.AGGRESSIVE:
        return 0.0
    share = _LP_SUGGESTED_SHARE.get(goal_e, 0.0)
    return round(max(0.0, budget_usdc) * share, 2)


# GMX V2 GM ETH/USD pool — a Pro, user-signed market-risk strategy (Aggressive +
# consent). Higher yield than stable LP, but real exposure to the pool's PnL.
GMX_GM_PROTOCOL = "gmx_v2"
GMX_GM_ASSET = "GM:ETH/USD"
# Conservative default share of the deployed budget to route into GMX, by goal.
_GMX_SUGGESTED_SHARE: dict[Goal, float] = {
    Goal.PROTECT: 0.0,
    Goal.GROW: 0.10,
    Goal.MAXIMIZE: 0.20,
}


def recommend_gmx_usdc(risk_level: str | RiskLevel, goal: str | Goal, budget_usdc: float) -> float:
    """Suggested USDC to route into the GMX GM pool (Aggressive tier only; 0 otherwise)."""
    risk = risk_level if isinstance(risk_level, RiskLevel) else parse_risk_level(risk_level)
    goal_e = goal if isinstance(goal, Goal) else parse_goal(goal)
    if risk != RiskLevel.AGGRESSIVE:
        return 0.0
    share = _GMX_SUGGESTED_SHARE.get(goal_e, 0.0)
    return round(max(0.0, budget_usdc) * share, 2)


# Power-user custom strategies: bounded to vetted, non-suicidal building blocks.
CUSTOM_ALLOWED_ASSETS = frozenset({"USDC", "USDT"})
CUSTOM_ALLOWED_PROTOCOLS = frozenset({"aave"})
CUSTOM_MAX_LEGS = 4


def validate_custom_legs(legs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Validate a custom strategy against the allowlist. Raises ValueError on any violation."""
    if not legs:
        raise ValueError("Add at least one strategy leg.")
    if len(legs) > CUSTOM_MAX_LEGS:
        raise ValueError(f"Too many legs (max {CUSTOM_MAX_LEGS}).")

    clean: list[dict[str, Any]] = []
    seen_assets: set[str] = set()
    total = 0.0
    for leg in legs:
        protocol = str(leg.get("protocol", "aave")).strip().lower()
        asset = str(leg.get("asset", "")).strip().upper()
        try:
            weight = float(leg.get("weight_pct", 0))
        except (TypeError, ValueError) as exc:
            raise ValueError("Each leg needs a numeric weight_pct.") from exc

        if protocol not in CUSTOM_ALLOWED_PROTOCOLS:
            raise ValueError(f"Protocol '{protocol}' is not allowed. Use: aave.")
        if asset not in CUSTOM_ALLOWED_ASSETS:
            raise ValueError(f"Asset '{asset}' is not allowed. Use: USDC, USDT.")
        if asset in seen_assets:
            raise ValueError(f"Duplicate asset '{asset}'. Combine weights into one leg.")
        if weight <= 0 or weight > 100:
            raise ValueError("Each weight_pct must be between 0 and 100.")

        seen_assets.add(asset)
        total += weight
        clean.append({"protocol": protocol, "asset": asset, "weight_pct": round(weight, 4)})

    if abs(total - 100.0) > 0.01:
        raise ValueError(f"Weights must sum to 100% (got {total:.2f}%).")
    return clean


def build_plan_from_custom(
    legs: list[dict[str, Any]],
    budget_usdc: float,
    live_apys: dict[str, float] | None = None,
    risk_level: str | RiskLevel = RiskLevel.MODERATE,
    goal: str | Goal = Goal.MAXIMIZE,
) -> AllocationPlan:
    """Build a fully-deployed plan from validated custom legs (no cash buffer)."""
    clean = validate_custom_legs(legs)

    if budget_usdc < MIN_BUDGET_USDC:
        raise ValueError(f"Budget must be at least ${MIN_BUDGET_USDC:.0f} USDC.")
    if budget_usdc > 100_000:
        raise ValueError("Budget exceeds maximum ($100,000 USDC).")

    risk = risk_level if isinstance(risk_level, RiskLevel) else parse_risk_level(risk_level)
    goal_e = goal if isinstance(goal, Goal) else parse_goal(goal)

    apys = {k.upper(): float(v) for k, v in (live_apys or {}).items()}
    deployed = round(budget_usdc, 2)

    raw_legs: list[tuple[str, float, float]] = [
        (leg["asset"], round(deployed * leg["weight_pct"] / 100.0, 2), leg["weight_pct"] / 100.0)
        for leg in clean
    ]

    # Fix rounding so legs sum to deployed.
    leg_sum = sum(a for _, a, _ in raw_legs)
    delta = round(deployed - leg_sum, 2)
    if delta != 0 and raw_legs:
        asset, amount, weight = raw_legs[0]
        raw_legs[0] = (asset, round(amount + delta, 2), weight)

    legs_out: list[AllocationLeg] = []
    for asset, amount, weight in raw_legs:
        if amount < MIN_LEG_USDC:
            continue
        apy = apys.get(asset, 0.0)
        legs_out.append(
            AllocationLeg(
                protocol="aave",
                asset=asset,
                action="supply",
                amount_usdc=amount,
                weight_of_deployed=round(weight, 4),
                estimated_apy=round(apy, 4),
            )
        )

    if not legs_out:
        raise ValueError("Custom strategy produced no deployable legs for this budget.")

    blended = sum(leg.amount_usdc * leg.estimated_apy for leg in legs_out) / deployed
    weekly = round(deployed * blended / 100 / 52, 4) if blended else 0.0

    notes = (
        "Custom strategy: "
        + ", ".join(f"{leg.asset} {leg.weight_of_deployed * 100:.0f}%" for leg in legs_out)
        + f" · deploy ${deployed:.2f} to Aave.",
    )

    return AllocationPlan(
        risk_level=risk,
        goal=goal_e,
        budget_usdc=deployed,
        cash_buffer_usdc=0.0,
        cash_buffer_pct=0.0,
        deployed_usdc=deployed,
        legs=tuple(legs_out),
        blended_apy=round(blended, 4),
        estimated_weekly_yield_usdc=weekly,
        notes=notes,
    )
