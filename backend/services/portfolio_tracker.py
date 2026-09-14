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

    async def get_user(self, user_id: str) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> User | None:
        if not email:
            return None
        result = await self.db.execute(select(User).where(User.email == email.lower().strip()))
        # Also match legacy rows stored with mixed-case email.
        user = result.scalar_one_or_none()
        if user:
            return user
        result = await self.db.execute(select(User).where(User.email == email.strip()))
        return result.scalar_one_or_none()

    async def rekey_user(self, old_id: str, new_id: str) -> User | None:
        """Move a user row (and related logs) to a new Magic issuer id.

        Needed when older rows truncated issuer to 64 chars and the live issuer is longer.
        """
        if not old_id or not new_id or old_id == new_id:
            return await self.get_user(new_id)

        existing_new = await self.get_user(new_id)
        if existing_new:
            return existing_new

        old = await self.get_user(old_id)
        if not old:
            return None

        # Detach values then recreate under the stable issuer.
        payload = {
            "email": old.email,
            "ua_address": old.ua_address,
            "sra_address": old.sra_address,
            "eip7702_tx_hash": old.eip7702_tx_hash,
            "eip7702_delegated": old.eip7702_delegated,
            "risk_level": old.risk_level,
            "goal": old.goal,
            "budget_usdc": old.budget_usdc,
            "active": old.active,
            "session_key_approval": old.session_key_approval,
            "session_key_signer": old.session_key_signer,
            "session_active": old.session_active,
            "custom_strategy": old.custom_strategy,
            "market_risk_consent": old.market_risk_consent,
            "display_name": old.display_name,
            "avatar": old.avatar,
            "stock_basket": old.stock_basket,
        }
        await self.db.delete(old)
        await self.db.flush()

        user = User(id=new_id, **payload)
        self.db.add(user)

        for model in (Position, ActionLog):
            rows = await self.db.execute(select(model).where(model.user_id == old_id))
            for row in rows.scalars().all():
                row.user_id = new_id

        await self.db.flush()
        return user

    async def ensure_user(
        self,
        user_id: str,
        email: str | None = None,
        ua_address: str | None = None,
        sra_address: str | None = None,
        eip7702_tx_hash: str | None = None,
        eip7702_delegated: bool | None = None,
    ) -> User:
        normalized_email = email.lower().strip() if email else None

        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        # Same Google email under a different Magic issuer (e.g. old 64-char truncation)
        # → rekey the existing row so portfolio / agent prefs survive logout.
        if not user and normalized_email:
            by_email = await self.get_user_by_email(normalized_email)
            if by_email and by_email.id != user_id:
                user = await self.rekey_user(by_email.id, user_id)

        # Also recover when the wallet address is already ours under a stale issuer.
        if not user and ua_address:
            by_addr = await self.get_user_by_ua_address(ua_address)
            if by_addr and by_addr.id != user_id:
                user = await self.rekey_user(by_addr.id, user_id)

        if ua_address:
            await assert_address_not_claimed(self, ua_address, user_id)

        if user:
            if normalized_email:
                user.email = normalized_email
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
            email=normalized_email,
            ua_address=normalize_address(ua_address),
            sra_address=normalize_address(sra_address),
            eip7702_tx_hash=eip7702_tx_hash,
            eip7702_delegated=bool(eip7702_delegated),
        )
        self.db.add(user)
        await self.db.flush()
        return user

    async def save_strategy_prefs(
        self,
        user_id: str,
        budget_usdc: float,
        risk_level: str,
        goal: str,
        ua_address: str,
        sra_address: str | None = None,
        *,
        mark_active: bool = False,
    ) -> User:
        """Persist risk/goal/budget. Only mark active when on-chain legs are confirmed."""
        await assert_address_not_claimed(self, ua_address, user_id)
        user = await self.ensure_user(user_id, ua_address=ua_address, sra_address=sra_address)
        user.budget_usdc = budget_usdc
        user.risk_level = risk_level
        user.goal = goal
        user.ua_address = normalize_address(ua_address)
        if mark_active:
            user.active = True
        if sra_address:
            user.sra_address = normalize_address(sra_address)
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
        """Backward-compatible helper — prefer save_strategy_prefs + confirm."""
        return await self.save_strategy_prefs(
            user_id,
            budget_usdc,
            risk_level,
            goal,
            ua_address,
            sra_address,
            mark_active=True,
        )

    async def mark_active(self, user_id: str) -> User | None:
        user = await self.get_user(user_id)
        if not user:
            return None
        user.active = True
        await self.db.flush()
        return user

    async def save_session_approval(
        self,
        user_id: str,
        ua_address: str,
        approval: str,
        session_signer: str,
    ) -> User:
        """Persist the user's policy-bounded session-key approval (enables hands-off mode)."""
        await assert_address_not_claimed(self, ua_address, user_id)
        user = await self.ensure_user(user_id, ua_address=ua_address)
        user.session_key_approval = approval
        user.session_key_signer = normalize_address(session_signer)
        user.session_active = True
        await self.db.flush()
        return user

    async def save_market_risk_consent(
        self,
        user_id: str,
        ua_address: str,
        consent: bool,
    ) -> User:
        """Record the user's one-time consent to market-risk positions (Uniswap V3 LP)."""
        await assert_address_not_claimed(self, ua_address, user_id)
        user = await self.ensure_user(user_id, ua_address=ua_address)
        user.market_risk_consent = bool(consent)
        await self.db.flush()
        return user

    async def save_profile(
        self,
        user_id: str,
        ua_address: str,
        display_name: str | None = None,
        avatar: str | None = None,
    ) -> User:
        """Persist the user's display name + avatar so they sync across devices."""
        await assert_address_not_claimed(self, ua_address, user_id)
        user = await self.ensure_user(user_id, ua_address=ua_address)
        if display_name is not None:
            trimmed = display_name.strip()
            user.display_name = trimmed[:64] if trimmed else None
        if avatar is not None:
            user.avatar = avatar or None
        await self.db.flush()
        return user

    async def save_custom_strategy(
        self,
        user_id: str,
        ua_address: str,
        custom_strategy: dict[str, Any] | None,
    ) -> User:
        """Persist (or clear) a power-user custom strategy."""
        await assert_address_not_claimed(self, ua_address, user_id)
        user = await self.ensure_user(user_id, ua_address=ua_address)
        user.custom_strategy = custom_strategy
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

    async def close_positions(self, user_id: str, protocol: str, asset: str) -> int:
        """Mark matching open positions closed (e.g. after an LP exit). Returns the count."""
        result = await self.db.execute(
            select(Position).where(
                Position.user_id == user_id,
                Position.protocol == protocol,
                Position.asset == asset,
                Position.status == "open",
            )
        )
        rows = result.scalars().all()
        for p in rows:
            p.status = "closed"
            p.closed_at = datetime.now(timezone.utc)
        await self.db.flush()
        return len(rows)

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
            # Configured (agent set up) vs deployed (real tx-backed positions).
            "active": bool(user.active) if user else False,
            "deployed": len(positions) > 0,
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
            "session_active": bool(user.session_active) if user else False,
            "session_approval": user.session_key_approval if user else None,
            "custom_strategy": user.custom_strategy if user else None,
            "market_risk_consent": bool(user.market_risk_consent) if user else False,
            "display_name": user.display_name if user else None,
            "avatar": user.avatar if user else None,
            "stock_basket": user.stock_basket if user else None,
        }
