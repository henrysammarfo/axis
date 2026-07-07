"""AXIS AI agent — Venice, OpenAI, Anthropic, or rules-based fallback."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from config import get_settings
from services.defi_executor import DeFiExecutor
from services.portfolio_tracker import PortfolioTracker
from services.tools import AXIS_SYSTEM, AXIS_TOOLS
from services.x402_client import X402Client

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
        if provider == "rules":
            raise RuntimeError(
                "No AI provider configured. Set VENICE_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY."
            )

        if provider in ("venice", "openai"):
            return await self._openai_compatible_loop(user_id, budget_usdc, risk_level, goal, provider)

        return await self._anthropic_loop(user_id, budget_usdc, risk_level, goal)

    async def generate_weekly_report(self, user_id: str) -> str:
        positions = await self.tracker.get_positions(user_id)
        history = await self.tracker.get_weekly_actions(user_id)
        prompt = f"""Write a weekly portfolio report for this user.
Keep it under 150 words. Use plain English. No jargon.
Format: what earned, what changed, what AXIS did, what's next.

Current positions: {json.dumps(positions)}
Actions this week: {json.dumps(history)}"""

        provider = self.settings.ai_provider
        if provider in ("venice", "openai"):
            return await self._chat_completion(prompt, provider, max_tokens=300)
        if provider == "anthropic":
            return await self._anthropic_completion(prompt, max_tokens=300)
        positions = await self.tracker.get_positions(user_id)
        history = await self.tracker.get_weekly_actions(user_id)
        return self._template_report(positions, history)

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

    async def _anthropic_loop(
        self,
        user_id: str,
        budget_usdc: float,
        risk_level: str,
        goal: str,
    ) -> dict[str, Any]:
        import anthropic

        client = anthropic.Anthropic(api_key=self.settings.anthropic_api_key)
        actions_taken: list[dict] = []
        explanations: list[str] = []
        messages: list[dict] = [
            {"role": "user", "content": self._user_prompt(user_id, budget_usdc, risk_level, goal)}
        ]

        for _ in range(12):
            response = client.messages.create(
                model=self.settings.anthropic_model,
                max_tokens=2000,
                system=AXIS_SYSTEM,
                tools=AXIS_TOOLS,
                messages=messages,
            )

            if response.stop_reason == "end_turn":
                for block in response.content:
                    if hasattr(block, "text"):
                        explanations.append(block.text)
                break

            if response.stop_reason == "tool_use":
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        result = await self._execute_tool(block.name, block.input, user_id)
                        actions_taken.append({"tool": block.name, "input": block.input, "result": result})
                        tool_results.append(
                            {"type": "tool_result", "tool_use_id": block.id, "content": json.dumps(result)}
                        )
                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": tool_results})
            else:
                break

        return {
            "actions": actions_taken,
            "explanation": "\n\n".join(explanations),
            "user_id": user_id,
            "budget_usdc": budget_usdc,
            "provider": "anthropic",
        }

    async def _rules_engine(
        self,
        user_id: str,
        budget_usdc: float,
        risk_level: str,
        goal: str,
    ) -> dict[str, Any]:
        """Deterministic allocation when no AI key is configured."""
        actions: list[dict] = []

        aave = await self._execute_tool("check_aave_yield", {"asset": "USDC"}, user_id)
        gmx = await self._execute_tool("check_gmx_apy", {}, user_id)
        intel = await self._execute_tool(
            "get_market_intelligence",
            {"query": f"DeFi yield outlook for {risk_level} risk portfolio"},
            user_id,
        )
        actions.extend(
            [
                {"tool": "check_aave_yield", "input": {"asset": "USDC"}, "result": aave},
                {"tool": "check_gmx_apy", "input": {}, "result": gmx},
                {"tool": "get_market_intelligence", "input": {"query": goal}, "result": intel},
            ]
        )

        aave_pct = 0.7 if risk_level == "conservative" else 0.5 if risk_level == "moderate" else 0.35
        gmx_pct = 1.0 - aave_pct

        if budget_usdc > 0:
            aave_alloc = await self._execute_tool(
                "execute_allocation",
                {
                    "protocol": "aave",
                    "asset": "USDC",
                    "amount_usdc": round(budget_usdc * aave_pct, 2),
                    "action": "supply",
                },
                user_id,
            )
            gmx_alloc = await self._execute_tool(
                "execute_allocation",
                {
                    "protocol": "gmx",
                    "asset": "GLP",
                    "amount_usdc": round(budget_usdc * gmx_pct, 2),
                    "action": "supply",
                },
                user_id,
            )
            actions.extend(
                [
                    {
                        "tool": "execute_allocation",
                        "input": {"protocol": "aave", "asset": "USDC", "amount_usdc": budget_usdc * aave_pct},
                        "result": aave_alloc,
                    },
                    {
                        "tool": "execute_allocation",
                        "input": {"protocol": "gmx", "asset": "GLP", "amount_usdc": budget_usdc * gmx_pct},
                        "result": gmx_alloc,
                    },
                ]
            )

        aave_apy = aave.get("supply_apy", 4)
        gmx_apy = gmx.get("apy", 15)
        weekly = budget_usdc * (aave_pct * aave_apy + gmx_pct * gmx_apy) / 100 / 52

        explanation = (
            f"I split your ${budget_usdc:.0f} between a stable lending pool "
            f"({aave_pct:.0%} at {aave_apy:.1f}% yield) and a higher-yield liquidity pool "
            f"({gmx_pct:.0%} at {gmx_apy:.1f}% yield). "
            f"You're on track to earn roughly ${weekly:.2f} per week."
        )

        return {
            "actions": actions,
            "explanation": explanation,
            "user_id": user_id,
            "budget_usdc": budget_usdc,
            "provider": "rules",
        }

    async def _execute_tool(self, tool_name: str, tool_input: dict, user_id: str) -> dict:
        session_user_id = self._session_user_id or user_id
        if user_id != session_user_id:
            return {"error": "Cross-user tool execution is not allowed"}

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
            return await self.x402.fetch_intelligence(tool_input["query"], user_id)
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

    async def _anthropic_completion(self, prompt: str, max_tokens: int = 300) -> str:
        import anthropic

        client = anthropic.Anthropic(api_key=self.settings.anthropic_api_key)
        response = client.messages.create(
            model=self.settings.anthropic_model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text

    def _user_prompt(self, user_id: str, budget_usdc: float, risk_level: str, goal: str) -> str:
        return f"""Manage this portfolio:
- Budget: ${budget_usdc} USDC
- Risk level: {risk_level} (conservative/moderate/aggressive)
- User goal: {goal}
- User ID: {user_id}

Check current yields, get market intelligence, then allocate the budget.
Explain each decision in one plain-English sentence.
Execute the allocations."""

    def _template_report(self, positions: list, history: list) -> str:
        total = sum(p.get("amount_usdc", 0) for p in positions)
        weekly = sum(p.get("amount_usdc", 0) * p.get("estimated_apy", 0) / 100 / 52 for p in positions)
        return (
            f"This week AXIS managed ${total:.0f} across {len(positions)} positions. "
            f"Estimated earnings: ${weekly:.2f}. "
            f"{len(history)} actions taken. "
            "Your portfolio remains balanced for your risk level."
        )
