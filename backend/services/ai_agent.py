"""AXIS AI agent — Venice primary, OpenAI fallback."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from config import get_settings
from services.defi_executor import DeFiExecutor
from services.portfolio_tracker import PortfolioTracker
from services.tools import AXIS_SYSTEM, AXIS_TOOLS
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

    async def run(
        self,
        user_id: str,
        budget_usdc: float,
        risk_level: str,
        goal: str,
    ) -> dict[str, Any]:
        self._session_user_id = user_id
        self._budget_usdc = budget_usdc
        self._allocated_usdc = 0.0

        provider = self.settings.ai_provider
        if provider not in ("venice", "openai"):
            raise RuntimeError(
                "AI providers not configured. Set VENICE_API_KEY and OPENAI_API_KEY."
            )

        if provider == "venice":
            return await self._openai_compatible_loop(user_id, budget_usdc, risk_level, goal, "venice")

        return await self._openai_compatible_loop(user_id, budget_usdc, risk_level, goal, "openai")

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
            raise RuntimeError("AI providers not configured")

        return await self._chat_completion(prompt, provider, max_tokens=300)

    async def _openai_compatible_loop(
        self,
        user_id: str,
        budget_usdc: float,
        risk_level: str,
        goal: str,
        provider: str,
    ) -> dict[str, Any]:
        actions_taken: list[dict] = []
        explanations: list[str] = []

        messages = [
            {"role": "system", "content": AXIS_SYSTEM},
            {
                "role": "user",
                "content": self._user_prompt(user_id, budget_usdc, risk_level, goal),
            },
        ]

        base_url = (
            self.settings.venice_base_url
            if provider == "venice"
            else "https://api.openai.com/v1"
        )
        api_key = (
            self.settings.venice_api_key
            if provider == "venice"
            else self.settings.openai_api_key
        )
        model = (
            self.settings.venice_model
            if provider == "venice"
            else self.settings.openai_model
        )

        for _ in range(12):
            async with httpx.AsyncClient(timeout=60) as client:
                body: dict[str, Any] = {
                    "model": model,
                    "messages": messages,
                    "tools": _openai_tools(),
                    "max_tokens": 2000,
                }
                if provider == "venice":
                    body["venice_parameters"] = {"enable_web_search": True}

                r = await client.post(
                    f"{base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json=body,
                )
                r.raise_for_status()
                data = r.json()

            choice = data["choices"][0]
            message = choice["message"]

            if choice.get("finish_reason") == "stop" or not message.get("tool_calls"):
                if message.get("content"):
                    explanations.append(message["content"])
                break

            messages.append(message)
            for tool_call in message.get("tool_calls", []):
                fn = tool_call["function"]
                tool_input = json.loads(fn["arguments"])
                result = await self._execute_tool(fn["name"], tool_input, user_id)
                actions_taken.append({"tool": fn["name"], "input": tool_input, "result": result})
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call["id"],
                        "content": json.dumps(result),
                    }
                )

        return {
            "actions": actions_taken,
            "explanation": "\n\n".join(explanations),
            "user_id": user_id,
            "budget_usdc": budget_usdc,
            "provider": provider,
        }

    async def _execute_tool(self, tool_name: str, tool_input: dict, user_id: str) -> dict:
        session_user_id = self._session_user_id or user_id
        if user_id != session_user_id:
            return {"error": "Cross-user tool execution is not allowed"}

        try:
            if tool_name == "check_aave_yield":
                return await self.defi.get_aave_apy(tool_input["asset"])
            if tool_name == "check_gmx_apy":
                return await self.defi.get_gmx_apy()
            if tool_name == "check_uniswap_pool":
                return await self.defi.get_uniswap_apy(
                    tool_input["token0"],
                    tool_input["token1"],
                    tool_input.get("fee_tier", 3000),
                )
            if tool_name == "get_market_intelligence":
                return await self.x402.fetch_intelligence(tool_input["query"], session_user_id)
            if tool_name == "execute_allocation":
                amount = float(tool_input["amount_usdc"])
                remaining = self._budget_usdc - self._allocated_usdc
                if amount <= 0:
                    return {"success": False, "error": "Allocation amount must be positive"}
                if amount > remaining + 0.01:
                    return {
                        "success": False,
                        "error": f"Allocation exceeds remaining budget (${remaining:.2f} USDC left)",
                    }

                result = await self.defi.execute(
                    protocol=tool_input["protocol"],
                    asset=tool_input["asset"],
                    amount_usdc=amount,
                    action=tool_input["action"],
                    user_id=session_user_id,
                )
                if result.get("success"):
                    self._allocated_usdc += amount
                await self.tracker.log_action(session_user_id, tool_name, tool_input, result)
                return result
            if tool_name == "get_current_positions":
                return {"positions": await self.tracker.get_positions(session_user_id)}
        except (YieldDataUnavailable, IntelligenceUnavailable) as exc:
            return {"error": str(exc)}
        except Exception as exc:
            logger.exception("Tool %s failed", tool_name)
            return {"error": str(exc)}

        return {"error": f"Unknown tool: {tool_name}"}

    async def _chat_completion(self, prompt: str, provider: str, max_tokens: int = 300) -> str:
        base_url = (
            self.settings.venice_base_url if provider == "venice" else "https://api.openai.com/v1"
        )
        api_key = (
            self.settings.venice_api_key if provider == "venice" else self.settings.openai_api_key
        )
        model = self.settings.venice_model if provider == "venice" else self.settings.openai_model

        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": model, "messages": [{"role": "user", "content": prompt}], "max_tokens": max_tokens},
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    def _user_prompt(self, user_id: str, budget_usdc: float, risk_level: str, goal: str) -> str:
        return f"""Manage this portfolio:
- Budget: ${budget_usdc} USDC
- Risk level: {risk_level} (conservative/moderate/aggressive)
- User goal: {goal}
- User ID: {user_id}

Check current yields, get market intelligence, then allocate the budget.
Explain each decision in one plain-English sentence.
Execute the allocations."""
