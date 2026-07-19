"""Lock the GMX V2 GM deposit/withdrawal calldata layout (signing-free session).

GMX runs through the AXIS session key (no user signature). Each action is a batch
of individual calls — approve, sendWnt, sendTokens, create* — executed atomically
in one UserOp. These tests:

  * assert the call shapes/targets/values are exactly right, and
  * LOCK the pinned calldata offsets (receiver + market) that the session
    CallPolicy in src/lib/kernel-session.ts relies on. If the (nested) struct
    encoding ever drifts, the pinned word moves and these tests fail *before* a
    leaked-key misroute could ever be possible.
"""

from __future__ import annotations

from eth_abi import decode
from eth_utils import function_signature_to_4byte_selector, to_checksum_address

from services import gmx_gm as gmx

OWNER = to_checksum_address("0x1111111111111111111111111111111111111111")
FEE_WEI = 500_000_000_000_000  # 0.0005 ETH, fixed so tests never hit the RPC


def _sel(sig: str) -> bytes:
    return function_signature_to_4byte_selector(sig)


def _data(call: dict) -> bytes:
    return bytes.fromhex(call["data"][2:])


def _word_at(call: dict, offset_after_selector: int) -> bytes:
    """The 32-byte word at `offset` bytes past the 4-byte selector."""
    raw = _data(call)[4:]
    return raw[offset_after_selector : offset_after_selector + 32]


def _addr_word(addr: str) -> bytes:
    return bytes.fromhex(to_checksum_address(addr)[2:].zfill(64))


# --- Deposit ---------------------------------------------------------------


def test_deposit_call_shapes_and_targets():
    calls, fee = gmx.build_gm_deposit_calls(owner=OWNER, usdc_amount=100.0, execution_fee_wei=FEE_WEI)
    assert fee == FEE_WEI
    assert [c["purpose"] for c in calls] == [
        "approve_usdc_gmx_router",
        "gmx_send_wnt",
        "gmx_send_tokens",
        "gmx_create_deposit",
    ]

    approve, send_wnt, send_tokens, create = calls
    # approve USDC -> GMX Router, no value.
    assert to_checksum_address(approve["to"]) == to_checksum_address(gmx.USDC_ARBITRUM)
    assert int(approve["value"], 16) == 0
    # only sendWnt carries the ETH keeper fee; everything else targets ExchangeRouter with 0 value.
    for c in (send_wnt, send_tokens, create):
        assert to_checksum_address(c["to"]) == to_checksum_address(gmx.EXCHANGE_ROUTER)
    assert int(send_wnt["value"], 16) == FEE_WEI
    assert int(send_tokens["value"], 16) == 0
    assert int(create["value"], 16) == 0


def test_deposit_calls_pin_vault_owner_and_market():
    calls, _ = gmx.build_gm_deposit_calls(owner=OWNER, usdc_amount=100.0, execution_fee_wei=FEE_WEI)
    _, send_wnt, send_tokens, create = calls

    # sendWnt(DepositVault, fee)
    assert _data(send_wnt)[:4] == _sel(gmx.SEND_WNT_SIG)
    wnt_receiver, wnt_amount = decode(["address", "uint256"], _data(send_wnt)[4:])
    assert to_checksum_address(wnt_receiver) == to_checksum_address(gmx.DEPOSIT_VAULT)
    assert wnt_amount == FEE_WEI

    # sendTokens(USDC, DepositVault, usdc_raw)
    assert _data(send_tokens)[:4] == _sel(gmx.SEND_TOKENS_SIG)
    tok, tok_receiver, tok_amount = decode(["address", "address", "uint256"], _data(send_tokens)[4:])
    assert to_checksum_address(tok) == to_checksum_address(gmx.USDC_ARBITRUM)
    assert to_checksum_address(tok_receiver) == to_checksum_address(gmx.DEPOSIT_VAULT)
    assert tok_amount == gmx.usdc_to_raw(100.0)

    # createDeposit(params) — full decode.
    assert _data(create)[:4] == _sel(gmx.CREATE_DEPOSIT_SIG)
    (params,) = decode([gmx._DEPOSIT_PARAMS_TYPE], _data(create)[4:])
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


def test_deposit_receiver_and_market_land_at_pinned_offsets():
    """The CallPolicy pins these exact offsets — lock them against struct drift."""
    calls, _ = gmx.build_gm_deposit_calls(owner=OWNER, usdc_amount=100.0, execution_fee_wei=FEE_WEI)
    create = calls[3]
    assert _word_at(create, gmx.DEPOSIT_RECEIVER_OFFSET) == _addr_word(OWNER)
    assert _word_at(create, gmx.DEPOSIT_MARKET_OFFSET) == _addr_word(gmx.GM_ETH_USD_MARKET)


# --- Withdraw --------------------------------------------------------------


def test_withdraw_call_shapes_and_targets():
    calls, fee = gmx.build_gm_withdraw_calls(owner=OWNER, gm_amount_raw=10**18, execution_fee_wei=FEE_WEI)
    assert fee == FEE_WEI
    assert [c["purpose"] for c in calls] == [
        "approve_gm_gmx_router",
        "gmx_send_wnt",
        "gmx_send_tokens",
        "gmx_create_withdrawal",
    ]
    approve, send_wnt, send_tokens, create = calls
    # approve targets the GM token -> GMX Router.
    assert to_checksum_address(approve["to"]) == to_checksum_address(gmx.GM_ETH_USD_MARKET)
    assert int(send_wnt["value"], 16) == FEE_WEI
    assert int(send_tokens["value"], 16) == 0
    assert int(create["value"], 16) == 0


def test_withdraw_calls_pin_vault_owner_and_market():
    calls, _ = gmx.build_gm_withdraw_calls(owner=OWNER, gm_amount_raw=10**18, execution_fee_wei=FEE_WEI)
    _, send_wnt, send_tokens, create = calls

    assert _data(send_wnt)[:4] == _sel(gmx.SEND_WNT_SIG)
    wnt_receiver, wnt_amount = decode(["address", "uint256"], _data(send_wnt)[4:])
    assert to_checksum_address(wnt_receiver) == to_checksum_address(gmx.WITHDRAWAL_VAULT)
    assert wnt_amount == FEE_WEI

    assert _data(send_tokens)[:4] == _sel(gmx.SEND_TOKENS_SIG)
    tok, tok_receiver, tok_amount = decode(["address", "address", "uint256"], _data(send_tokens)[4:])
    assert to_checksum_address(tok) == to_checksum_address(gmx.GM_ETH_USD_MARKET)
    assert to_checksum_address(tok_receiver) == to_checksum_address(gmx.WITHDRAWAL_VAULT)
    assert tok_amount == 10**18

    assert _data(create)[:4] == _sel(gmx.CREATE_WITHDRAWAL_SIG)
    (params,) = decode([gmx._WITHDRAWAL_PARAMS_TYPE], _data(create)[4:])
    addresses, min_long, min_short, should_unwrap, exec_fee, cb_gas, data_list = params
    receiver, cb, ui, market, long_path, short_path = addresses
    assert to_checksum_address(receiver) == OWNER
    assert to_checksum_address(market) == to_checksum_address(gmx.GM_ETH_USD_MARKET)
    assert should_unwrap is True  # WETH leg returned as native ETH
    assert exec_fee == FEE_WEI
    assert min_long == 0 and min_short == 0


def test_withdraw_receiver_and_market_land_at_pinned_offsets():
    calls, _ = gmx.build_gm_withdraw_calls(owner=OWNER, gm_amount_raw=10**18, execution_fee_wei=FEE_WEI)
    create = calls[3]
    assert _word_at(create, gmx.WITHDRAW_RECEIVER_OFFSET) == _addr_word(OWNER)
    assert _word_at(create, gmx.WITHDRAW_MARKET_OFFSET) == _addr_word(gmx.GM_ETH_USD_MARKET)


# --- Guards ----------------------------------------------------------------


def test_deposit_rejects_nonpositive_amount():
    for bad in (0.0, -5.0):
        try:
            gmx.build_gm_deposit_calls(owner=OWNER, usdc_amount=bad, execution_fee_wei=FEE_WEI)
        except ValueError:
            continue
        raise AssertionError("expected ValueError for non-positive deposit amount")


def test_execution_fee_is_clamped_to_safe_band():
    # Whatever gas price the estimator sees, the fee stays within the guard band,
    # and the guard band stays under the session's sendWnt value cap.
    fee = gmx.estimate_execution_fee_wei()
    assert gmx._MIN_EXECUTION_FEE_WEI <= fee <= gmx._MAX_EXECUTION_FEE_WEI
    assert gmx._MAX_EXECUTION_FEE_WEI <= gmx.SEND_WNT_VALUE_CAP_WEI
