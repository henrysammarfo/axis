"""x402 autonomous micropayments for market intelligence."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from chain_config import x402_chain_id
from models import X402Spend

logger = logging.getLogger(__name__)

COST_PER_QUERY = 0.001


class IntelligenceUnavailable(Exception):
    """Raised when market intelligence cannot be fetched from any live source."""


class X402Client:
    def __init__(self, agent_wallet_address: str, db: AsyncSession | None = None) -> None:
        self.settings = get_settings()
        self.agent_address = agent_wallet_address
        self.db = db
        self.facilitator_url = self.settings.x402_facilitator_url.rstrip("/")

        if not self.settings.agent_wallet_private_key:
            raise RuntimeError("AGENT_WALLET_PRIVATE_KEY is required for x402 intelligence")
        if not self.settings.venice_api_key:
            raise RuntimeError("VENICE_API_KEY is required for market intelligence fallback")

    async def fetch_intelligence(self, query: str, user_id: str) -> dict[str, Any]:
        if not await self._within_daily_cap(user_id):
            raise IntelligenceUnavailable(
                f"Daily x402 intelligence budget reached (${self.settings.max_x402_spend_usdc_per_day} USDC cap)"
            )

        paid = await self._try_x402_payment(query, user_id)
        if paid:
            return paid

        return await self._venice_web_intelligence(query, user_id)

    async def _try_x402_payment(self, query: str, user_id: str) -> dict[str, Any] | None:
        """Attempt real x402 micropayment via PayAI echo (Sepolia) when facilitator has no route."""
        from services.x402_signer import X402_ECHO_ARBITRUM_SEPOLIA, pay_url

        if self.settings.arbitrum_chain_id == 421614:
            try:
                result = await pay_url(X402_ECHO_ARBITRUM_SEPOLIA)
                settlement = result.get("settlement") or {}
                tx_hash = settlement.get("transaction")
                await self._log_spend(user_id, query, paid=True)
                return {
                    "query": query,
                    "analysis": result.get("body", "")[:500],
                    "signal": "neutral",
                    "recommendation": f"Paid market intel probe for: {query[:120]}",
                    "risk_level": "medium",
                    "paid": True,
                    "source": "x402",
                    "tx_hash": tx_hash,
                    "payer": result.get("payer"),
                }
            except Exception as exc:
                logger.warning("x402 echo payment failed: %s", exc)

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.post(
                    f"{self.facilitator_url}/intelligence",
                    headers={
                        "X-Payment": self._build_payment_header(query),
                        "X-Agent-Address": self.agent_address,
                        "Content-Type": "application/json",
                    },
                    json={
                        "query": query,
                        "user_id": user_id,
                        "chain": x402_chain_id(self.settings.arbitrum_chain_id),
                    },
                )
                if r.status_code == 200:
                    await self._log_spend(user_id, query, paid=True)
                    data = r.json()
                    data["paid"] = True
                    data["source"] = "x402"
                    return data
                if r.status_code == 402:
                    logger.info("x402 payment required — facilitator returned 402")
        except Exception as exc:
            logger.warning("x402 payment failed: %s", exc)
        return None

    async def _venice_web_intelligence(self, query: str, user_id: str) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    f"{self.settings.venice_base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.settings.venice_api_key}"},
                    json={
                        "model": self.settings.venice_model,
                        "messages": [
                            {
                                "role": "user",
                                "content": (
                                    f"Analyze DeFi market conditions for: {query}. "
                                    "Return JSON with signal (bullish/neutral/bearish), "
                                    "recommendation, risk_level."
                                ),
                            }
                        ],
                        "venice_parameters": {"enable_web_search": True},
                    },
                )
                if r.status_code == 200:
                    content = r.json()["choices"][0]["message"]["content"]
                    await self._log_spend(user_id, query, paid=False)
                    return {
                        "query": query,
                        "analysis": content,
                        "signal": "neutral",
                        "recommendation": content[:500],
                        "risk_level": "medium",
                        "source": "venice_web_search",
                        "paid": False,
                    }
        except Exception as exc:
            logger.warning("Venice web intelligence failed: %s", exc)

        raise IntelligenceUnavailable(
            f"Market intelligence unavailable for query: {query[:80]}"
        )

    def _build_payment_header(self, query: str) -> str:
        memo = f"AXIS market intelligence: {query[:50]}"
        chain = x402_chain_id(self.settings.arbitrum_chain_id)
        return f"x402 amount={int(COST_PER_QUERY * 1e6)} currency=USDC chain={chain} memo={memo}"

    async def _within_daily_cap(self, user_id: str) -> bool:
        if not self.db:
            return True
        today = datetime.now(timezone.utc).date()
        result = await self.db.execute(
            select(func.coalesce(func.sum(X402Spend.amount_usdc), 0.0)).where(
                X402Spend.user_id == user_id,
                func.date(X402Spend.created_at) == today,
            )
        )
        spent = float(result.scalar() or 0)
        return spent < self.settings.max_x402_spend_usdc_per_day

    async def _log_spend(self, user_id: str, query: str, paid: bool) -> None:
        if not self.db:
            return
        self.db.add(
            X402Spend(
                user_id=user_id,
                amount_usdc=COST_PER_QUERY if paid else 0.0,
                query=query,
                paid=paid,
            )
        )
        await self.db.flush()

    async def get_spend_summary(self, user_id: str) -> dict[str, Any]:
        if not self.db:
            return {"total_spent_usdc": 0.0, "queries_made": 0}
        result = await self.db.execute(
            select(
                func.coalesce(func.sum(X402Spend.amount_usdc), 0.0),
                func.count(X402Spend.id),
            ).where(X402Spend.user_id == user_id)
        )
        total, count = result.one()
        return {
            "total_spent_usdc": float(total),
            "queries_made": int(count),
            "avg_cost_per_query": COST_PER_QUERY,
        }
