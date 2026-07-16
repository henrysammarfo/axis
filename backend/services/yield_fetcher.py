"""Real DeFi yield data — live sources only, TinyFish when APIs fail."""

from __future__ import annotations

import asyncio
import logging
import time
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
    DEFILLAMA_POOLS_URL,
    GMX_APY_URLS,
    UNISWAP_FEE_POOL_META,
    chain_label,
    liquidity_rate_to_apy_percent,
)
from config import get_settings

logger = logging.getLogger(__name__)

_DEFILLAMA_POOLS_CACHE: tuple[float, list[dict[str, Any]]] | None = None
_DEFILLAMA_CACHE_TTL_SECONDS = 600

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


def _token_aliases(token: str) -> set[str]:
    token = token.upper()
    if token in {"ETH", "WETH"}:
        return {"ETH", "WETH"}
    if token == "USDC":
        return {"USDC", "USDC.E"}
    return {token}


def _symbol_matches_pair(symbol: str, token0: str, token1: str) -> bool:
    parts = [part.strip().upper().split(".")[0] for part in symbol.split("-") if part.strip()]
    if len(parts) < 2:
        return False
    aliases0 = _token_aliases(token0)
    aliases1 = _token_aliases(token1)
    return any(part in aliases0 for part in parts) and any(part in aliases1 for part in parts)


def _parse_gmx_apy_payload(data: dict[str, Any], *, chain_name: str, source: str) -> dict[str, Any] | None:
    markets = data.get("markets", {})
    if not isinstance(markets, dict):
        return None

    apys = sorted(
        (
            float(entry.get("apy", 0) or 0)
            for entry in markets.values()
            if float(entry.get("apy", 0) or 0) > 0
        ),
        reverse=True,
    )
    if not apys:
        return None

    top = apys[:5]
    representative = (sum(top) / len(top)) * 100
    return {
        "protocol": "gmx_gm",
        "apy": round(representative, 2),
        "top_market_apy": round(apys[0] * 100, 2),
        "markets_tracked": len(apys),
        "period": "30d",
        "chain": chain_name,
        "risk": "medium",
        "source": source,
        "note": "GMX v2 GM pool yield (30d APY, average of top 5 markets)",
    }


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
        try:
            return await asyncio.wait_for(self._get_gmx_apy_inner(), timeout=20)
        except TimeoutError as exc:
            raise YieldDataUnavailable("Live GMX yield timed out") from exc

    async def _get_gmx_apy_inner(self) -> dict[str, Any]:
        if self.chain_id == ARBITRUM_SEPOLIA_CHAIN_ID:
            scraped = await self._tinyfish_gmx_apy()
            if scraped:
                return scraped
            raise YieldDataUnavailable("GMX APR is not on Arbitrum Sepolia; TinyFish scrape failed")

        errors: list[str] = []
        for url in GMX_APY_URLS:
            try:
                async with httpx.AsyncClient(timeout=12) as client:
                    response = await client.get(url)
                    if response.status_code != 200:
                        errors.append(f"{url}: HTTP {response.status_code}")
                        continue
                    parsed = _parse_gmx_apy_payload(
                        response.json(),
                        chain_name=self.chain_name,
                        source="gmx_api",
                    )
                    if parsed:
                        return parsed
                    errors.append(f"{url}: empty markets")
            except Exception as exc:
                errors.append(f"{url}: {exc}")
                logger.warning("GMX API failed for %s: %s", url, exc)

        scraped = await self._tinyfish_gmx_apy()
        if scraped:
            return scraped

        raise YieldDataUnavailable(
            f"Live GMX yield unavailable. Errors: {'; '.join(errors)}"
        )

    async def get_uniswap_apy(self, token0: str, token1: str, fee_tier: int = 3000) -> dict[str, Any]:
        if self.chain_id == ARBITRUM_ONE_CHAIN_ID:
            pool = await self._fetch_uniswap_defillama(token0, token1, fee_tier)
            if pool:
                return {
                    "token0": token0.upper(),
                    "token1": token1.upper(),
                    "fee_tier_bps": fee_tier,
                    "estimated_apy": round(float(pool.get("apy", 0)), 2),
                    "tvl_usd": float(pool.get("tvlUsd", 0)),
                    "protocol": "uniswap_v3",
                    "chain": self.chain_name,
                    "source": "defillama",
                    "pool_meta": pool.get("poolMeta"),
                    "symbol": pool.get("symbol"),
                }

        raise YieldDataUnavailable(
            f"Live Uniswap pool data unavailable for {token0}/{token1} fee {fee_tier}"
        )

    async def _get_defillama_pools(self) -> list[dict[str, Any]]:
        global _DEFILLAMA_POOLS_CACHE

        now = time.time()
        if _DEFILLAMA_POOLS_CACHE and now - _DEFILLAMA_POOLS_CACHE[0] < _DEFILLAMA_CACHE_TTL_SECONDS:
            return _DEFILLAMA_POOLS_CACHE[1]

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(DEFILLAMA_POOLS_URL)
            response.raise_for_status()
            pools = response.json().get("data", [])

        _DEFILLAMA_POOLS_CACHE = (now, pools)
        return pools

    async def _fetch_uniswap_defillama(
        self, token0: str, token1: str, fee_tier: int
    ) -> dict[str, Any] | None:
        fee_meta = UNISWAP_FEE_POOL_META.get(fee_tier)
        if not fee_meta:
            return None

        pools = await self._get_defillama_pools()
        matches = [
            pool
            for pool in pools
            if pool.get("chain") == "Arbitrum"
            and pool.get("project") == "uniswap-v3"
            and pool.get("poolMeta") == fee_meta
            and _symbol_matches_pair(str(pool.get("symbol", "")), token0, token1)
        ]
        if not matches:
            return None

        return max(matches, key=lambda pool: float(pool.get("tvlUsd", 0) or 0))

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
            async with httpx.AsyncClient(timeout=12) as client:
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
                            "protocol": "gmx_gm",
                            "apy": apy,
                            "chain": self.chain_name,
                            "risk": "medium",
                            "source": "tinyfish",
                        }
        except Exception as exc:
            logger.warning("TinyFish GMX scrape failed: %s", exc)
        return None
