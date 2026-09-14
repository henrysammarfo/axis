"""Robinhood Chain constants — Open House stock-token work.

New stock work defaults to **public testnet** (46630) and must be labeled in UI/proof.
Existing AXIS yield stays on Arbitrum One (42161).
Docs: https://docs.robinhood.com/chain/
"""

from __future__ import annotations

# Official network IDs (Robinhood Chain docs)
ROBINHOOD_MAINNET_CHAIN_ID = 4663
ROBINHOOD_TESTNET_CHAIN_ID = 46630

RH_PUBLIC_RPC = {
    ROBINHOOD_MAINNET_CHAIN_ID: "https://rpc.mainnet.chain.robinhood.com",
    ROBINHOOD_TESTNET_CHAIN_ID: "https://rpc.testnet.chain.robinhood.com",
}

RH_EXPLORER = {
    ROBINHOOD_MAINNET_CHAIN_ID: "https://robinhoodchain.blockscout.com",
    ROBINHOOD_TESTNET_CHAIN_ID: "https://explorer.testnet.chain.robinhood.com",
}

RH_CHAIN_LABEL = {
    ROBINHOOD_MAINNET_CHAIN_ID: "robinhood-mainnet",
    ROBINHOOD_TESTNET_CHAIN_ID: "robinhood-testnet",
}

# Canonical Stock Token contracts on **testnet** (Robinhood docs / faucet set).
# Mainnet registry is live-generated — do not invent addresses.
RH_TESTNET_STOCK_TOKENS: dict[str, dict[str, str]] = {
    # Canonical testnet Stock Tokens — https://docs.robinhood.com/chain/contracts/
    "TSLA": {
        "address": "0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E",
        "name": "Tesla",
        "sector": "tech",
        "theme": "growth",
    },
    "AMZN": {
        "address": "0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02",
        "name": "Amazon",
        "sector": "tech",
        "theme": "growth",
    },
    "PLTR": {
        "address": "0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0",
        "name": "Palantir",
        "sector": "tech",
        "theme": "growth",
    },
    "NFLX": {
        "address": "0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93",
        "name": "Netflix",
        "sector": "tech",
        "theme": "growth",
    },
    "AMD": {
        "address": "0x71178BAc73cBeb415514eB542a8995b82669778d",
        "name": "AMD",
        "sector": "tech",
        "theme": "growth",
    },
}

# Oil / energy symbols we refuse in “tech yes, oil no” baskets (not on faucet — blocklist).
RH_OIL_BLOCKLIST = frozenset({"XOM", "CVX", "COP", "BP", "SHEL", "OXY", "SLB", "HAL"})


def rh_default_network(*, prefer_testnet: bool = True) -> int:
    """OH doctrine: use public testnet for new stock work unless overridden."""
    return ROBINHOOD_TESTNET_CHAIN_ID if prefer_testnet else ROBINHOOD_MAINNET_CHAIN_ID


def rh_rpc(chain_id: int) -> str:
    return RH_PUBLIC_RPC.get(chain_id, RH_PUBLIC_RPC[ROBINHOOD_TESTNET_CHAIN_ID])


def rh_explorer(chain_id: int) -> str:
    return RH_EXPLORER.get(chain_id, RH_EXPLORER[ROBINHOOD_TESTNET_CHAIN_ID])


def rh_is_testnet(chain_id: int) -> bool:
    return chain_id == ROBINHOOD_TESTNET_CHAIN_ID
