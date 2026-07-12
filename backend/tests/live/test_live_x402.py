"""Live x402 micropayment with on-chain settlement."""

import pytest

from services.x402_signer import X402_ECHO_ARBITRUM_SEPOLIA, pay_url


@pytest.mark.live
@pytest.mark.asyncio
async def test_live_x402_payment_tx(live_settings):
    result = await pay_url(X402_ECHO_ARBITRUM_SEPOLIA)
    settlement = result["settlement"]
    assert settlement is not None
    assert settlement.get("success") is True
    tx_hash = settlement.get("transaction")
    assert tx_hash and tx_hash.startswith("0x")


@pytest.mark.live
@pytest.mark.asyncio
async def test_live_x402_intelligence_client(live_settings):
    from services.x402_client import X402Client

    client = X402Client("0xB883e76A4f6841E72cAF1C28ba00f78df974f448", None)
    intel = await client.fetch_intelligence("Arbitrum DeFi yield outlook", "live-test-user")
    assert intel.get("paid") is True
    assert intel.get("source") == "x402"
    assert intel.get("tx_hash", "").startswith("0x")
