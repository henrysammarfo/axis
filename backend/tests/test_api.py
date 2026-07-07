"""Backend smoke tests."""

import pytest

AUTH = {"Authorization": "Bearer test-did-token"}


@pytest.mark.asyncio
async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["service"] == "axis-backend"


@pytest.mark.asyncio
async def test_config_status(client):
    r = await client.get("/config/status")
    assert r.status_code == 200
    data = r.json()
    assert "ai" in data
    assert "wallet" in data


@pytest.mark.asyncio
async def test_activate_requires_auth(client):
    r = await client.post(
        "/api/agent/activate",
        json={
            "user_id": "test-user-1",
            "budget_usdc": 500,
            "risk_level": "moderate",
            "goal": "maximize yield",
            "ua_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        },
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_activate_with_auth(client, monkeypatch):
    async def mock_run(self, **kwargs):
        return {
            "actions": [{"tool": "check_aave_yield", "input": {}, "result": {"supply_apy": 4.2}}],
            "explanation": "Test allocation complete.",
            "user_id": kwargs["user_id"],
            "budget_usdc": kwargs["budget_usdc"],
            "provider": "venice",
        }

    monkeypatch.setattr("routes.agent.AxisAgent.run", mock_run)

    r = await client.post(
        "/api/agent/activate",
        headers=AUTH,
        json={
            "user_id": "test-user",
            "budget_usdc": 500,
            "risk_level": "moderate",
            "goal": "maximize yield",
            "ua_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "activated"
    assert "explanation" in data


@pytest.mark.asyncio
async def test_agent_status_requires_auth(client):
    r = await client.get("/api/agent/status/test-user")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_gmx_yield_endpoint(client):
    r = await client.get("/api/portfolio/yields/gmx")
    assert r.status_code == 200
    data = r.json()
    assert "apy" in data
