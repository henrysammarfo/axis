"""Lock the best-yield router's allocation logic (deterministic, no network).

We feed hand-built venue quotes into build_route and assert the router:
  * keeps stable-only for conservative/moderate (and when market risk isn't unlocked),
  * routes the market sleeve to the higher-APY venue, capping GMX,
  * folds below-minimum sleeves back into the stable core (safe for $10),
  * always keeps legs summing to the deployed budget.
"""

from __future__ import annotations

from services import yield_router as yr
from services.yield_router import VenueQuote


def _quotes(usdc, usdt, lp, gmx, *, market_ok):
    return [
        VenueQuote(yr.VENUE_AAVE_USDC, "aave", "USDC", usdc, yr.RISK_STABLE, True, "aave"),
        VenueQuote(yr.VENUE_AAVE_USDT, "aave", "USDT", usdt, yr.RISK_STABLE, True, "aave"),
        VenueQuote(yr.VENUE_UNISWAP_LP, "uniswap_v3", "USDC/USDT", lp, yr.RISK_STABLE_LP, market_ok, "defillama"),
        VenueQuote(yr.VENUE_GMX_GM, "gmx_v2", "GM:ETH/USD", gmx, yr.RISK_MARKET, market_ok, "gmx_api"),
    ]


def _by_venue(plan):
    return {leg.venue: leg for leg in plan.legs}


def _assert_legs_sum_to_deployed(plan):
    total = round(sum(leg.amount_usdc for leg in plan.legs), 2)
    assert abs(total - plan.deployed_usdc) <= 0.02, (total, plan.deployed_usdc)


def test_conservative_is_stable_only():
    plan = yr.build_route(
        risk_level="conservative",
        goal="protect",
        budget_usdc=100.0,
        quotes=_quotes(4.0, 3.0, 9.0, 25.0, market_ok=True),  # market APYs high but not eligible tier
    )
    legs = _by_venue(plan)
    assert yr.VENUE_UNISWAP_LP not in legs and yr.VENUE_GMX_GM not in legs
    assert plan.market_risk_used is False
    # 10% buffer for conservative/protect.
    assert plan.cash_buffer_usdc == 10.0 and plan.deployed_usdc == 90.0
    _assert_legs_sum_to_deployed(plan)


def test_moderate_never_touches_market_even_if_unlocked():
    plan = yr.build_route(
        risk_level="moderate",
        goal="maximize",
        budget_usdc=500.0,
        quotes=_quotes(4.0, 5.0, 10.0, 30.0, market_ok=True),
    )
    legs = _by_venue(plan)
    assert yr.VENUE_UNISWAP_LP not in legs and yr.VENUE_GMX_GM not in legs
    assert plan.market_risk_used is False
    _assert_legs_sum_to_deployed(plan)


def test_aggressive_without_consent_is_stable_only():
    plan = yr.build_route(
        risk_level="aggressive",
        goal="maximize",
        budget_usdc=1000.0,
        quotes=_quotes(4.0, 3.0, 12.0, 40.0, market_ok=False),  # not unlocked
    )
    legs = _by_venue(plan)
    assert yr.VENUE_UNISWAP_LP not in legs and yr.VENUE_GMX_GM not in legs
    assert plan.market_risk_used is False
    _assert_legs_sum_to_deployed(plan)


def test_aggressive_maximize_gmx_wins_but_is_capped():
    plan = yr.build_route(
        risk_level="aggressive",
        goal="maximize",
        budget_usdc=1000.0,
        quotes=_quotes(4.0, 3.0, 8.0, 20.0, market_ok=True),
    )
    legs = _by_venue(plan)
    # Aggressive/maximize: 0% buffer, deployed 1000, sleeve 50% = 500, GMX cap 20% = 200.
    assert plan.deployed_usdc == 1000.0
    assert legs[yr.VENUE_GMX_GM].amount_usdc == 200.0  # capped
    assert legs[yr.VENUE_UNISWAP_LP].amount_usdc == 300.0  # sleeve remainder
    assert plan.market_risk_used is True
    # stable core = 500, all in Aave USDC (gasless path; USDT is display-only).
    assert legs[yr.VENUE_AAVE_USDC].amount_usdc == 500.0
    assert yr.VENUE_AAVE_USDT not in legs
    _assert_legs_sum_to_deployed(plan)


def test_aggressive_lp_wins_takes_full_sleeve():
    plan = yr.build_route(
        risk_level="aggressive",
        goal="maximize",
        budget_usdc=1000.0,
        quotes=_quotes(4.0, 3.0, 15.0, 12.0, market_ok=True),  # LP APY > GMX APY
    )
    legs = _by_venue(plan)
    assert legs[yr.VENUE_UNISWAP_LP].amount_usdc == 500.0
    assert yr.VENUE_GMX_GM not in legs  # LP wins, GMX skipped
    _assert_legs_sum_to_deployed(plan)


def test_small_deposit_folds_gmx_back_into_lp():
    # $10 aggressive/maximize: sleeve $5, GMX cap $2 (< $5 min) → folds into LP.
    plan = yr.build_route(
        risk_level="aggressive",
        goal="maximize",
        budget_usdc=10.0,
        quotes=_quotes(4.0, 3.0, 8.0, 25.0, market_ok=True),
    )
    legs = _by_venue(plan)
    assert yr.VENUE_GMX_GM not in legs  # $2 GMX < $5 min → folded away
    assert legs[yr.VENUE_UNISWAP_LP].amount_usdc == 5.0
    _assert_legs_sum_to_deployed(plan)


def test_grow_uses_smaller_sleeve():
    plan = yr.build_route(
        risk_level="aggressive",
        goal="grow",
        budget_usdc=1000.0,
        quotes=_quotes(4.0, 3.0, 9.0, 30.0, market_ok=True),
    )
    legs = _by_venue(plan)
    # grow: sleeve 30% = 300, GMX cap 10% = 100.
    assert legs[yr.VENUE_GMX_GM].amount_usdc == 100.0
    assert legs[yr.VENUE_UNISWAP_LP].amount_usdc == 200.0
    assert legs[yr.VENUE_AAVE_USDC].amount_usdc == 700.0  # stable core, USDC-only
    assert yr.VENUE_AAVE_USDT not in legs
    _assert_legs_sum_to_deployed(plan)


def test_quotes_passed_through_and_blended_apy_positive():
    plan = yr.build_route(
        risk_level="aggressive",
        goal="maximize",
        budget_usdc=1000.0,
        quotes=_quotes(4.0, 3.0, 8.0, 20.0, market_ok=True),
    )
    assert len(plan.quotes) == 4
    assert plan.blended_apy > 0
    d = plan.to_dict()
    assert {"legs", "quotes", "blended_apy", "market_risk_used"} <= set(d.keys())


def test_exclude_gmx_folds_sleeve_into_lp():
    # Power user turns GMX off → its share goes to the (still-eligible) LP.
    plan = yr.build_route(
        risk_level="aggressive",
        goal="maximize",
        budget_usdc=1000.0,
        quotes=_quotes(4.0, 3.0, 8.0, 20.0, market_ok=True),
        exclude_venues={yr.VENUE_GMX_GM},
    )
    legs = _by_venue(plan)
    assert yr.VENUE_GMX_GM not in legs
    assert legs[yr.VENUE_UNISWAP_LP].amount_usdc == 500.0  # full sleeve
    assert legs[yr.VENUE_AAVE_USDC].amount_usdc == 500.0
    _assert_legs_sum_to_deployed(plan)


def test_exclude_both_market_venues_is_stable_only():
    plan = yr.build_route(
        risk_level="aggressive",
        goal="maximize",
        budget_usdc=1000.0,
        quotes=_quotes(4.0, 3.0, 15.0, 40.0, market_ok=True),
        exclude_venues={yr.VENUE_GMX_GM, yr.VENUE_UNISWAP_LP},
    )
    legs = _by_venue(plan)
    assert yr.VENUE_UNISWAP_LP not in legs and yr.VENUE_GMX_GM not in legs
    assert plan.market_risk_used is False
    assert legs[yr.VENUE_AAVE_USDC].amount_usdc == 1000.0
    _assert_legs_sum_to_deployed(plan)


def test_no_market_data_still_deploys_stable():
    # If LP/GMX APYs are 0 (unavailable), sleeve is skipped; stable core = deployed.
    plan = yr.build_route(
        risk_level="aggressive",
        goal="maximize",
        budget_usdc=100.0,
        quotes=_quotes(4.0, 3.0, 0.0, 0.0, market_ok=True),
    )
    legs = _by_venue(plan)
    assert yr.VENUE_UNISWAP_LP not in legs and yr.VENUE_GMX_GM not in legs
    assert plan.market_risk_used is False
    _assert_legs_sum_to_deployed(plan)
