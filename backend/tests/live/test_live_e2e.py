"""Live API e2e — activate returns pending Aave calldata when funded."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from config import get_settings
from database import Base, get_db
from main import app

AUTH = {"Authorization": "Bearer test-did-token"}
UA = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"


@pytest.fixture
async def live_client():
    get_settings.cache_clear()
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session
            await session.commit()

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
    await engine.dispose()


async def _run_with_real_defi(self, user_id, budget_usdc, risk_level, goal):
    """Kept for optional manual live experiments — not used by activate e2e."""
    result = await self.defi.execute(
        protocol="aave",
        asset="USDC",
        amount_usdc=0.1,
        action="supply",
        user_id=user_id,
    )
    await self.tracker.log_action(user_id, "execute_allocation", {"amount_usdc": 0.1}, result)
    return {
        "actions": [{"tool": "execute_allocation", "input": {}, "result": result}],
        "explanation": "Live e2e: supplied 0.1 USDC to Aave.",
        "user_id": user_id,
        "budget_usdc": budget_usdc,
        "provider": "live-e2e",
    }


@pytest.mark.live
@pytest.mark.asyncio
async def test_live_e2e_register_activate_then_deploy(live_client, monkeypatch):
    """Activate saves setup; deploy/prepare returns Aave calldata when funded."""
    reg = await live_client.post(
        "/api/auth/register",
        json={"did_token": "test-did-token", "ua_address": UA, "sra_address": UA},
    )
    assert reg.status_code == 200

    activate = await live_client.post(
        "/api/agent/activate",
        headers=AUTH,
        json={
            "user_id": "test-user",
            "budget_usdc": 50,
            "risk_level": "moderate",
            "goal": "Maximize yield",
            "ua_address": UA,
            "sra_address": UA,
        },
    )
    assert activate.status_code == 200, activate.text
    assert activate.json()["status"] == "activated"

    monkeypatch.setattr("routes.agent.require_usdc_funding", lambda *_a, **_k: 50.0)

    deploy = await live_client.post(
        "/api/agent/deploy/prepare",
        headers=AUTH,
        json={
            "user_id": "test-user",
            "budget_usdc": 50,
            "risk_level": "moderate",
            "goal": "Maximize yield",
            "ua_address": UA,
            "sra_address": UA,
        },
    )
    assert deploy.status_code == 200, deploy.text
    body = deploy.json()
    assert body["status"] == "pending_signatures"
    assert body.get("plan")
    assert len(body.get("transactions") or []) >= 2
    assert all(t.get("data", "").startswith("0x") for t in body["transactions"])
