"""Real DeFi yield data — live sources only, TinyFish when APIs fail."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from web3 import Web3

from chain_config import (
    AAVE_DATA_PROVIDER_BY_CHAIN,
    AAVE_GRAPHQL_URL,
    AAVE_SUPPORTED_SYMBOLS,
    AAVE_UNDERLYING_BY_CHAIN,
    ARBITRUM_ONE_CHAIN_ID,
    ARBITRUM_SEPOLIA_CHAIN_ID,
    chain_label,
    liquidity_rate_to_apy_percent,
)
from config import get_settings

logger = logging.getLogger(__name__)

AAVE_RESERVE_DATA_ABI = [
    {
        "inputs": [{"name": "asset", "type": "address"}],
        "name": "getReserveData",
        "outputs": [
            {"name": "unbacked", "type": "uint256"},
            {"name": "accruedToTreasuryScaled", "type": "uint256"},
            {"name": "totalAToken", "type": "uint256"},
            {"name": "totalStableDebt", "type": "uint256"},
            {"name": "totalVariableDebt", "type": "uint256"},
            {"name": "liquidityRate", "type": "uint256"},
            {"name": "variableBorrowRate", "type": "uint256"},
            {"name": "stableBorrowRate", "type": "uint256"},
            {"name": "averageStableBorrowRate", "type": "uint256"},
            {"name": "liquidityIndex", "type": "uint256"},
            {"name": "variableBorrowIndex", "type": "uint256"},
            {"name": "lastUpdateTimestamp", "type": "uint40"},
        ],
        "stateMutability": "view",
        "type": "function",
    }
]


class YieldDataUnavailable(Exception):
    """Raised when no live yield source returns data."""


class YieldFetcher:
    def __init__(self) -> None:
        self.settings = get_settings()
        if not self.settings.tinyfish_api_key:
            raise RuntimeError("TINYFISH_API_KEY is required for yield data")
        self.chain_id = self.settings.arbitrum_chain_id
        self.chain_name = chain_label(self.chain_id)

    async def get_aave_apy(self, asset: str) -> dict[str, Any]:
        asset = asset.upper()
        if asset not in AAVE_SUPPORTED_SYMBOLS:
            return {"error": f"Asset {asset} not supported on Aave Arbitrum"}

        if asset not in AAVE_UNDERLYING_BY_CHAIN.get(self.chain_id, {}):
            return {"error": f"Asset {asset} not listed on Aave {self.chain_name}"}

        errors: list[str] = []

        if self.chain_id == ARBITRUM_SEPOLIA_CHAIN_ID:
            try:
                return self._fetch_aave_onchain(asset)
            except Exception as exc:
                errors.append(f"aave_onchain: {exc}")
                logger.warning("Aave on-chain read failed: %s", exc)
        else:
            try:
                result = await self._fetch_aave_graphql(asset)
                if result:
                    return result
            except Exception as exc:
                errors.append(f"aave_api: {exc}")
                logger.warning("Aave GraphQL failed: %s", exc)

            try:
                return self._fetch_aave_onchain(asset)
            except Exception as exc:
                errors.append(f"aave_onchain: {exc}")
                logger.warning("Aave on-chain fallback failed: %s", exc)

        scraped = await self._tinyfish_aave_apy(asset)
        if scraped:
            return scraped

        raise YieldDataUnavailable(
            f"Live Aave yield unavailable for {asset}. Errors: {'; '.join(errors)}"
        )

    async def _fetch_aave_graphql(self, asset: str) -> dict[str, Any] | None:
        """AaveKit GraphQL — mainnet chains only (42161 supported, not 421614)."""
        query = """
        query Markets($chainIds: [ChainId!]!) {
          markets(request: { chainIds: $chainIds }) {
            name
            reserves {
              underlyingToken { symbol }
              supplyInfo { apy { value formatted } }
            }
          }
        }
        """
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                AAVE_GRAPHQL_URL,
                json={"query": query, "variables": {"chainIds": [self.chain_id]}},
            )
            r.raise_for_status()
            payload = r.json()

        if payload.get("errors"):
            raise RuntimeError(payload["errors"][0].get("message", "GraphQL error"))

        for market in payload.get("data", {}).get("markets", []):
            for reserve in market.get("reserves", []):
                token = reserve.get("underlyingToken", {})
                symbol = (token.get("symbol") or "").upper()
                if symbol not in {asset, "WETH" if asset == "ETH" else ""}:
                    continue
                apy_info = reserve.get("supplyInfo", {}).get("apy", {})
                apy = float(apy_info.get("value") or apy_info.get("formatted") or 0)
                if apy <= 0:
                    continue
                if apy < 1:
                    apy *= 100
                return {
                    "asset": asset,
                    "supply_apy": round(apy, 2),
                    "protocol": "aave_v3",
                    "chain": self.chain_name,
                    "source": "aave_api",
                }
        return None

    def _fetch_aave_onchain(self, asset: str) -> dict[str, Any]:
        """Read supply APY from Aave ProtocolDataProvider via dedicated RPC."""
        provider_addr = AAVE_DATA_PROVIDER_BY_CHAIN.get(self.chain_id)
        underlying = AAVE_UNDERLYING_BY_CHAIN.get(self.chain_id, {}).get(asset)
        if not provider_addr or not underlying:
            raise RuntimeError(f"No on-chain Aave mapping for {asset} on chain {self.chain_id}")

        w3 = Web3(Web3.HTTPProvider(self.settings.arbitrum_rpc))
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(provider_addr),
            abi=AAVE_RESERVE_DATA_ABI,
        )
        reserve = contract.functions.getReserveData(
            Web3.to_checksum_address(underlying)
        ).call()
        liquidity_rate = int(reserve[5])
        supply_apy = liquidity_rate_to_apy_percent(liquidity_rate)

        return {
            "asset": asset,
            "supply_apy": supply_apy,
            "protocol": "aave_v3",
            "chain": self.chain_name,
            "source": "aave_onchain",
            "liquidity_rate_ray": str(liquidity_rate),
        }

    async def get_gmx_apy(self) -> dict[str, Any]:
        if self.chain_id == ARBITRUM_SEPOLIA_CHAIN_ID:
            scraped = await self._tinyfish_gmx_apy()
            if scraped:
                return scraped
            raise YieldDataUnavailable("GMX APR is not on Arbitrum Sepolia; TinyFish scrape failed")

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
                            "chain": self.chain_name,
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
                                "chain": self.chain_name,
                                "source": "subgraph",
                            }
            except Exception as exc:
                logger.warning("Uniswap subgraph %s failed: %s", url, exc)

        raise YieldDataUnavailable(
            f"Live Uniswap pool data unavailable for {token0}/{token1} fee {fee_tier}"
        )

    async def _tinyfish_aave_apy(self, asset: str) -> dict[str, Any] | None:
        market = (
            "proto_arbitrum_sepolia_v3"
            if self.chain_id == ARBITRUM_SEPOLIA_CHAIN_ID
            else "proto_arbitrum_v3"
        )
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                r = await client.post(
                    "https://agent.tinyfish.ai/v1/automation/run",
                    headers={"X-API-Key": self.settings.tinyfish_api_key},
                    json={
                        "url": f"https://app.aave.com/markets/?marketName={market}",
                        "goal": f'Find the supply APY for {asset} on Arbitrum and return JSON: {{"supply_apy": number}}',
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
                            "chain": self.chain_name,
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
                            "chain": self.chain_name,
                            "risk": "medium",
                            "source": "tinyfish",
                        }
        except Exception as exc:
            logger.warning("TinyFish GMX scrape failed: %s", exc)
        return None
