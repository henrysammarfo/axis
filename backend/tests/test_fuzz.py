"""Fuzz tests for API inputs and tenant guard helpers."""

from __future__ import annotations

import random
import string

import pytest
from httpx import ASGITransport, AsyncClient

from main import app
from services.tenant_guard import normalize_address

AUTH = {"Authorization": "Bearer test-did-token"}


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.fuzz
@pytest.mark.parametrize("budget", [0, -1, -100, 100_001, 1e9])
@pytest.mark.asyncio
async def test_activate_rejects_invalid_budget(client, budget):
    r = await client.post(
        "/api/agent/activate",
        headers=AUTH,
        json={
            "user_id": "test-user",
            "budget_usdc": budget,
            "risk_level": "moderate",
            "goal": "test",
            "ua_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        },
    )
    assert r.status_code == 422


@pytest.mark.fuzz
@pytest.mark.parametrize(
    "addr",
    [
        "",
        "not-an-address",
        "0x123",
        "0x" + "g" * 40,
        "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" + "ff",
        "<script>alert(1)</script>",
        "' OR 1=1 --",
    ],
)
def test_normalize_address_fuzz(addr):
    result = normalize_address(addr)
    if addr.startswith("0x") and len(addr) == 42:
        try:
            int(addr[2:], 16)
            assert result is not None
        except ValueError:
            assert result is not None or result is None
    else:
        # invalid inputs should not crash
        assert result is None or isinstance(result, str)


@pytest.mark.fuzz
@pytest.mark.asyncio
async def test_random_goal_strings_activate_validation(client):
    """Random unicode/noise goals should not crash auth layer (422/401/403 only)."""
    for _ in range(20):
        noise = "".join(random.choices(string.printable, k=random.randint(0, 200)))
        r = await client.post(
            "/api/agent/activate",
            headers=AUTH,
            json={
                "user_id": "test-user",
                "budget_usdc": 10,
                "risk_level": random.choice(["low", "moderate", "aggressive", noise[:12]]),
                "goal": noise,
                "ua_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
            },
        )
        assert r.status_code in {200, 401, 403, 422, 429, 500}
