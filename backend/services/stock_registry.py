"""Stock-token registry for Robinhood Chain (OH window)."""

from __future__ import annotations

from typing import Any

from rh_chain import (
    RH_TESTNET_STOCK_TOKENS,
    ROBINHOOD_TESTNET_CHAIN_ID,
    rh_default_network,
    rh_explorer,
    rh_is_testnet,
    rh_rpc,
)


def list_stocks(chain_id: int | None = None) -> list[dict[str, Any]]:
    cid = chain_id or rh_default_network()
    # Only testnet canonical set is hard-coded; mainnet must come from live registry later.
    if not rh_is_testnet(cid):
        return []
    out: list[dict[str, Any]] = []
    for symbol, meta in RH_TESTNET_STOCK_TOKENS.items():
        out.append(
            {
                "symbol": symbol,
                "name": meta["name"],
                "address": meta["address"],
                "sector": meta["sector"],
                "theme": meta["theme"],
                "chain_id": cid,
                "network": "robinhood-testnet",
                "explorer_url": f"{rh_explorer(cid)}/token/{meta['address']}",
                "testnet": True,
            }
        )
    return out


def get_stock(symbol: str, chain_id: int | None = None) -> dict[str, Any] | None:
    sym = symbol.upper().strip()
    for row in list_stocks(chain_id):
        if row["symbol"] == sym:
            return row
    return None


def network_status() -> dict[str, Any]:
    cid = rh_default_network()
    return {
        "chain_id": cid,
        "label": "robinhood-testnet",
        "rpc": rh_rpc(cid),
        "explorer": rh_explorer(cid),
        "testnet": True,
        "stock_count": len(list_stocks(cid)),
        "honesty": "New stock work is on Robinhood Chain public testnet until labeled mainnet fills exist.",
    }
