"""Live external API integrations — Venice, TinyFish, yields."""

import pytest
import httpx

from services.yield_fetcher import YieldFetcher
from config import get_settings


@pytest.mark.live
@pytest.mark.asyncio
async def test_live_venice_chat(live_settings):
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{live_settings.venice_base_url}/chat/completions",
            headers={"Authorization": f"Bearer {live_settings.venice_api_key}"},
            json={
                "model": live_settings.venice_model,
                "messages": [{"role": "user", "content": "Reply OK"}],
                "max_tokens": 10,
            },
        )
    assert r.status_code == 200
    content = r.json()["choices"][0]["message"]["content"]
    assert len(content) > 0


@pytest.mark.live
@pytest.mark.asyncio
async def test_live_aave_yield_fetch(live_settings):
    fetcher = YieldFetcher()
    data = await fetcher.get_aave_apy("USDC")
    assert data["source"] == "aave_onchain"
    assert data["supply_apy"] > 0


@pytest.mark.live
@pytest.mark.asyncio
async def test_live_defi_executor_aave_supply_tx(live_settings):
    from services.defi_executor import DeFiExecutor

    executor = DeFiExecutor("0xB883e76A4f6841E72cAF1C28ba00f78df974f448")
    result = await executor.execute(
        protocol="aave",
        asset="USDC",
        amount_usdc=0.1,
        action="supply",
        user_id="live-defi-user",
    )
    assert result.get("success") is True, result
    assert result.get("tx_hash", "").startswith("0x")
