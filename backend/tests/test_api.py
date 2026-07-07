"""Backend smoke tests."""

import pytest


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
async def test_activate_rules_engine(client):
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
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "activated"
    assert "explanation" in data
    assert data["actions_taken"] >= 1


@pytest.mark.asyncio
async def test_agent_status_after_activate(client):
    user_id = "test-user-2"
    await client.post(
        "/api/agent/activate",
        json={
            "user_id": user_id,
            "budget_usdc": 300,
            "risk_level": "conservative",
            "goal": "protect capital",
            "ua_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        },
    )
    r = await client.get(f"/api/agent/status/{user_id}")
    assert r.status_code == 200
    data = r.json()
    assert data["active"] is True
    assert len(data["positions"]) >= 1


@pytest.mark.asyncio
async def test_weekly_report(client):
    user_id = "test-user-3"
    await client.post(
        "/api/agent/activate",
        json={
            "user_id": user_id,
            "budget_usdc": 200,
            "risk_level": "moderate",
            "goal": "steady yield",
            "ua_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        },
    )
    r = await client.get(f"/api/agent/report/{user_id}")
    assert r.status_code == 200
    assert "report" in r.json()


@pytest.mark.asyncio
async def test_gmx_yield_endpoint(client):
    r = await client.get("/api/portfolio/yields/gmx")
    assert r.status_code == 200
    data = r.json()
    assert "apy" in data
