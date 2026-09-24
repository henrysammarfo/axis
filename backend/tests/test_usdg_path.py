"""USDG labeled path — Paxos-verified, AXIS does not execute."""

from services.liquidity_rails import liquidity_rails
from services.usdg_path import (
    USDG_ARBITRUM,
    USDG_ROBINHOOD_MAINNET,
    usdg_path,
)


def test_usdg_addresses_verified():
    path = usdg_path()
    assert path["axis_executes"] is False
    by_id = {leg["id"]: leg for leg in path["legs"]}
    assert by_id["usdg-arbitrum"]["address"] == USDG_ARBITRUM
    assert by_id["usdg-arbitrum"]["address_verified"] is True
    assert by_id["usdg-rh-mainnet"]["address"] == USDG_ROBINHOOD_MAINNET
    assert by_id["usdg-rh-mainnet"]["address_verified"] is True
    assert by_id["usdg-lz-oft"]["address_verified"] is True


def test_no_fake_testnet_usdg():
    path = usdg_path()
    testnet = next(leg for leg in path["legs"] if leg["id"] == "rh-testnet-stocks")
    assert testnet["address"] is None
    assert "NOT claimed on testnet" in testnet["notes"] or "not" in testnet["notes"].lower()


def test_rails_include_usdg_rail():
    rails = liquidity_rails()
    ids = {r["id"] for r in rails["rails"]}
    assert "usdg-arb-rh" in ids
    assert rails["usdg"]["axis_executes"] is False
    assert any(s.lower().startswith("show usdg") for s in rails["demo_path"])


def test_path_steps_mark_executable_honestly():
    path = usdg_path()
    live = [s for s in path["path_steps"] if s["executable_today"]]
    labeled = [s for s in path["path_steps"] if not s["executable_today"]]
    assert len(live) >= 2  # Arb yield + RH testnet stocks
    assert len(labeled) >= 2  # USDG acquire + OFT
    assert any("bridge" in r.lower() or "oft" in r.lower() for r in path["refuse"])
