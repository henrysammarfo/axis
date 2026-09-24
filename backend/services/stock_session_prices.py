"""Session honesty prices for RH stock reports.

Bible soft (scoutbot AXIS_BIBLE.md): weekly report labels an after-hours /
weekend print and shows Thursday's close next to it. Weekend RH token volume
is demand — not a reason to treat the weekend print as the stock.

Fail-closed: never invent numbers. If a feed fails, mark unavailable.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

try:
    from zoneinfo import ZoneInfo

    NY = ZoneInfo("America/New_York")
except Exception:  # Windows hosts without tzdata
    NY = timezone(timedelta(hours=-4))  # EDT approximation for session honesty

UA = "AXIS-Portfolio-Agent/1.0 (Open House honesty; henry@axis)"


@dataclass
class DualPrice:
    symbol: str
    thursday_close: float | None
    thursday_date: str | None
    print_price: float | None
    print_label: str
    print_asof: str | None
    source: str
    honesty: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _http_json(url: str, timeout: float = 12.0) -> dict[str, Any]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _most_recent_thursday(on: date) -> date:
    # weekday: Mon=0 … Thu=3
    delta = (on.weekday() - 3) % 7
    return on - timedelta(days=delta)


def _bars_from_chart(payload: dict[str, Any]) -> list[tuple[date, float]]:
    result = (payload.get("chart") or {}).get("result") or []
    if not result:
        return []
    block = result[0]
    timestamps = block.get("timestamp") or []
    closes = ((block.get("indicators") or {}).get("quote") or [{}])[0].get("close") or []
    out: list[tuple[date, float]] = []
    for ts, close in zip(timestamps, closes):
        if close is None:
            continue
        d = datetime.fromtimestamp(int(ts), tz=NY).date()
        out.append((d, float(close)))
    return out


def _meta(payload: dict[str, Any]) -> dict[str, Any]:
    result = (payload.get("chart") or {}).get("result") or []
    if not result:
        return {}
    return result[0].get("meta") or {}


def fetch_dual_price(symbol: str, *, now: datetime | None = None) -> DualPrice:
    """Fetch Thursday close + after-hours/weekend (or latest) print for one ticker."""
    sym = symbol.upper().strip()
    now = now or datetime.now(tz=NY)
    today = now.date()
    thursday = _most_recent_thursday(today)
    honesty = (
        "RH stock-token after-hours / weekend volume is demand - not the Nasdaq close. "
        "AXIS shows both so a quiet weekend print is not hidden inside set-and-forget."
    )

    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
        f"?interval=1d&range=1mo&includePrePost=true"
    )
    try:
        payload = _http_json(url)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as exc:
        return DualPrice(
            symbol=sym,
            thursday_close=None,
            thursday_date=thursday.isoformat(),
            print_price=None,
            print_label="unavailable",
            print_asof=None,
            source="none",
            honesty=f"{honesty} Price feed failed ({type(exc).__name__}) — not invented.",
        )

    bars = _bars_from_chart(payload)
    meta = _meta(payload)

    thursday_close: float | None = None
    thursday_date: str | None = thursday.isoformat()
    for d, close in reversed(bars):
        if d == thursday:
            thursday_close = round(close, 4)
            thursday_date = d.isoformat()
            break
    if thursday_close is None:
        # Fail soft: nearest prior Thursday in bars
        for d, close in reversed(bars):
            if d.weekday() == 3 and d <= thursday:
                thursday_close = round(close, 4)
                thursday_date = d.isoformat()
                break

    print_price: float | None = None
    print_label = "unavailable"
    print_asof: str | None = None
    source = "yahoo_chart"

    post = meta.get("postMarketPrice")
    pre = meta.get("preMarketPrice")
    regular = meta.get("regularMarketPrice")
    weekday = today.weekday()  # Mon=0 Sun=6

    if isinstance(post, (int, float)) and float(post) > 0:
        print_price = round(float(post), 4)
        print_label = "after-hours print"
        print_asof = now.isoformat()
    elif weekday >= 5:
        # Weekend: last session bar (typically Friday) as weekend print — not Thursday.
        if bars:
            d, close = bars[-1]
            print_price = round(close, 4)
            print_label = f"weekend session print ({d.strftime('%a')})"
            print_asof = d.isoformat()
    elif isinstance(pre, (int, float)) and float(pre) > 0 and now.hour < 10:
        print_price = round(float(pre), 4)
        print_label = "pre-market print"
        print_asof = now.isoformat()
    elif isinstance(regular, (int, float)) and float(regular) > 0:
        print_price = round(float(regular), 4)
        # During RTH this is the live print; still show next to Thursday close.
        print_label = "session print"
        print_asof = now.isoformat()
    elif bars:
        d, close = bars[-1]
        print_price = round(close, 4)
        print_label = f"last session close ({d.isoformat()})"
        print_asof = d.isoformat()

    if thursday_close is None and print_price is None:
        honesty = f"{honesty} No usable bars for {sym}."

    return DualPrice(
        symbol=sym,
        thursday_close=thursday_close,
        thursday_date=thursday_date,
        print_price=print_price,
        print_label=print_label,
        print_asof=print_asof,
        source=source,
        honesty=honesty,
    )


def dual_prices_for_symbols(
    symbols: list[str],
    *,
    now: datetime | None = None,
    limit: int = 8,
) -> list[DualPrice]:
    seen: set[str] = set()
    out: list[DualPrice] = []
    for raw in symbols:
        sym = str(raw or "").upper().strip()
        if not sym or sym in seen:
            continue
        seen.add(sym)
        out.append(fetch_dual_price(sym, now=now))
        if len(out) >= limit:
            break
    return out


def format_dual_prices_block(rows: list[DualPrice]) -> str:
    if not rows:
        return ""
    lines = ["Stock session honesty (after-hours/weekend print vs Thursday close):"]
    for row in rows:
        thu = (
            f"${row.thursday_close:.2f} ({row.thursday_date})"
            if row.thursday_close is not None
            else "unavailable"
        )
        pr = (
            f"${row.print_price:.2f}"
            if row.print_price is not None
            else "unavailable"
        )
        lines.append(
            f"- {row.symbol}: {row.print_label} {pr} · Thursday close {thu}"
        )
    lines.append(rows[0].honesty)
    return "\n".join(lines)
