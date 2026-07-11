"""Real DeFi yield data — live sources only, TinyFish when APIs fail."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from config import get_settings

logger = logging.getLogger(__name__)

ARBITRUM_AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD"
AAVE_ASSETS = {
    "USDC": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    "USDT": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    "ETH": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    "WBTC": "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
}


class YieldDataUnavailable(Exception):
    """Raised when no live yield source returns data."""


class YieldFetcher:
    def __init__(self) -> None:
        self.settings = get_settings()
        if not self.settings.tinyfish_api_key:
            raise RuntimeError("TINYFISH_API_KEY is required for yield data")

    async def get_aave_apy(self, asset: str) -> dict[str, Any]:
        asset = asset.upper()
        if asset not in AAVE_ASSETS:
            return {"error": f"Asset {asset} not supported on Aave Arbitrum"}

        errors: list[str] = []

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(
                    "https://api.v3.aave.com/graphql",
                    params={"query": self._aave_query(asset)},
                )
                if r.status_code == 200:
                    reserves = r.json().get("data", {}).get("reserves", [])
                    for reserve in reserves:
                        if reserve.get("symbol", "").upper() == asset:
                            apy = float(reserve.get("supplyAPY", 0) or 0)
                            if apy < 1:
                                apy *= 100
                            return {
                                "asset": asset,
                                "supply_apy": round(apy, 2),
                                "protocol": "aave_v3",
                                "chain": "arbitrum",
                                "source": "aave_api",
                            }
        except Exception as exc:
            errors.append(f"aave_api: {exc}")
            logger.warning("Aave API failed: %s", exc)

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(
                    "https://aave-api-v2.aave.com/data/markets-data",
                    params={"poolId": "arbitrum"},
                )
                if r.status_code == 200:
                    for reserve in r.json().get("reserves", []):
                        if reserve.get("symbol", "").upper() == asset:
                            apy = float(reserve.get("supplyAPY", 0) or 0) * 100
                            return {
                                "asset": asset,
                                "supply_apy": round(apy, 2),
                                "liquidity_usd": reserve.get("totalLiquidity"),
                                "protocol": "aave_v3",
                                "chain": "arbitrum",
                                "source": "aave_legacy_api",
                            }
        except Exception as exc:
            errors.append(f"aave_legacy: {exc}")
            logger.warning("Aave legacy API failed: %s", exc)

        scraped = await self._tinyfish_aave_apy(asset)
        if scraped:
            return scraped

        raise YieldDataUnavailable(
            f"Live Aave yield unavailable for {asset}. Errors: {'; '.join(errors)}"
        )

    async def get_gmx_apy(self) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get("https://arbitrum-api.gmxinfra.io/apr")
                if r.status_code == 200:
                    data = r.json()
                    glp_apr = float(data.get("glp", data.get("glpApr", 0)) or 0)
                    if glp_apr > 0:
                        return {
                            "protocol": "gmx_glp",
                            "apy": round(glp_apr, 2),
                            "chain": "arbitrum",
                            "risk": "medium",
                            "source": "gmx_api",
                            "note": "GLP earns from protocol trading fees",
                        }
        except Exception as exc:
            logger.warning("GMX API failed: %s", exc)

        scraped = await self._tinyfish_gmx_apy()
        if scraped:
            return scraped

        raise YieldDataUnavailable("Live GMX yield unavailable from API and TinyFish")

    async def get_uniswap_apy(self, token0: str, token1: str, fee_tier: int = 3000) -> dict[str, Any]:
        query = """
        query GetPool($token0: String!, $token1: String!, $fee: Int!) {
          pools(where: {
            token0_: {symbol: $token0}
            token1_: {symbol: $token1}
            feeTier: $fee
          }, orderBy: totalValueLockedUSD, orderDirection: desc, first: 1) {
            feeTier
            totalValueLockedUSD
            poolDayData(first: 7, orderBy: date, orderDirection: desc) {
              feesUSD
            }
          }
        }
        """
        subgraphs = [
            "https://api.studio.thegraph.com/query/48347/uniswap-v3-arbitrum/version/latest",
            "https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-minimal",
        ]
        for url in subgraphs:
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    r = await client.post(
                        url,
                        json={
                            "query": query,
                            "variables": {"token0": token0, "token1": token1, "fee": fee_tier},
                        },
                    )
                    if r.status_code == 200:
                        pools = r.json().get("data", {}).get("pools", [])
                        if pools:
                            pool = pools[0]
                            daily_fees = sum(float(d["feesUSD"]) for d in pool.get("poolDayData", []))
                            tvl = float(pool["totalValueLockedUSD"])
                            weekly_apy = (daily_fees / 7 / tvl) * 365 * 100 if tvl > 0 else 0
                            return {
                                "token0": token0,
                                "token1": token1,
                                "fee_tier_bps": fee_tier,
                                "estimated_apy": round(weekly_apy, 2),
                                "tvl_usd": tvl,
                                "protocol": "uniswap_v3",
                                "chain": "arbitrum",
                                "source": "subgraph",
                            }
            except Exception as exc:
                logger.warning("Uniswap subgraph %s failed: %s", url, exc)

        raise YieldDataUnavailable(
            f"Live Uniswap pool data unavailable for {token0}/{token1} fee {fee_tier}"
        )

    async def _tinyfish_aave_apy(self, asset: str) -> dict[str, Any] | None:
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                r = await client.post(
                    "https://agent.tinyfish.ai/v1/automation/run",
                    headers={"X-API-Key": self.settings.tinyfish_api_key},
                    json={
                        "url": "https://app.aave.com/markets/?marketName=proto_arbitrum_v3",
                        "goal": f"Find the supply APY for {asset} on Arbitrum and return JSON: {{\"supply_apy\": number}}",
                    },
                )
                if r.status_code == 200:
                    result = r.json().get("result_json") or r.json().get("result", {})
                    if isinstance(result, str):
                        import json

                        result = json.loads(result)
                    apy = float(result.get("supply_apy", 0))
                    if apy > 0:
                        return {
                            "asset": asset,
                            "supply_apy": apy,
                            "protocol": "aave_v3",
                            "chain": "arbitrum",
                            "source": "tinyfish",
                        }
        except Exception as exc:
            logger.warning("TinyFish Aave scrape failed: %s", exc)
        return None

    async def _tinyfish_gmx_apy(self) -> dict[str, Any] | None:
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                r = await client.post(
                    "https://agent.tinyfish.ai/v1/automation/run",
                    headers={"X-API-Key": self.settings.tinyfish_api_key},
                    json={
                        "url": "https://app.gmx.io/#/earn",
                        "goal": 'Return JSON: {"apy": number} for GLP APR on Arbitrum',
                    },
                )
                if r.status_code == 200:
                    result = r.json().get("result_json") or r.json().get("result", {})
                    if isinstance(result, str):
                        import json

                        result = json.loads(result)
                    apy = float(result.get("apy", 0))
                    if apy > 0:
                        return {
                            "protocol": "gmx_glp",
                            "apy": apy,
                            "chain": "arbitrum",
                            "risk": "medium",
                            "source": "tinyfish",
                        }
        except Exception as exc:
            logger.warning("TinyFish GMX scrape failed: %s", exc)
        return None

    def _aave_query(self, asset: str) -> str:
        return f"""
        {{
          reserves(where: {{symbol: "{asset}"}}) {{
            symbol
            supplyAPY
          }}
        }}
        """
