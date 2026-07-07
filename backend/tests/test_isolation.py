"""Multi-tenant isolation and authorization tests."""

import pytest

from services.ai_agent import AxisAgent
from services.defi_executor import DeFiExecutor
from services.portfolio_tracker import PortfolioTracker
from services.x402_client import X402Client

AUTH_USER_A = {"Authorization": "Bearer test-did-token"}
AUTH_USER_B = {"Authorization": "Bearer test-did-token-user-b"}

UA_A = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
UA_B = "0x2222222222222222222222222222222222222222"


@pytest.mark.asyncio
async def test_status_forbidden_cross_tenant(client):
    r = await client.get("/api/agent/status/test-user-b", headers=AUTH_USER_A)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_report_forbidden_cross_tenant(client):
    r = await client.get("/api/agent/report/test-user-b", headers=AUTH_USER_A)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_history_forbidden_cross_tenant(client):
    r = await client.get("/api/portfolio/history/test-user-b", headers=AUTH_USER_A)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_activate_forbidden_wrong_user_id(client, monkeypatch):
    async def mock_run(self, **kwargs):
        return {
            "actions": [],
            "explanation": "ok",
            "user_id": kwargs["user_id"],
            "budget_usdc": kwargs["budget_usdc"],
            "provider": "venice",
        }

    monkeypatch.setattr("routes.agent.AxisAgent.run", mock_run)

    r = await client.post(
        "/api/agent/activate",
        headers=AUTH_USER_A,
        json={
            "user_id": "test-user-b",
            "budget_usdc": 500,
            "risk_level": "moderate",
            "goal": "maximize yield",
            "ua_address": UA_B,
        },
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_rebalance_rejects_foreign_ua_address(client):
    await client.post(
        "/api/auth/register",
        json={"did_token": "test-did-token", "ua_address": UA_A},
    )

    r = await client.post(
        "/api/agent/rebalance",
        headers=AUTH_USER_A,
        json={
            "user_id": "test-user",
            "ua_address": UA_B,
            "instruction": "move to safer assets",
        },
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_register_rejects_claimed_ua_address(client):
    first = await client.post(
        "/api/auth/register",
        json={"did_token": "test-did-token", "ua_address": UA_A},
    )
    assert first.status_code == 200

    second = await client.post(
        "/api/auth/register",
        json={"did_token": "test-did-token-user-b", "ua_address": UA_A},
    )
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_agent_tool_positions_ignore_foreign_user_id(db_session):
    tracker = PortfolioTracker(db_session)
    await tracker.ensure_user("test-user", ua_address=UA_A)
    await tracker.ensure_user("test-user-b", ua_address=UA_B)
    await tracker.log_action(
        "test-user-b",
        "execute_allocation",
        {"protocol": "aave", "asset": "USDC", "amount_usdc": 100, "action": "supply"},
        {"success": True, "estimated_apy": 4.0, "tx_hash": "0xabc", "chain": "arbitrum"},
    )

    agent = AxisAgent(DeFiExecutor(UA_A), X402Client(UA_A, db_session), tracker)
    agent._session_user_id = "test-user"
    agent._budget_usdc = 500
    agent._allocated_usdc = 0

    result = await agent._execute_tool(
        "get_current_positions",
        {"user_id": "test-user-b"},
        "test-user",
    )

    assert result["positions"] == []


@pytest.mark.asyncio
async def test_agent_allocation_respects_budget_cap(db_session):
    tracker = PortfolioTracker(db_session)
    agent = AxisAgent(DeFiExecutor(UA_A), X402Client(UA_A, db_session), tracker)
    agent._session_user_id = "test-user"
    agent._budget_usdc = 100
    agent._allocated_usdc = 0

    first = await agent._execute_tool(
        "execute_allocation",
        {
            "protocol": "aave",
            "asset": "USDC",
            "amount_usdc": 80,
            "action": "supply",
        },
        "test-user",
    )
    assert first["success"] is False

    second = await agent._execute_tool(
        "execute_allocation",
        {
            "protocol": "aave",
            "asset": "USDC",
            "amount_usdc": 120,
            "action": "supply",
        },
        "test-user",
    )
    assert second["success"] is False
    assert "budget" in second["error"].lower()
