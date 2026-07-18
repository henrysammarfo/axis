"""Stress tests — concurrent API load."""

from __future__ import annotations

import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from main import app

AUTH = {"Authorization": "Bearer test-did-token"}


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.stress
@pytest.mark.asyncio
async def test_concurrent_health_checks(client):
    async def one():
        return await client.get("/health")

    results = await asyncio.gather(*[one() for _ in range(50)])
    assert all(r.status_code == 200 for r in results)


@pytest.mark.stress
@pytest.mark.asyncio
async def test_concurrent_yield_endpoints(client):
    async def aave():
        return await client.get("/api/portfolio/yields/aave/USDC")

    results = await asyncio.gather(*[aave() for _ in range(15)])
    codes = {r.status_code for r in results}
    assert codes <= {200, 500, 503}


@pytest.mark.stress
@pytest.mark.asyncio
async def test_concurrent_activate_requests(client):
    """10 parallel activations with mocked funding — exercises DB + rate limiter."""
    from unittest.mock import AsyncMock, patch

    await client.post(
        "/api/auth/register",
        json={
            "did_token": "test-did-token",
            "ua_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        },
    )

    async def activate_once(i: int):
        with (
            patch("routes.agent._live_aave_apys", new_callable=AsyncMock) as mock_apys,
            patch("routes.agent.AxisAgent.explain_plan", new_callable=AsyncMock) as mock_explain,
        ):
            mock_apys.return_value = {"USDC": 4.0, "USDT": 4.0}
            mock_explain.return_value = {
                "explanation": f"ok-{i}",
                "provider": "template",
                "actions": [],
            }
            return await client.post(
                "/api/agent/activate",
                headers=AUTH,
                json={
                    "user_id": "test-user",
                    "budget_usdc": 25,
                    "risk_level": "moderate",
                    "goal": "Grow steadily",
                    "ua_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
                },
            )

    results = await asyncio.gather(*[activate_once(i) for i in range(10)])
    statuses = [r.status_code for r in results]
    assert all(s in {200, 429, 500} for s in statuses)
    assert 429 in statuses or 200 in statuses
    if 200 in statuses:
        body = next(r.json() for r in results if r.status_code == 200)
        assert body["status"] == "activated"
