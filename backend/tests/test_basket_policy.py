"""BasketPolicy unit tests — tech yes, oil no."""

from services.basket_policy import build_basket_from_english


def test_tech_yes_oil_no_builds_legs():
    plan = build_basket_from_english("tech yes, oil no", 100)
    assert plan.legs
    assert plan.oil_excluded is True
    assert plan.testnet is True
    assert abs(sum(leg.weight for leg in plan.legs) - 1.0) < 0.02
    assert all(leg.symbol not in {"XOM", "CVX"} for leg in plan.legs)


def test_oil_prompt_blocked():
    plan = build_basket_from_english("only oil and energy majors", 50)
    assert plan.legs == []
    assert "oil" in plan.english_summary.lower()
