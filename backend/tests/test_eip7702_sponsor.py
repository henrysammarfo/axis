"""Unit tests for EIP-7702 authorization reconstruction."""

from eth_account import Account
from eth_utils import to_checksum_address

from services.eip7702_sponsor import build_signed_authorization


def test_build_signed_authorization_recovers_authority():
    authority = Account.create()
    contract = "0x5ce9454909639D2D17A3F753ce7d93fa0b9aB12E"
    signed = Account.sign_authorization(
        {"chainId": 42161, "address": contract, "nonce": 0},
        authority.key,
    )
    payload = {
        "chainId": signed.chain_id,
        "address": to_checksum_address(signed.address),
        "nonce": signed.nonce,
        "yParity": signed.y_parity,
        "r": hex(signed.r),
        "s": hex(signed.s),
    }
    rebuilt = build_signed_authorization(payload)
    assert to_checksum_address(rebuilt.authority) == authority.address


def test_build_signed_authorization_accepts_legacy_v():
    authority = Account.create()
    contract = "0x5ce9454909639D2D17A3F753ce7d93fa0b9aB12E"
    signed = Account.sign_authorization(
        {"chainId": 42161, "address": contract, "nonce": 1},
        authority.key,
    )
    payload = {
        "chainId": 42161,
        "address": contract,
        "nonce": 1,
        "v": signed.y_parity + 27,
        "r": signed.r,
        "s": signed.s,
    }
    rebuilt = build_signed_authorization(payload)
    assert to_checksum_address(rebuilt.authority) == authority.address
