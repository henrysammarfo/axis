"""Fail-closed RH hold coverage — pure logic (FOLIO-grade honesty)."""

from services.rh_hold import evaluate_coverage


def test_awaiting_faucet_when_empty():
    cov = evaluate_coverage(["TSLA", "AMZN"], {"TSLA": 0, "AMZN": 0})
    assert cov["status"] == "awaiting_faucet"
    assert cov["present"] == []
    assert cov["missing"] == ["TSLA", "AMZN"]


def test_held_when_all_present():
    cov = evaluate_coverage(["TSLA", "AMD"], {"TSLA": 0.01, "AMD": 1.5})
    assert cov["status"] == "held"
    assert cov["coverage"] == 1.0


def test_partial_when_some_missing():
    cov = evaluate_coverage(["TSLA", "AMZN", "PLTR"], {"TSLA": 0.02, "AMZN": 0})
    assert cov["status"] == "partial"
    assert cov["present"] == ["TSLA"]
    assert "AMZN" in cov["missing"] and "PLTR" in cov["missing"]


def test_empty_plan():
    cov = evaluate_coverage([], {})
    assert cov["status"] == "empty_plan"
