"""Sponsor EIP-7702 Type-4 delegations from AGENT_WALLET (user pays zero gas)."""

from __future__ import annotations

import logging
from typing import Any

from eth_account import Account
from eth_account.datastructures import SignedSetCodeAuthorization
from eth_account.typed_transactions.set_code_transaction import Authorization
from eth_keys import keys
from eth_utils import to_canonical_address, to_checksum_address
from web3 import Web3

from chain_config import ARBITRUM_ONE_CHAIN_ID
from config import get_settings

logger = logging.getLogger(__name__)

# Enough for one Type-4 + buffer on Arbitrum One (~$0.05–0.20 typical).
MIN_SPONSOR_BALANCE_WEI = Web3.to_wei(0.00015, "ether")
TYPE4_GAS_LIMIT = 150_000


def _as_int(value: Any) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        return int(value, 16) if value.startswith(("0x", "0X")) else int(value)
    raise TypeError(f"Cannot parse int from {type(value)}")


def _y_parity(value: Any) -> int:
    """Normalize Magic/viem yParity or legacy v into 0|1."""
    raw = _as_int(value)
    if raw in (0, 1):
        return raw
    if raw in (27, 28):
        return raw - 27
    raise ValueError(f"Invalid yParity/v: {value}")


def build_signed_authorization(payload: dict[str, Any]) -> SignedSetCodeAuthorization:
    """Rebuild eth_account auth object from Magic sign7702Authorization fields."""
    chain_id = _as_int(payload.get("chainId") or payload.get("chain_id"))
    address = payload.get("address") or payload.get("contractAddress")
    nonce = _as_int(payload.get("nonce"))
    y_parity = _y_parity(payload.get("yParity", payload.get("y_parity", payload.get("v"))))
    r = _as_int(payload.get("r"))
    s = _as_int(payload.get("s"))
    if not address:
        raise ValueError("authorization.address is required")

    canon = to_canonical_address(address)
    unsigned = Authorization(chain_id, canon, nonce)
    ahash = unsigned.hash()
    signature = keys.Signature(vrs=(y_parity, r, s))
    return SignedSetCodeAuthorization(
        chainId=chain_id,
        address=canon,
        nonce=nonce,
        yParity=y_parity,
        r=r,
        s=s,
        signature=signature,
        authorizationHash=ahash,
    )


class Eip7702Sponsor:
    """Broadcast Type-4 txs so Magic EOAs can delegate without holding ETH."""

    def __init__(self) -> None:
        self.settings = get_settings()
        if not self.settings.agent_wallet_private_key.strip():
            raise RuntimeError("AGENT_WALLET_PRIVATE_KEY is required to sponsor EIP-7702")
        self.account = Account.from_key(self.settings.agent_wallet_private_key)
        self.w3 = Web3(Web3.HTTPProvider(self.settings.arbitrum_rpc))

    @property
    def address(self) -> str:
        return self.account.address

    def get_eth_balance_wei(self) -> int:
        return int(self.w3.eth.get_balance(self.account.address))

    def _gas_fees(self) -> dict[str, int]:
        block = self.w3.eth.get_block("latest")
        base_fee = int(block.get("baseFeePerGas") or self.w3.eth.gas_price)
        priority = int(self.w3.to_wei(0.02, "gwei"))
        return {
            "maxFeePerGas": base_fee * 2 + priority,
            "maxPriorityFeePerGas": priority,
        }

    def sponsor_delegation(
        self,
        *,
        authority: str,
        authorization: dict[str, Any],
    ) -> dict[str, Any]:
        if self.settings.arbitrum_chain_id != ARBITRUM_ONE_CHAIN_ID:
            raise RuntimeError(
                f"EIP-7702 sponsorship requires Arbitrum One (42161), got {self.settings.arbitrum_chain_id}"
            )

        authority_cs = to_checksum_address(authority)
        signed_auth = build_signed_authorization(authorization)
        recovered = to_checksum_address(signed_auth.authority)
        if recovered.lower() != authority_cs.lower():
            raise ValueError(
                "Authorization signature does not match Magic wallet address. Sign in again."
            )

        chain_id = int(signed_auth.chain_id)
        if chain_id not in (0, ARBITRUM_ONE_CHAIN_ID):
            raise ValueError(f"Authorization chainId must be 42161 (or 0). Got {chain_id}")

        balance = self.get_eth_balance_wei()
        if balance < MIN_SPONSOR_BALANCE_WEI:
            logger.error(
                "Sponsor wallet %s underfunded: %s wei",
                self.address,
                balance,
            )
            raise RuntimeError(
                "AXIS sponsor wallet needs a refill of ETH on Arbitrum One. "
                "Onboarding is gasless for users — ops must top up AGENT_WALLET."
            )

        fees = self._gas_fees()
        nonce = self.w3.eth.get_transaction_count(self.account.address)
        tx: dict[str, Any] = {
            "chainId": ARBITRUM_ONE_CHAIN_ID,
            "nonce": nonce,
            "gas": TYPE4_GAS_LIMIT,
            "to": authority_cs,
            "value": 0,
            "data": b"",
            "authorizationList": [signed_auth],
            "type": 4,
            **fees,
        }

        signed_tx = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        tx_hex = Web3.to_hex(tx_hash)
        if receipt.status != 1:
            raise RuntimeError(f"Sponsored EIP-7702 transaction reverted: {tx_hex}")

        logger.info(
            "Sponsored EIP-7702 for %s via %s tx=%s",
            authority_cs,
            self.address,
            tx_hex,
        )
        return {
            "tx_hash": tx_hex,
            "delegated": True,
            "authority": authority_cs,
            "sponsor": self.address,
            "chain_id": ARBITRUM_ONE_CHAIN_ID,
            "block": receipt.blockNumber,
        }
