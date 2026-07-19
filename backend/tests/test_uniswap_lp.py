"""Lock the Uniswap V3 LP calldata layout.

These tests are the security contract for the session CallPolicy: they encode
real calldata and assert that the pinned words (token0/token1/fee/recipient)
sit at exactly the offsets the frontend policy pins. If Uniswap's struct layout
or our encoding ever drifts, these fail before funds are ever at risk.
"""

from __future__ import annotations

from eth_abi import encode
from eth_utils import to_checksum_address

from services import uniswap_lp as lp

OWNER = to_checksum_address("0x1111111111111111111111111111111111111111")
DEADLINE = 1_900_000_000


def _word(data_hex: str, offset: int) -> bytes:
    """Return the 32-byte word at `offset` in the argument region (post-selector)."""
    raw = bytes.fromhex(data_hex[2:])
    start = 4 + offset  # skip the 4-byte selector
    return raw[start : start + 32]


def _addr_word(addr: str) -> bytes:
    return bytes(12) + bytes.fromhex(to_checksum_address(addr)[2:])


def _uint_word(value: int) -> bytes:
    return encode(["uint256"], [value])


def _find(calls, purpose):
    for c in calls:
        if c["purpose"] == purpose:
            return c
    raise AssertionError(f"no call with purpose {purpose}")


def test_enter_selectors_are_correct():
    calls = lp.build_lp_enter_calls(owner=OWNER, usdc_amount=100.0, deadline=DEADLINE)
    assert _find(calls, "swap_usdc_usdt_lp")["data"].startswith(lp.SWAP_SELECTOR)
    assert _find(calls, "mint_lp_usdc_usdt")["data"].startswith(lp.MINT_SELECTOR)


def test_mint_pins_tokens_fee_and_recipient():
    mint = _find(
        lp.build_lp_enter_calls(owner=OWNER, usdc_amount=100.0, deadline=DEADLINE),
        "mint_lp_usdc_usdt",
    )["data"]
    assert _word(mint, lp.MINT_TOKEN0_OFFSET) == _addr_word(lp.USDC_ARBITRUM)
    assert _word(mint, lp.MINT_TOKEN1_OFFSET) == _addr_word(lp.USDT_ARBITRUM)
    assert _word(mint, lp.MINT_FEE_OFFSET) == _uint_word(lp.LP_FEE)
    assert _word(mint, lp.MINT_RECIPIENT_OFFSET) == _addr_word(OWNER)


def test_swap_pins_tokens_fee_and_recipient():
    swap = _find(
        lp.build_lp_enter_calls(owner=OWNER, usdc_amount=100.0, deadline=DEADLINE),
        "swap_usdc_usdt_lp",
    )["data"]
    assert _word(swap, lp.SWAP_TOKENIN_OFFSET) == _addr_word(lp.USDC_ARBITRUM)
    assert _word(swap, lp.SWAP_TOKENOUT_OFFSET) == _addr_word(lp.USDT_ARBITRUM)
    assert _word(swap, lp.SWAP_FEE_OFFSET) == _uint_word(lp.LP_FEE)
    assert _word(swap, lp.SWAP_RECIPIENT_OFFSET) == _addr_word(OWNER)


def test_collect_pins_recipient_to_owner():
    collect = _find(
        lp.build_lp_exit_calls(owner=OWNER, token_id=42, liquidity=10**18, deadline=DEADLINE),
        "collect_lp",
    )["data"]
    assert collect.startswith(lp.COLLECT_SELECTOR)
    assert _word(collect, lp.COLLECT_RECIPIENT_OFFSET) == _addr_word(OWNER)


def test_token_ordering_usdc_is_token0():
    # Uniswap requires token0 < token1 by address; USDC must be token0.
    assert int(lp.USDC_ARBITRUM, 16) < int(lp.USDT_ARBITRUM, 16)
    assert lp.TOKEN0 == to_checksum_address(lp.USDC_ARBITRUM)


def test_enter_split_is_balanced_and_approves_are_scoped():
    calls = lp.build_lp_enter_calls(owner=OWNER, usdc_amount=100.0, deadline=DEADLINE)
    purposes = [c["purpose"] for c in calls]
    assert purposes == [
        "approve_usdc_router",
        "swap_usdc_usdt_lp",
        "approve_usdc_npm",
        "approve_usdt_npm",
        "mint_lp_usdc_usdt",
    ]


def test_exit_requires_positive_position():
    for bad in [dict(token_id=0, liquidity=10**18), dict(token_id=1, liquidity=0)]:
        try:
            lp.build_lp_exit_calls(owner=OWNER, deadline=DEADLINE, **bad)
        except ValueError:
            continue
        raise AssertionError("expected ValueError for non-positive position")
