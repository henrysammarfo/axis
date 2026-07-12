"""Live API e2e — full activate flow with real on-chain execution."""

from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from config import get_settings
from database import Base, get_db
from main import app
from services.ai_agent import AxisAgent

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
async def test_live_e2e_register_activate_with_real_defi_tx(live_client):
    reg = await live_client.post(
        "/api/auth/register",
        json={"did_token": "test-did-token", "ua_address": UA, "sra_address": UA},
    )
    assert reg.status_code == 200

    with patch.object(AxisAgent, "run", _run_with_real_defi):
        activate = await live_client.post(
            "/api/agent/activate",
            headers=AUTH,
            json={
                "user_id": "test-user",
                "budget_usdc": 50,
                "risk_level": "moderate",
                "goal": "maximize yield",
                "ua_address": UA,
                "sra_address": UA,
            },
        )

    assert activate.status_code == 200, activate.text
    body = activate.json()
    assert body["status"] == "activated"
    actions = body.get("actions") or []
    tx_action = next((a for a in actions if a.get("result", {}).get("tx_hash")), None)
    assert tx_action is not None, actions
    assert str(tx_action["result"]["tx_hash"]).startswith("0x")

    status = await live_client.get("/api/agent/status/test-user", headers=AUTH)
    assert status.status_code == 200
