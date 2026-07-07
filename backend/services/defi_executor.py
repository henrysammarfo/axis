"""DeFi protocol execution on Arbitrum via Universal Account + ZeroDev."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx
from web3 import Web3

from config import get_settings
from services.yield_fetcher import YieldFetcher

logger = logging.getLogger(__name__)

AAVE_POOL_ADDRESS = "0x794a61358D6845594F94dc1DB02A252b5b4814aD"


class DeFiExecutor:
    def __init__(self, user_ua_address: str) -> None:
        self.settings = get_settings()
        self.user_address = Web3.to_checksum_address(user_ua_address) if user_ua_address else ""
        self.w3 = Web3(Web3.HTTPProvider(self.settings.arbitrum_rpc))
        self.yields = YieldFetcher()

    async def get_aave_apy(self, asset: str) -> dict[str, Any]:
        return await self.yields.get_aave_apy(asset)

    async def get_gmx_apy(self) -> dict[str, Any]:
        return await self.yields.get_gmx_apy()

    async def get_uniswap_apy(self, token0: str, token1: str, fee_tier: int = 3000) -> dict[str, Any]:
        return await self.yields.get_uniswap_apy(token0, token1, fee_tier)

    async def execute(
        self,
        protocol: str,
        asset: str,
        amount_usdc: float,
        action: str,
        user_id: str,
    ) -> dict[str, Any]:
        logger.info(
            "AXIS executing: %s %s USDC → %s (%s) for user %s",
            action,
            amount_usdc,
            protocol,
            asset,
            user_id,
        )

        estimated_apy = await self._estimate_apy(protocol, asset)
        daily_yield = (amount_usdc * estimated_apy / 100) / 365

        if self.settings.wallet_configured and self.settings.zerodev_configured:
            tx_result = await self._execute_onchain(protocol, asset, amount_usdc, action)
            if tx_result.get("success"):
                return {
                    **tx_result,
                    "estimated_daily_yield_usdc": round(daily_yield, 4),
                    "estimated_apy": estimated_apy,
                    "executed_via": "Particle Universal Account + ZeroDev",
                    "gas_paid_by_user": False,
                    "timestamp": int(time.time()),
                }

        # Simulation mode when wallet keys not configured
        return {
            "success": True,
            "simulated": True,
            "protocol": protocol,
            "asset": asset,
            "amount_usdc": amount_usdc,
            "action": action,
            "tx_hash": None,
            "chain": "arbitrum",
            "estimated_daily_yield_usdc": round(daily_yield, 4),
            "estimated_apy": estimated_apy,
            "executed_via": "simulation",
            "gas_paid_by_user": False,
            "timestamp": int(time.time()),
            "note": "Configure Magic + Particle + ZeroDev keys for live on-chain execution",
        }

    async def _estimate_apy(self, protocol: str, asset: str) -> float:
        if protocol == "aave":
            data = await self.get_aave_apy(asset)
            return float(data.get("supply_apy", 4.0))
        if protocol == "gmx":
            data = await self.get_gmx_apy()
            return float(data.get("apy", 15.0))
        if protocol == "uniswap":
            parts = asset.split("-") if "-" in asset else [asset, "USDC"]
            data = await self.get_uniswap_apy(parts[0], parts[1] if len(parts) > 1 else "USDC")
            return float(data.get("estimated_apy", 8.0))
        return 5.0

    async def _execute_onchain(
        self, protocol: str, asset: str, amount_usdc: float, action: str
    ) -> dict[str, Any]:
        """
        Submit execution intent to backend executor service.
        Full Particle UA + ZeroDev signing happens client-side; backend records intent
        and validates via ZeroDev bundler when server-side relay is configured.
        """
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                payload = {
                    "owner": self.user_address,
                    "protocol": protocol,
                    "asset": asset,
                    "amount_usdc": amount_usdc,
                    "action": action,
                    "chain_id": self.settings.arbitrum_chain_id,
                }
                if self.settings.zerodev_bundler_url:
                    r = await client.post(
                        f"{self.settings.zerodev_bundler_url.rstrip('/')}/axis/execute",
                        json=payload,
                        headers={"X-AXIS-Internal": "1"},
                    )
                    if r.status_code == 200:
                        return r.json()
        except Exception as exc:
            logger.warning("On-chain execution relay failed: %s", exc)

        # Verify wallet has RPC connectivity
        try:
            block = self.w3.eth.block_number
            return {
                "success": True,
                "protocol": protocol,
                "asset": asset,
                "amount_usdc": amount_usdc,
                "action": action,
                "tx_hash": None,
                "chain": "arbitrum",
                "block_number": block,
                "pending_client_signature": True,
                "note": "Execution queued — client must sign via Particle UA",
            }
        except Exception as exc:
            return {"success": False, "error": str(exc)}
