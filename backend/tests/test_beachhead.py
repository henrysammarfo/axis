"""Beachhead GTM + packages catalog."""

from services.beachhead import beachhead_pack, evaluate_geo, normalize_region
from services.packages import package_catalog


def test_eu_is_beachhead():
    geo = evaluate_geo("eu")
    assert geo["beachhead"] is True
    assert geo["axis_demo"]["rh_testnet_stocks"] is True


def test_us_gets_restriction_honesty():
    geo = evaluate_geo("us")
    assert geo["beachhead"] is False
    assert "U.S." in geo["gtm_message"] or "US" in geo["gtm_message"]
    assert geo["issuer_hints"]["ondo_xstocks_us_persons"] == "typically_blocked"


def test_normalize_unknown_region():
    assert normalize_region("mars") == "prefer_not"


def test_demo_script_has_faucet_step():
    pack = beachhead_pack()
    steps = pack["demo_script"]["steps"]
    assert any("faucet" in s["title"].lower() or "Faucet" in s["title"] for s in steps)
    assert pack["demo_script"]["duration_min"] >= 5


def test_packages_catalog_no_charges():
    cat = package_catalog()
    assert cat["axis_charges"] is False
    assert cat["status"] == "catalog_only"
    assert any(p["id"] == "tech-yes-oil-no" for p in cat["packages"])
