"""On-chain execution helpers for agent wallet (Arbitrum Sepolia)."""

from __future__ import annotations

import logging
import time
from typing import Any

from eth_account import Account
from web3 import Web3
from web3.types import TxReceipt

from chain_config import ARBITRUM_SEPOLIA_CHAIN_ID
from config import get_settings

logger = logging.getLogger(__name__)

# Arbitrum Sepolia
USDC_SEPOLIA = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"
AAVE_POOL_SEPOLIA = "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff"

ERC20_ABI = [
    {
        "inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"name": "owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

AAVE_POOL_ABI = [
    {
        "inputs": [
            {"name": "asset", "type": "address"},
            {"name": "amount", "type": "uint256"},
            {"name": "onBehalfOf", "type": "address"},
            {"name": "referralCode", "type": "uint16"},
        ],
        "name": "supply",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    }
]


class OnChainExecutor:
    """Sign and broadcast txs from AGENT_WALLET_PRIVATE_KEY."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.account = Account.from_key(self.settings.agent_wallet_private_key)
        self.w3 = Web3(Web3.HTTPProvider(self.settings.arbitrum_rpc))

    @property
    def address(self) -> str:
        return self.account.address

    def get_eth_balance_wei(self) -> int:
        return int(self.w3.eth.get_balance(self.account.address))

    def get_usdc_balance_raw(self) -> int:
        contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(USDC_SEPOLIA), abi=ERC20_ABI
        )
        return int(contract.functions.balanceOf(self.account.address).call())

    def _gas_fees(self) -> dict[str, int]:
        block = self.w3.eth.get_block("latest")
        base_fee = int(block.get("baseFeePerGas") or self.w3.eth.gas_price)
        priority = int(self.w3.to_wei(0.02, "gwei"))
        max_fee = base_fee * 2 + priority
        return {"maxFeePerGas": max_fee, "maxPriorityFeePerGas": priority}

    def send_eth_self_ping(self, value_wei: int = 0) -> dict[str, Any]:
        """Broadcast a tiny self-transfer to prove signing + RPC."""
        nonce = self.w3.eth.get_transaction_count(self.account.address)
        fees = self._gas_fees()
        tx = {
            "from": self.account.address,
            "to": self.account.address,
            "value": max(0, value_wei),
            "nonce": nonce,
            "chainId": self.settings.arbitrum_chain_id,
            "type": 2,
            **fees,
        }
        tx["gas"] = int(self.w3.eth.estimate_gas(tx))
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        return {
            "success": receipt.status == 1,
            "tx_hash": Web3.to_hex(tx_hash),
            "block": receipt.blockNumber,
            "chain_id": self.settings.arbitrum_chain_id,
        }

    def supply_aave_usdc(self, amount_usdc: float) -> dict[str, Any]:
        """Approve + supply USDC to Aave v3 on Arbitrum Sepolia."""
        if self.settings.arbitrum_chain_id != ARBITRUM_SEPOLIA_CHAIN_ID:
            raise RuntimeError("Aave Sepolia supply only implemented for chain 421614")

        amount_raw = int(amount_usdc * 1_000_000)
        if amount_raw <= 0:
            raise ValueError("amount_usdc must be positive")

        usdc = self.w3.eth.contract(
            address=Web3.to_checksum_address(USDC_SEPOLIA), abi=ERC20_ABI
        )
        pool = self.w3.eth.contract(
            address=Web3.to_checksum_address(AAVE_POOL_SEPOLIA), abi=AAVE_POOL_ABI
        )
        pool_addr = Web3.to_checksum_address(AAVE_POOL_SEPOLIA)
        usdc_addr = Web3.to_checksum_address(USDC_SEPOLIA)

        nonce = self.w3.eth.get_transaction_count(self.account.address)
        chain_id = self.settings.arbitrum_chain_id
        fees = self._gas_fees()

        approve_tx = usdc.functions.approve(pool_addr, amount_raw).build_transaction(
            {
                "from": self.account.address,
                "nonce": nonce,
                "chainId": chain_id,
                "gas": 120_000,
                "type": 2,
                **fees,
            }
        )
        approve_hash = self._send(approve_tx)
        nonce += 1

        supply_tx = pool.functions.supply(
            usdc_addr, amount_raw, self.account.address, 0
        ).build_transaction(
            {
                "from": self.account.address,
                "nonce": nonce,
                "chainId": chain_id,
                "gas": 400_000,
                "type": 2,
                **fees,
            }
        )
        supply_hash = self._send(supply_tx)

        return {
            "success": True,
            "protocol": "aave_v3",
            "asset": "USDC",
            "amount_usdc": amount_usdc,
            "action": "supply",
            "approve_tx_hash": approve_hash,
            "tx_hash": supply_hash,
            "chain": "arbitrum-sepolia",
            "executed_via": "agent_wallet_direct",
            "timestamp": int(time.time()),
        }

    def _send(self, tx: dict[str, Any]) -> str:
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt: TxReceipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt.status != 1:
            raise RuntimeError(f"Transaction reverted: {Web3.to_hex(tx_hash)}")
        return Web3.to_hex(tx_hash)
