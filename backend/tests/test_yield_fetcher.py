"""Unit tests for Aave yield fetching."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from chain_config import liquidity_rate_to_apy_percent
from services.yield_fetcher import YieldFetcher


def test_liquidity_rate_to_apy():
    # Known Sepolia USDC rate from live RPC probe
    apy = liquidity_rate_to_apy_percent(42_792_724_900_482_761_117_060_582)
    assert 4.0 < apy < 5.0


@pytest.mark.asyncio
async def test_aave_onchain_sepolia_usdc():
    fetcher = YieldFetcher()
    fetcher.chain_id = 421614
    fetcher.chain_name = "arbitrum-sepolia"

    with patch("services.yield_fetcher.Web3") as mock_web3_cls:
        mock_w3 = MagicMock()
        mock_web3_cls.HTTPProvider.return_value = MagicMock()
        mock_web3_cls.return_value = mock_w3
        mock_web3_cls.to_checksum_address.side_effect = lambda a: a

        mock_contract = MagicMock()
        mock_w3.eth.contract.return_value = mock_contract
        mock_contract.functions.getReserveData.return_value.call.return_value = (
            0,
            0,
            0,
            0,
            0,
            42_792_724_900_482_761_117_060_582,
            0,
            0,
            0,
            0,
            0,
            0,
        )

        result = fetcher._fetch_aave_onchain("USDC")

    assert result["asset"] == "USDC"
    assert result["source"] == "aave_onchain"
    assert result["supply_apy"] > 0


@pytest.mark.asyncio
async def test_aave_graphql_parses_usdc():
    fetcher = YieldFetcher()
    fetcher.chain_id = 42161
    fetcher.chain_name = "arbitrum"

    graphql_response = {
        "data": {
            "markets": [
                {
                    "name": "AaveV3Arbitrum",
                    "reserves": [
                        {
                            "underlyingToken": {"symbol": "USDC"},
                            "supplyInfo": {"apy": {"value": "3.79", "formatted": "3.79"}},
                        }
                    ],
                }
            ]
        }
    }

    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.json = MagicMock(return_value=graphql_response)

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=resp)

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
        result = await fetcher._fetch_aave_graphql("USDC")

    assert result is not None
    assert result["supply_apy"] == 3.79
    assert result["source"] == "aave_api"


@pytest.mark.asyncio
async def test_get_aave_apy_sepolia_uses_onchain(monkeypatch):
    fetcher = YieldFetcher()
    fetcher.chain_id = 421614

    async def _no_tinyfish(_asset):
        return None

    monkeypatch.setattr(fetcher, "_tinyfish_aave_apy", _no_tinyfish)
    monkeypatch.setattr(
        fetcher,
        "_fetch_aave_onchain",
        lambda asset: {
            "asset": asset,
            "supply_apy": 4.37,
            "protocol": "aave_v3",
            "chain": "arbitrum-sepolia",
            "source": "aave_onchain",
        },
    )

    result = await fetcher.get_aave_apy("USDC")
    assert result["source"] == "aave_onchain"
    assert result["supply_apy"] == 4.37
