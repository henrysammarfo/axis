"""Instrument truth + fragmentation desk — fail-closed honesty."""

from services.fragmentation import compare_underlying, desk_catalog
from services.instrument_truth import all_instruments, get_instrument, truth_card
from services.retention import normalize_policy, retention_status


def test_verified_tsla_cross_issuer():
    cmp = compare_underlying("TSLA")
    assert cmp["status"] == "ok"
    assert cmp["fungible"] is False
    verified = {i["display_symbol"] for i in cmp["verified_instruments"]}
    assert "TSLA" in verified  # RH testnet
    assert "TSLAon" in verified
    assert "TSLAx" in verified
    routeable = [i for i in cmp["axis_routeable"] if i["axis_routeable"]]
    assert len(routeable) == 1
    assert routeable[0]["program"] == "robinhood_chain_testnet"


def test_unverified_ondo_stub_not_routeable():
    row = get_instrument("ondo_stocks-unverified:AMZNon")
    assert row is not None
    assert row["address_verified"] is False
    assert row["axis_routeable"] is False
    assert row["address"] is None


def test_truth_card_primary_is_rh():
    card = truth_card("AMD")
    assert card["primary_route"]["instrument_id"] == "rh-testnet:AMD"
    assert card["verified_count"] >= 1


def test_desk_catalog_five_underlyings():
    desk = desk_catalog()
    assert len(desk["underlyings"]) == 5


def test_registry_never_marks_share():
    assert all(not i["is_share"] for i in all_instruments())


def test_retention_defaults_report_only():
    pol = normalize_policy({"rebalance_mode": "silent_execute"})
    assert pol["rebalance_mode"] == "report_only"
    st = retention_status(
        policy=pol,
        stock_basket={"legs": [{"symbol": "TSLA"}]},
        rh_holds={"status": "held"},
    )
    assert st["loop"]["retain_ready"] is True
    assert "never silent" in st["honesty"].lower() or "fail-closed" in st["honesty"].lower()
