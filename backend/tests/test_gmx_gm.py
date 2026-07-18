"""Lock the GMX V2 GM deposit/withdrawal calldata layout.

GMX is a user-signed action, but a malformed struct still wastes gas and could
mis-route funds. These tests decode the real multicall + create* structs and
assert the receiver, market, tokens, and execution fee are exactly right, so any
drift in the (nested) struct encoding fails here before a user ever signs.
"""

from __future__ import annotations

from eth_abi import decode
from eth_utils import function_signature_to_4byte_selector, to_checksum_address

from services import gmx_gm as gmx

OWNER = to_checksum_address("0x1111111111111111111111111111111111111111")
FEE_WEI = 500_000_000_000_000  # 0.0005 ETH, fixed so tests never hit the RPC


def _sel(sig: str) -> bytes:
    return function_signature_to_4byte_selector(sig)


def _inner_calls(multicall_data_hex: str) -> list[bytes]:
    raw = bytes.fromhex(multicall_data_hex[2:])
    assert raw[:4] == _sel(gmx.MULTICALL_SIG)
    (calls,) = decode(["bytes[]"], raw[4:])
    return list(calls)


def test_deposit_tx_shapes_and_targets():
    txs, fee = gmx.build_gm_deposit_txs(owner=OWNER, usdc_amount=100.0, execution_fee_wei=FEE_WEI)
    assert fee == FEE_WEI
    assert [t["purpose"] for t in txs] == ["approve_usdc_gmx_router", "gmx_multicall"]

    approve = txs[0]
    assert to_checksum_address(approve["to"]) == to_checksum_address(gmx.USDC_ARBITRUM)
    assert approve["value"] == "0x0"

    multicall = txs[1]
    assert to_checksum_address(multicall["to"]) == to_checksum_address(gmx.EXCHANGE_ROUTER)
    # msg.value must equal the execution fee sent via sendWnt.
    assert int(multicall["value"], 16) == FEE_WEI


def test_deposit_multicall_inner_calls_pin_owner_and_market():
    txs, _ = gmx.build_gm_deposit_txs(owner=OWNER, usdc_amount=100.0, execution_fee_wei=FEE_WEI)
    calls = _inner_calls(txs[1]["data"])
    assert len(calls) == 3

    # 1) sendWnt(DepositVault, fee)
    assert calls[0][:4] == _sel(gmx.SEND_WNT_SIG)
    wnt_receiver, wnt_amount = decode(["address", "uint256"], calls[0][4:])
    assert to_checksum_address(wnt_receiver) == to_checksum_address(gmx.DEPOSIT_VAULT)
    assert wnt_amount == FEE_WEI

    # 2) sendTokens(USDC, DepositVault, usdc_raw)
    assert calls[1][:4] == _sel(gmx.SEND_TOKENS_SIG)
    tok, tok_receiver, tok_amount = decode(["address", "address", "uint256"], calls[1][4:])
    assert to_checksum_address(tok) == to_checksum_address(gmx.USDC_ARBITRUM)
    assert to_checksum_address(tok_receiver) == to_checksum_address(gmx.DEPOSIT_VAULT)
    assert tok_amount == gmx.usdc_to_raw(100.0)

    # 3) createDeposit(params) — receiver + market + tokens + fee pinned.
    assert calls[2][:4] == _sel(gmx.CREATE_DEPOSIT_SIG)
    (params,) = decode([gmx._DEPOSIT_PARAMS_TYPE], calls[2][4:])
    addresses, min_market_tokens, should_unwrap, exec_fee, cb_gas, data_list = params
    receiver, cb, ui, market, long_tok, short_tok, long_path, short_path = addresses
    assert to_checksum_address(receiver) == OWNER
    assert to_checksum_address(market) == to_checksum_address(gmx.GM_ETH_USD_MARKET)
    assert to_checksum_address(long_tok) == to_checksum_address(gmx.WETH_ARBITRUM)
    assert to_checksum_address(short_tok) == to_checksum_address(gmx.USDC_ARBITRUM)
    assert list(long_path) == [] and list(short_path) == []
    assert exec_fee == FEE_WEI
    assert min_market_tokens == 0 and should_unwrap is False and cb_gas == 0
    assert list(data_list) == []


def test_withdraw_multicall_inner_calls_pin_owner_and_market():
    txs, _ = gmx.build_gm_withdraw_txs(owner=OWNER, gm_amount_raw=10**18, execution_fee_wei=FEE_WEI)
    assert [t["purpose"] for t in txs] == ["approve_gm_gmx_router", "gmx_multicall"]
    # approve targets the GM token -> GMX Router
    assert to_checksum_address(txs[0]["to"]) == to_checksum_address(gmx.GM_ETH_USD_MARKET)

    calls = _inner_calls(txs[1]["data"])
    assert len(calls) == 3

    assert calls[0][:4] == _sel(gmx.SEND_WNT_SIG)
    wnt_receiver, wnt_amount = decode(["address", "uint256"], calls[0][4:])
    assert to_checksum_address(wnt_receiver) == to_checksum_address(gmx.WITHDRAWAL_VAULT)
    assert wnt_amount == FEE_WEI

    assert calls[1][:4] == _sel(gmx.SEND_TOKENS_SIG)
    tok, tok_receiver, tok_amount = decode(["address", "address", "uint256"], calls[1][4:])
    assert to_checksum_address(tok) == to_checksum_address(gmx.GM_ETH_USD_MARKET)
    assert to_checksum_address(tok_receiver) == to_checksum_address(gmx.WITHDRAWAL_VAULT)
    assert tok_amount == 10**18

    assert calls[2][:4] == _sel(gmx.CREATE_WITHDRAWAL_SIG)
    (params,) = decode([gmx._WITHDRAWAL_PARAMS_TYPE], calls[2][4:])
    addresses, min_long, min_short, should_unwrap, exec_fee, cb_gas, data_list = params
    receiver, cb, ui, market, long_path, short_path = addresses
    assert to_checksum_address(receiver) == OWNER
    assert to_checksum_address(market) == to_checksum_address(gmx.GM_ETH_USD_MARKET)
    assert should_unwrap is True  # WETH leg returned as native ETH
    assert exec_fee == FEE_WEI
    assert min_long == 0 and min_short == 0


def test_deposit_rejects_nonpositive_amount():
    for bad in (0.0, -5.0):
        try:
            gmx.build_gm_deposit_txs(owner=OWNER, usdc_amount=bad, execution_fee_wei=FEE_WEI)
        except ValueError:
            continue
        raise AssertionError("expected ValueError for non-positive deposit amount")


def test_execution_fee_is_clamped_to_safe_band():
    # Whatever gas price the estimator sees, the fee stays within the guard band.
    fee = gmx.estimate_execution_fee_wei()
    assert gmx._MIN_EXECUTION_FEE_WEI <= fee <= gmx._MAX_EXECUTION_FEE_WEI
