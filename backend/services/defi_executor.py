"""DeFi protocol execution on Arbitrum via Universal Account + ZeroDev."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx
from web3 import Web3

from config import get_settings
from chain_config import chain_label
from services.yield_fetcher import YieldFetcher

logger = logging.getLogger(__name__)

AAVE_POOL_ADDRESS = "0x794a61358D6845594F94dc1DB02A252b5b4814aD"


class DeFiExecutor:
    def __init__(self, user_ua_address: str) -> None:
        self.settings = get_settings()

        if user_ua_address:
            if not self.settings.wallet_configured:
                raise RuntimeError(
                    "Wallet stack not configured. Set Magic, Particle, and Google OAuth keys."
                )
            if not self.settings.zerodev_configured:
                raise RuntimeError(
                    "ZeroDev not configured. Set ZERODEV_PROJECT_ID and ZERODEV_RPC_URL."
                )
            self.user_address = Web3.to_checksum_address(user_ua_address)
        else:
            self.user_address = ""

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
        if not self.user_address:
            return {
                "success": False,
                "error": "ua_address required for on-chain execution",
                "protocol": protocol,
                "asset": asset,
                "amount_usdc": amount_usdc,
                "action": action,
            }

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

        tx_result = await self._execute_onchain(protocol, asset, amount_usdc, action)
        if tx_result.get("success") and tx_result.get("tx_hash"):
            return {
                **tx_result,
                "estimated_daily_yield_usdc": round(daily_yield, 4),
                "estimated_apy": estimated_apy,
                "executed_via": "Particle Universal Account + ZeroDev",
                "gas_paid_by_user": False,
                "timestamp": int(time.time()),
            }

        return {
            "success": False,
            "error": tx_result.get(
                "error",
                "On-chain execution failed. Sign via Particle UA or check ZeroDev gas policy.",
            ),
            "protocol": protocol,
            "asset": asset,
            "amount_usdc": amount_usdc,
            "action": action,
            "pending_client_signature": tx_result.get("pending_client_signature", False),
        }

    async def _estimate_apy(self, protocol: str, asset: str) -> float:
        if protocol == "aave":
            data = await self.get_aave_apy(asset)
            if "error" in data:
                raise RuntimeError(data["error"])
            return float(data.get("supply_apy", 0))
        if protocol == "gmx":
            data = await self.get_gmx_apy()
            return float(data.get("apy", 0))
        if protocol == "uniswap":
            parts = asset.split("-") if "-" in asset else [asset, "USDC"]
            data = await self.get_uniswap_apy(parts[0], parts[1] if len(parts) > 1 else "USDC")
            return float(data.get("estimated_apy", 0))
        raise RuntimeError(f"Unknown protocol for APY estimate: {protocol}")

    async def _execute_onchain(
        self, protocol: str, asset: str, amount_usdc: float, action: str
    ) -> dict[str, Any]:
        bundler = self.settings.effective_zerodev_bundler.rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                payload = {
                    "owner": self.user_address,
                    "protocol": protocol,
                    "asset": asset,
                    "amount_usdc": amount_usdc,
                    "action": action,
                    "chain_id": self.settings.arbitrum_chain_id,
                    "zerodev_project_id": self.settings.zerodev_project_id,
                }
                r = await client.post(
                    f"{bundler}/axis/execute",
                    json=payload,
                    headers={
                        "X-AXIS-Internal": "1",
                        "X-ZeroDev-Project-Id": self.settings.zerodev_project_id,
                    },
                )
                if r.status_code == 200:
                    data = r.json()
                    if data.get("tx_hash"):
                        return {
                            "success": True,
                            "protocol": protocol,
                            "asset": asset,
                            "amount_usdc": amount_usdc,
                            "action": action,
                            "tx_hash": data["tx_hash"],
                            "chain": chain_label(self.settings.arbitrum_chain_id),
                        }
        except Exception as exc:
            logger.warning("ZeroDev execution relay failed: %s", exc)

        try:
            block = self.w3.eth.block_number
            if block <= 0:
                raise RuntimeError("Arbitrum RPC returned invalid block number")
        except Exception as exc:
            return {"success": False, "error": f"Arbitrum RPC unavailable: {exc}"}

        return {
            "success": False,
            "pending_client_signature": True,
            "error": "Execution queued — client must sign via Particle UA + ZeroDev",
            "protocol": protocol,
            "asset": asset,
            "amount_usdc": amount_usdc,
            "action": action,
            "chain": chain_label(self.settings.arbitrum_chain_id),
        }
