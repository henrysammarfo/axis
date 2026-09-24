"""AXIS AI agent — explains locked StrategyEngine plans (does not allocate)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from config import get_settings
from services.defi_executor import DeFiExecutor
from services.portfolio_tracker import PortfolioTracker
from services.strategy_engine import AllocationPlan, goal_label
from services.tools import AXIS_ASK_SYSTEM, AXIS_EXPLAIN_SYSTEM, AXIS_SYSTEM, AXIS_TOOLS
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

    async def answer_user(
        self,
        instruction: str,
        *,
        plan: AllocationPlan,
        quotes: list[dict[str, Any]],
        idle_usdc: float,
        invested_usdc: float,
    ) -> dict[str, Any]:
        """Plain-English reply to Ask AXIS — uses live yields. Does not move money."""
        provider = self.settings.ai_provider
        briefing = {
            "user_said": instruction.strip()[:400],
            "idle_usdc": round(idle_usdc, 2),
            "invested_usdc": round(invested_usdc, 2),
            "plan": plan.to_dict(),
            "live_yields": quotes,
        }
        if provider not in ("venice", "openai"):
            return {
                "explanation": self._fallback_ask(instruction, plan, quotes, idle_usdc),
                "provider": "template",
            }
        try:
            text = await self._chat_completion(
                json.dumps(briefing, indent=2),
                provider,
                max_tokens=220,
                system=AXIS_ASK_SYSTEM,
            )
            return {
                "explanation": text or self._fallback_ask(instruction, plan, quotes, idle_usdc),
                "provider": provider,
            }
        except Exception as exc:
            logger.warning("Ask AXIS LLM failed: %s", exc)
            return {
                "explanation": self._fallback_ask(instruction, plan, quotes, idle_usdc),
                "provider": "template",
            }

    @staticmethod
    def _fallback_ask(
        instruction: str,
        plan: AllocationPlan,
        quotes: list[dict[str, Any]],
        idle_usdc: float,
    ) -> str:
        bits = [
            f"{q.get('asset') or q.get('venue')}: {float(q.get('apy') or 0):.2f}%"
            for q in quotes
            if float(q.get("apy") or 0) > 0
        ]
        yields = ", ".join(bits[:4]) or "yields are refreshing"
        if idle_usdc < 10:
            return (
                f"Nothing is deployed yet — you have ${idle_usdc:.2f} idle. "
                f"Live now: {yields}. Send at least $10 native USDC on Arbitrum, then tap Begin."
            )
        return (
            f"Heard “{instruction.strip()[:80]}”. "
            f"{AxisAgent._fallback_explanation(plan)} Live: {yields}."
        )

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
        pack = await self.generate_weekly_report_pack(user_id)
        return pack.get("report") or ""

    async def generate_weekly_report_pack(self, user_id: str) -> dict:
        """English weekly note + structured dual prices (bible honesty)."""
        positions = await self.tracker.get_positions(user_id)
        history = await self.tracker.get_weekly_actions(user_id)
        user = await self.tracker.get_user(user_id)
        basket = (user.stock_basket if user else None) or {}

        empty = {
            "report": "",
            "stock_prices": [],
            "price_honesty": None,
        }

        if not positions and not history and not basket.get("legs"):
            return empty

        basket_note = ""
        symbols: list[str] = []
        if basket.get("legs"):
            legs = ", ".join(
                f"{int(float(leg.get('weight', 0)) * 100)}% {leg.get('symbol')}"
                for leg in basket["legs"]
            )
            net = basket.get("network", "robinhood-testnet")
            basket_note = (
                f"Saved stock basket ({net}): {legs}. "
                f"Summary: {basket.get('english_summary', '')}"
            )
            symbols = [str(leg.get("symbol")) for leg in basket["legs"] if leg.get("symbol")]

        from services.stock_session_prices import dual_prices_for_symbols, format_dual_prices_block

        dual_rows = dual_prices_for_symbols(symbols) if symbols else []
        dual_block = format_dual_prices_block(dual_rows)
        price_honesty = dual_rows[0].honesty if dual_rows else None

        holds = (user.rh_holds if user else None) or {}
        hold_status = holds.get("status") or "none"
        hold_txs = holds.get("txs") or []
        hold_legs = holds.get("legs") or []
        hold_note = (
            f"RH hold status={hold_status} (testnet={holds.get('testnet', True)}). "
            f"Broadcast txs={len(hold_txs)}. Synced legs={len(hold_legs)}. "
            f"Honesty: {holds.get('honesty', 'plan is not a fill')}"
        )

        retention = (user.retention_policy if user else None) or {}
        frag_note = ""
        if retention.get("include_fragmentation_warnings", True) and basket.get("legs"):
            from services.fragmentation import compare_underlying

            bits = []
            for leg in basket["legs"][:5]:
                sym = leg.get("symbol")
                if not sym:
                    continue
                cmp = compare_underlying(str(sym))
                bits.append(
                    f"{sym}: {cmp.get('instrument_count', len(cmp.get('instruments') or []))} "
                    f"instruments, fungible=false, axis_action={cmp.get('axis_action')}"
                )
            if bits:
                frag_note = "Fragmentation desk: " + "; ".join(bits)

        retain_note = (
            f"Retention cadence={retention.get('cadence', 'weekly')}, "
            f"rebalance_mode={retention.get('rebalance_mode', 'report_only')} "
            f"(never silent stock fills)."
        )

        prompt = f"""Write a weekly portfolio report for this user.
Keep it under 160 words. Use plain English. No jargon. No preamble.
Never invent stock fills or claim mainnet RH holdings if status is planned/awaiting_faucet.
If fragmentation notes exist, warn that same ticker is not the same instrument.
If stock session honesty prices exist, mention BOTH the after-hours/weekend print and Thursday's close —
never treat the weekend print alone as "the stock."
Reply with ONLY the report, in this format:
What earned: ...
What changed: ...
What AXIS did: ...
Prices (honest): ...
What's next: ...

Current positions: {json.dumps(positions)}
Actions this week: {json.dumps(history)}
Stock basket (Open House / RH — may be testnet plan): {basket_note or "none"}
RH hold evidence: {hold_note}
{frag_note or "Fragmentation: n/a"}
{retain_note}
{dual_block or "Stock session honesty: n/a"}"""

        provider = self.settings.ai_provider
        if provider not in ("venice", "openai"):
            if basket_note:
                next_line = {
                    "held": "Keep oil excluded; check /proof for RH explorer links.",
                    "partial": "Finish faucet for missing legs, then Activate hold again.",
                    "awaiting_faucet": "Claim RH testnet faucet for agent and/or your wallet, then Activate hold.",
                    "planned": "Activate hold after faucet — plan alone is not a fill.",
                }.get(hold_status, "Activate hold when ready — oil stays excluded.")
                frag_line = (
                    f" Fragmentation: same company ≠ same instrument ({frag_note})."
                    if frag_note
                    else ""
                )
                price_line = dual_block.replace("\n", " ") if dual_block else "n/a"
                report = (
                    f"What earned: Crypto yield positions as shown on the dashboard.\n"
                    f"What changed: {basket_note} Hold: {hold_status} "
                    f"({len(hold_txs)} tx, {len(hold_legs)} synced legs).{frag_line}\n"
                    f"What AXIS did: Kept Set.Forget.Earn on Arbitrum; RH stock path labeled testnet; "
                    f"retention {retention.get('cadence', 'weekly')} / {retention.get('rebalance_mode', 'report_only')}.\n"
                    f"Prices (honest): {price_line}\n"
                    f"What's next: {next_line}"
                )
            else:
                report = "Your positions are open. Check the dashboard for live balances."
            return {
                "report": report,
                "stock_prices": [r.to_dict() for r in dual_rows],
                "price_honesty": price_honesty,
            }

        try:
            report = await self._chat_completion(prompt, provider, max_tokens=360)
        except Exception:
            report = "Your positions are open. Check the dashboard for live balances."

        return {
            "report": report,
            "stock_prices": [r.to_dict() for r in dual_rows],
            "price_honesty": price_honesty,
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

        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
        }
        # Venice reasoning models otherwise return their chain-of-thought inline;
        # ask Venice to strip it server-side (we also strip client-side below).
        if provider == "venice":
            payload["venice_parameters"] = {"strip_thinking_response": True}

        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
            r.raise_for_status()
            content = r.json()["choices"][0]["message"].get("content") or ""
            return self._strip_reasoning(content)

    @staticmethod
    def _strip_reasoning(text: str) -> str:
        """Remove reasoning-model chain-of-thought so only the answer is shown.

        Handles explicit <think>...</think> blocks and unclosed tags, then trims
        any leading commentary before the real report (e.g. a model that narrates
        "The user wants..." before the "What earned:" section).
        """
        if not text:
            return ""
        # Drop closed <think>/<reasoning> blocks and any unterminated opener.
        text = re.sub(r"(?is)<(think|reasoning)>.*?</\1>", "", text)
        text = re.sub(r"(?is)<(think|reasoning)>.*$", "", text)
        text = re.sub(r"(?is)</?(think|reasoning)>", "", text).strip()
        # If the report's structured section exists, start from there and drop any
        # narration the model emitted before it.
        marker = re.search(r"(?im)^\s*(what earned|weekly portfolio report)\b", text)
        if marker:
            text = text[marker.start() :]
        text = re.sub(r"(?im)^\s*-{2,}\s*$", "", text)  # stray "---" separators
        return text.strip()

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
