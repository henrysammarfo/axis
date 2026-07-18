"""Unit tests for deterministic risk × goal strategy matrix."""

from __future__ import annotations

import pytest

from services.strategy_engine import (
    Goal,
    MIN_BUDGET_USDC,
    RiskLevel,
    build_plan,
    parse_goal,
    parse_risk_level,
)


LIVE = {"USDC": 4.0, "USDT": 4.5}


@pytest.mark.parametrize(
    "risk,goal",
    [(r, g) for r in RiskLevel for g in Goal],
)
def test_all_nine_cells_sum_to_budget(risk: RiskLevel, goal: Goal):
    plan = build_plan(risk, goal, 100.0, LIVE)
    deployed = sum(leg.amount_usdc for leg in plan.legs)
    assert round(plan.cash_buffer_usdc + deployed, 2) == 100.0
    assert plan.deployed_usdc == pytest.approx(deployed, abs=0.02)
    assert plan.risk_level == risk
    assert plan.goal == goal
    assert plan.blended_apy >= 0
    assert all(leg.protocol == "aave" for leg in plan.legs)
    assert all(leg.action == "supply" for leg in plan.legs)


def test_conservative_protect_is_full_usdc_with_buffer():
    plan = build_plan("conservative", "Protect my money", 100.0, LIVE)
    assert plan.cash_buffer_pct == 0.10
    assert plan.cash_buffer_usdc == 10.0
    assert len(plan.legs) == 1
    assert plan.legs[0].asset == "USDC"
    assert plan.legs[0].amount_usdc == 90.0


def test_aggressive_maximize_prefers_higher_usdt_apy():
    plan = build_plan("aggressive", "Maximize yield", 100.0, {"USDC": 3.0, "USDT": 5.0})
    by_asset = {leg.asset: leg.amount_usdc for leg in plan.legs}
    assert by_asset.get("USDT", 0) >= by_asset.get("USDC", 0)


def test_aggressive_maximize_prefers_higher_usdc_apy():
    plan = build_plan("aggressive", "maximize", 100.0, {"USDC": 6.0, "USDT": 3.0})
    by_asset = {leg.asset: leg.amount_usdc for leg in plan.legs}
    assert by_asset.get("USDC", 0) >= by_asset.get("USDT", 0)


def test_min_budget_enforced():
    with pytest.raises(ValueError, match="at least"):
        build_plan("moderate", "grow", MIN_BUDGET_USDC - 0.01, LIVE)


def test_parse_aliases():
    assert parse_risk_level("Conservative") == RiskLevel.CONSERVATIVE
    assert parse_goal("maximize yield") == Goal.MAXIMIZE
    assert parse_goal("Grow steadily") == Goal.GROW
    with pytest.raises(ValueError):
        parse_risk_level("low")
    with pytest.raises(ValueError):
        parse_goal("moon soon")


def test_small_budget_ten_dollars():
    plan = build_plan("moderate", "grow steadily", 10.0, LIVE)
    assert plan.budget_usdc == 10.0
    assert plan.deployed_usdc + plan.cash_buffer_usdc == pytest.approx(10.0)
