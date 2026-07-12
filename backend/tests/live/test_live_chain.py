"""Live on-chain writes — ETH ping, Aave supply (Arbitrum Sepolia)."""

import pytest

from services.onchain import OnChainExecutor


@pytest.mark.live
def test_live_rpc_block_number(live_settings):
    executor = OnChainExecutor()
    block = executor.w3.eth.block_number
    assert block > 0
    assert executor.w3.eth.chain_id == live_settings.arbitrum_chain_id


@pytest.mark.live
def test_live_eth_self_transfer_tx(live_settings):
    executor = OnChainExecutor()
    before = executor.get_eth_balance_wei()
    result = executor.send_eth_self_ping(value_wei=0)
    assert result["success"] is True
    assert result["tx_hash"].startswith("0x")
    assert len(result["tx_hash"]) == 66
    after = executor.get_eth_balance_wei()
    assert after <= before  # gas spent


@pytest.mark.live
def test_live_aave_usdc_supply_tx(live_settings):
    executor = OnChainExecutor()
    usdc_before = executor.get_usdc_balance_raw()
    if usdc_before < 100_000:
        pytest.skip("Agent wallet needs >= 0.1 USDC on Arbitrum Sepolia")

    result = executor.supply_aave_usdc(0.1)
    assert result["success"] is True
    assert result["tx_hash"].startswith("0x")
    assert result["approve_tx_hash"].startswith("0x")
    usdc_after = executor.get_usdc_balance_raw()
    assert usdc_after < usdc_before
