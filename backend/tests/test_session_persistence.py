"""Regression: same Google email / UA address must not create a blank second agent."""

import pytest
from sqlalchemy import select

from models import User
from services.portfolio_tracker import PortfolioTracker

AUTH = {"Authorization": "Bearer test-did-token"}


@pytest.mark.asyncio
async def test_register_returns_agent_ready_for_returning_user(client, monkeypatch):
    async def mock_apys():
        return {"USDC": 4.2, "USDT": 4.0}

    async def mock_explain(self, plan):
        return {"explanation": "Test plan locked.", "provider": "template", "actions": []}

    monkeypatch.setattr("routes.agent._live_aave_apys", mock_apys)
    monkeypatch.setattr("routes.agent.AxisAgent.explain_plan", mock_explain)

    r = await client.post(
        "/api/agent/activate",
        headers=AUTH,
        json={
            "user_id": "test-user",
            "budget_usdc": 100,
            "risk_level": "moderate",
            "goal": "Maximize yield",
            "ua_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        },
    )
    assert r.status_code == 200

    r2 = await client.post(
        "/api/auth/register",
        json={
            "did_token": "test-did-token",
            "ua_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
            "email": "test@axis.app",
        },
    )
    assert r2.status_code == 200
    data = r2.json()
    assert data["user_id"] == "test-user"
    assert data["agent_ready"] is True
    assert data["budget_usdc"] == 100
    assert data["active"] is True


@pytest.mark.asyncio
async def test_ensure_user_rekeys_stale_issuer_by_email(db_session):
    tracker = PortfolioTracker(db_session)
    old = await tracker.ensure_user(
        user_id="did:ethr:0xOLDTRUNCATED",
        email="henry@example.com",
        ua_address="0x1111111111111111111111111111111111111111",
    )
    old.budget_usdc = 50
    old.active = True
    old.risk_level = "moderate"
    old.goal = "maximize yield"
    await db_session.flush()

    user = await tracker.ensure_user(
        user_id="did:ethr:0x1111111111111111111111111111111111111111",
        email="Henry@Example.com",
        ua_address="0x1111111111111111111111111111111111111111",
    )
    assert user.id == "did:ethr:0x1111111111111111111111111111111111111111"
    assert user.budget_usdc == 50
    assert user.active is True
    assert user.email == "henry@example.com"

    leftover = await db_session.execute(select(User).where(User.id == "did:ethr:0xOLDTRUNCATED"))
    assert leftover.scalar_one_or_none() is None
