"""AXIS AI agent — explains locked StrategyEngine plans (does not allocate)."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from config import get_settings
from services.defi_executor import DeFiExecutor
from services.portfolio_tracker import PortfolioTracker
from services.strategy_engine import AllocationPlan, goal_label
from services.tools import AXIS_EXPLAIN_SYSTEM, AXIS_SYSTEM, AXIS_TOOLS
from services.x402_client import IntelligenceUnavailable, X402Client
from services.yield_fetcher import YieldDataUnavailable

logger = logging.getLogger(__name__)


def _openai_tools() -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["input_schema"],
            },
        }
        for t in AXIS_TOOLS
    ]


class AxisAgent:
    def __init__(
        self,
        defi: DeFiExecutor,
        x402: X402Client,
        tracker: PortfolioTracker,
    ) -> None:
        self.settings = get_settings()
        self.defi = defi
        self.x402 = x402
        self.tracker = tracker
        self._session_user_id: str | None = None
        self._budget_usdc: float = 0.0
        self._allocated_usdc: float = 0.0

    async def explain_plan(self, plan: AllocationPlan) -> dict[str, Any]:
        """Plain-English explanation of a locked plan — no tool-based allocation."""
        provider = self.settings.ai_provider
        if provider not in ("venice", "openai"):
            return {
                "explanation": self._fallback_explanation(plan),
                "provider": "template",
                "actions": [],
            }

        prompt = (
            "Explain this locked AXIS plan to the user. Do not change any numbers.\n\n"
            f"{json.dumps(plan.to_dict(), indent=2)}"
        )
        try:
            text = await self._chat_completion(
                prompt,
                provider,
                max_tokens=220,
                system=AXIS_EXPLAIN_SYSTEM,
            )
            return {"explanation": text, "provider": provider, "actions": []}
        except Exception as exc:
            logger.warning("Plan explanation LLM failed: %s", exc)
            return {
                "explanation": self._fallback_explanation(plan),
                "provider": "template",
                "actions": [],
            }

    async def run(
        self,
        user_id: str,
        budget_usdc: float,
        risk_level: str,
        goal: str,
        plan: AllocationPlan | None = None,
    ) -> dict[str, Any]:
        """Compat entry: explain only. Allocation is done by StrategyEngine + client txs."""
        self._session_user_id = user_id
        self._budget_usdc = budget_usdc
        self._allocated_usdc = 0.0

        if plan is not None:
            explained = await self.explain_plan(plan)
            return {
                "actions": explained["actions"],
                "explanation": explained["explanation"],
                "user_id": user_id,
                "budget_usdc": budget_usdc,
                "provider": explained["provider"],
                "plan": plan.to_dict(),
            }

        # Legacy path for rebalance with free-text — still no execute_allocation.
        return {
            "actions": [],
            "explanation": (
                f"Rebalance noted for risk={risk_level}. "
                "AXIS uses a fixed Aave strategy matrix — open Activate again to redeploy."
            ),
            "user_id": user_id,
            "budget_usdc": budget_usdc,
            "provider": "template",
        }

    async def generate_weekly_report(self, user_id: str) -> str:
        positions = await self.tracker.get_positions(user_id)
        history = await self.tracker.get_weekly_actions(user_id)
        prompt = f"""Write a weekly portfolio report for this user.
Keep it under 150 words. Use plain English. No jargon.
Format: what earned, what changed, what AXIS did, what's next.

Current positions: {json.dumps(positions)}
Actions this week: {json.dumps(history)}"""

        provider = self.settings.ai_provider
        if provider not in ("venice", "openai"):
            return "Your Aave positions are open. Check the dashboard for live balances."

        try:
            return await self._chat_completion(prompt, provider, max_tokens=300)
        except Exception:
            return "Your Aave positions are open. Check the dashboard for live balances."

    async def _execute_tool(self, tool_name: str, tool_input: dict, user_id: str) -> dict:
        session_user_id = self._session_user_id or user_id
        if user_id != session_user_id:
            return {"error": "Cross-user tool execution is not allowed"}

        try:
            if tool_name == "check_aave_yield":
                return await self.defi.get_aave_apy(tool_input["asset"])
            if tool_name == "check_gmx_apy":
                return await self.defi.get_gmx_apy()
            if tool_name == "get_uniswap_pool":
                return {"error": "Uniswap is not in the v1 strategy matrix"}
            if tool_name == "get_market_intelligence":
                return await self.x402.fetch_intelligence(tool_input["query"], session_user_id)
            if tool_name == "execute_allocation":
                return {
                    "success": False,
                    "error": "Allocations are locked by StrategyEngine — AI cannot execute freely",
                }
            if tool_name == "get_current_positions":
                return {"positions": await self.tracker.get_positions(session_user_id)}
        except (YieldDataUnavailable, IntelligenceUnavailable) as exc:
            return {"error": str(exc)}
        except Exception as exc:
            logger.exception("Tool %s failed", tool_name)
            return {"error": str(exc)}

        return {"error": f"Unknown tool: {tool_name}"}

    async def _chat_completion(
        self,
        prompt: str,
        provider: str,
        max_tokens: int = 300,
        system: str | None = None,
    ) -> str:
        base_url = (
            self.settings.venice_base_url if provider == "venice" else "https://api.openai.com/v1"
        )
        api_key = (
            self.settings.venice_api_key if provider == "venice" else self.settings.openai_api_key
        )
        model = self.settings.venice_model if provider == "venice" else self.settings.openai_model

        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": model, "messages": messages, "max_tokens": max_tokens},
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    @staticmethod
    def _fallback_explanation(plan: AllocationPlan) -> str:
        legs = ", ".join(
            f"${leg.amount_usdc:.2f} to Aave {leg.asset} (~{leg.estimated_apy:.2f}% APY)"
            for leg in plan.legs
        )
        buffer = (
            f" Holding ${plan.cash_buffer_usdc:.2f} USDC as a cash buffer."
            if plan.cash_buffer_usdc > 0
            else ""
        )
        return (
            f"{goal_label(plan.goal)} with a {plan.risk_level.value} profile: "
            f"deploying {legs}.{buffer} "
            f"Estimated ~${plan.estimated_weekly_yield_usdc:.4f} per week at current rates."
        )
