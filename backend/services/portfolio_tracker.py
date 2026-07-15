"""PostgreSQL-backed portfolio position and action tracking."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import ActionLog, Position, User
from services.tenant_guard import assert_address_not_claimed, normalize_address


class PortfolioTracker:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def ensure_user(
        self,
        user_id: str,
        email: str | None = None,
        ua_address: str | None = None,
        sra_address: str | None = None,
        eip7702_tx_hash: str | None = None,
        eip7702_delegated: bool | None = None,
    ) -> User:
        if ua_address:
            await assert_address_not_claimed(self, ua_address, user_id)

        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            if email:
                user.email = email
            if ua_address:
                user.ua_address = normalize_address(ua_address)
            if sra_address:
                user.sra_address = normalize_address(sra_address)
            if eip7702_tx_hash:
                user.eip7702_tx_hash = eip7702_tx_hash
            if eip7702_delegated is not None:
                user.eip7702_delegated = eip7702_delegated
            return user

        user = User(
            id=user_id,
            email=email,
            ua_address=normalize_address(ua_address),
            sra_address=normalize_address(sra_address),
            eip7702_tx_hash=eip7702_tx_hash,
            eip7702_delegated=bool(eip7702_delegated),
        )
        self.db.add(user)
        await self.db.flush()
        return user

    async def activate_user(
        self,
        user_id: str,
        budget_usdc: float,
        risk_level: str,
        goal: str,
        ua_address: str,
        sra_address: str | None = None,
    ) -> User:
        await assert_address_not_claimed(self, ua_address, user_id)
        user = await self.ensure_user(user_id, ua_address=ua_address, sra_address=sra_address)
        user.budget_usdc = budget_usdc
        user.risk_level = risk_level
        user.goal = goal
        user.ua_address = normalize_address(ua_address)
        user.active = True
        if sra_address:
            user.sra_address = normalize_address(sra_address)
        await self.db.flush()
        return user

    async def log_action(
        self,
        user_id: str,
        tool: str,
        action_input: dict,
        result: dict,
        message: str | None = None,
    ) -> None:
        if not user_id:
            raise ValueError("user_id is required for action logging")

        self.db.add(
            ActionLog(
                user_id=user_id,
                tool=tool,
                action_input=action_input,
                result=result,
                message=message,
            )
        )

        if tool == "execute_allocation" and result.get("success"):
            self.db.add(
                Position(
                    user_id=user_id,
                    protocol=action_input.get("protocol", ""),
                    asset=action_input.get("asset", ""),
                    amount_usdc=float(action_input.get("amount_usdc", 0)),
                    estimated_apy=float(result.get("estimated_apy", 0)),
                    tx_hash=result.get("tx_hash"),
                    chain=result.get("chain", "arbitrum"),
                    status="open",
                )
            )
        await self.db.flush()

    async def get_positions(self, user_id: str) -> list[dict[str, Any]]:
        result = await self.db.execute(
            select(Position)
            .where(Position.user_id == user_id, Position.status == "open")
            .order_by(Position.opened_at.desc())
        )
        positions = result.scalars().all()
        return [
            {
                "protocol": p.protocol,
                "asset": p.asset,
                "amount_usdc": p.amount_usdc,
                "estimated_apy": p.estimated_apy,
                "tx_hash": p.tx_hash,
                "chain": p.chain,
                "status": p.status,
                "opened_at": p.opened_at.isoformat(),
            }
            for p in positions
        ]

    async def get_weekly_actions(self, user_id: str) -> list[dict[str, Any]]:
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        result = await self.db.execute(
            select(ActionLog)
            .where(ActionLog.user_id == user_id, ActionLog.created_at >= week_ago)
            .order_by(ActionLog.created_at.desc())
        )
        actions = result.scalars().all()
        return [
            {
                "tool": a.tool,
                "input": a.action_input,
                "result": a.result,
                "message": a.message,
                "timestamp": a.created_at.isoformat(),
            }
            for a in actions
        ]

    async def get_user(self, user_id: str) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_user_by_ua_address(self, ua_address: str) -> User | None:
        normalized = normalize_address(ua_address)
        if not normalized:
            return None

        result = await self.db.execute(select(User).where(User.ua_address == normalized))
        return result.scalar_one_or_none()

    async def get_summary(self, user_id: str) -> dict[str, Any]:
        positions = await self.get_positions(user_id)
        history = await self.get_weekly_actions(user_id)
        user = await self.get_user(user_id)

        total_invested = sum(p.get("amount_usdc", 0) for p in positions)
        estimated_weekly_yield = sum(
            p.get("amount_usdc", 0) * p.get("estimated_apy", 0) / 100 / 52 for p in positions
        )

        return {
            "active": len(positions) > 0 or (user.active if user else False),
            "positions": positions,
            "total_invested_usdc": round(total_invested, 2),
            "estimated_weekly_yield_usdc": round(estimated_weekly_yield, 2),
            "actions_this_week": len(history),
            "last_action": history[0] if history else None,
            "ua_address": user.ua_address if user else None,
            "sra_address": user.sra_address if user else None,
            "budget_usdc": user.budget_usdc if user else 0,
            "risk_level": user.risk_level if user else "moderate",
            "goal": user.goal if user else "",
        }
