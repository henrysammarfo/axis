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
    assert data["fully_configured"] is True


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
    """Activate is setup-only: saves plan, no funding/signing required."""

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
            "budget_usdc": 500,
            "risk_level": "moderate",
            "goal": "Maximize yield",
            "ua_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "activated"
    assert "plan" in data
    assert "transactions" not in data
    assert "explanation" in data


@pytest.mark.asyncio
async def test_deploy_prepare_returns_transactions(client, monkeypatch):
    async def mock_apys():
        return {"USDC": 4.2, "USDT": 4.0}

    # The deploy flow now reads idle USDC straight from chain and caps it at the
    # budget room, so stub the on-chain balance read instead of the old
    # require_usdc_funding helper (removed in the gasless/session refactor).
    def mock_balance(owner, asset):
        return 500.0

    monkeypatch.setattr("routes.agent._live_aave_apys", mock_apys)
    monkeypatch.setattr("routes.agent.get_token_balance_usdc", mock_balance)

    await client.post(
        "/api/auth/register",
        json={
            "did_token": "test-did-token",
            "ua_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        },
    )

    r = await client.post(
        "/api/agent/deploy/prepare",
        headers=AUTH,
        json={
            "user_id": "test-user",
            "budget_usdc": 500,
            "risk_level": "moderate",
            "goal": "Maximize yield",
            "ua_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "pending_signatures"
    assert len(data["transactions"]) >= 2


@pytest.mark.asyncio
async def test_activate_rejects_invalid_risk(client):
    r = await client.post(
        "/api/agent/activate",
        headers=AUTH,
        json={
            "user_id": "test-user",
            "budget_usdc": 100,
            "risk_level": "low",
            "goal": "Maximize yield",
            "ua_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        },
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_agent_status_requires_auth(client):
    r = await client.get("/api/agent/status/test-user")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_gmx_yield_endpoint(client, monkeypatch):
    async def mock_gmx(self):
        return {
            "protocol": "gmx_glp",
            "apy": 12.5,
            "chain": "arbitrum",
            "risk": "medium",
            "source": "gmx_api",
        }

    monkeypatch.setattr("routes.portfolio.YieldFetcher.get_gmx_apy", mock_gmx)

    r = await client.get("/api/portfolio/yields/gmx")
    assert r.status_code == 200
    data = r.json()
    assert "apy" in data
