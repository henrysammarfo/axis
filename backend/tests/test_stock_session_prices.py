"""Tests for Thursday-close vs after-hours/weekend print honesty."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

try:
    NY = ZoneInfo("America/New_York")
except Exception:
    from datetime import timedelta, timezone

    NY = timezone(timedelta(hours=-4))

from services.stock_session_prices import (
    DualPrice,
    _most_recent_thursday,
    fetch_dual_price,
    format_dual_prices_block,
)


def test_most_recent_thursday_on_weekend():
    # Saturday 2026-09-26 → Thursday 2026-09-24
    assert _most_recent_thursday(datetime(2026, 9, 26, tzinfo=NY).date()).isoformat() == "2026-09-24"


def test_most_recent_thursday_on_thursday():
    assert _most_recent_thursday(datetime(2026, 9, 24, tzinfo=NY).date()).isoformat() == "2026-09-24"


def test_format_dual_prices_block():
    rows = [
        DualPrice(
            symbol="TSLA",
            thursday_close=380.0,
            thursday_date="2026-09-24",
            print_price=381.5,
            print_label="after-hours print",
            print_asof="2026-09-24T18:00:00",
            source="yahoo_chart",
            honesty="RH stock-token after-hours / weekend volume is demand — not the Nasdaq close.",
        )
    ]
    text = format_dual_prices_block(rows)
    assert "TSLA" in text
    assert "Thursday close" in text
    assert "$380.00" in text
    assert "$381.50" in text


def test_fetch_dual_price_fail_closed(monkeypatch):
    def boom(_url: str, timeout: float = 12.0):
        raise TimeoutError("nope")

    monkeypatch.setattr("services.stock_session_prices._http_json", boom)
    row = fetch_dual_price("TSLA", now=datetime(2026, 9, 27, 12, 0, tzinfo=NY))
    assert row.thursday_close is None
    assert row.print_price is None
    assert "not invented" in row.honesty.lower() or "failed" in row.honesty.lower()


def test_fetch_dual_price_weekend_uses_friday_bar(monkeypatch):
    payload = {
        "chart": {
            "result": [
                {
                    "meta": {"regularMarketPrice": 379.0},
                    "timestamp": [
                        1758500000,  # placeholders overridden via patched bars path
                    ],
                    "indicators": {"quote": [{"close": [379.0]}]},
                }
            ]
        }
    }

    # Build real timestamps for Thu 2026-09-24 and Fri 2026-09-25 noon ET
    thu = int(datetime(2026, 9, 24, 16, 0, tzinfo=NY).timestamp())
    fri = int(datetime(2026, 9, 25, 16, 0, tzinfo=NY).timestamp())
    payload["chart"]["result"][0]["timestamp"] = [thu, fri]
    payload["chart"]["result"][0]["indicators"]["quote"][0]["close"] = [380.0, 382.0]

    monkeypatch.setattr("services.stock_session_prices._http_json", lambda *a, **k: payload)
    row = fetch_dual_price("TSLA", now=datetime(2026, 9, 26, 12, 0, tzinfo=NY))  # Sat
    assert row.thursday_close == 380.0
    assert row.print_price == 382.0
    assert "weekend" in row.print_label
