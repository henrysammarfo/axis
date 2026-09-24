"""Robinhood Chain testnet hold path — real balances + txs, fail-closed.

FOLIO-grade honesty for AXIS Open House:
- Never invent fills or explorer links
- Plan ≠ held until balances or broadcast txs exist
- Faucet claims are browser-only; AXIS records + can fund dust from AGENT_WALLET
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any, Literal

from eth_account import Account
from web3 import Web3

from config import get_settings
from rh_chain import (
    RH_TESTNET_STOCK_TOKENS,
    ROBINHOOD_TESTNET_CHAIN_ID,
    rh_explorer,
    rh_rpc,
)
from services.rh_hold_logic import FAUCET_URL, evaluate_coverage

logger = logging.getLogger(__name__)

HOLD_DUST = 0.01
HoldMode = Literal["auto", "fund", "sync"]

ERC20_ABI = [
    {
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


def _rpc_url() -> str:
    settings = get_settings()
    return (getattr(settings, "robinhood_rpc", None) or "").strip() or rh_rpc(
        ROBINHOOD_TESTNET_CHAIN_ID
    )


class RhHoldService:
    def __init__(self, *, require_signer: bool = False) -> None:
        self.settings = get_settings()
        self.chain_id = ROBINHOOD_TESTNET_CHAIN_ID
        self.w3 = Web3(Web3.HTTPProvider(_rpc_url(), request_kwargs={"timeout": 45}))
        self.explorer = rh_explorer(self.chain_id)
        key = self.settings.agent_wallet_private_key.strip()
        self.account = Account.from_key(key) if key else None
        if require_signer and not self.account:
            raise RuntimeError("AGENT_WALLET_PRIVATE_KEY required for RH hold funding")

    @property
    def agent_address(self) -> str | None:
        return self.account.address if self.account else None

    def _contract(self, address: str):
        return self.w3.eth.contract(address=Web3.to_checksum_address(address), abi=ERC20_ABI)

    def _decimals(self, token: Any) -> int:
        try:
            return int(token.functions.decimals().call())
        except Exception:
            return 18

    def faucet_hint(self) -> dict[str, Any]:
        return {
            "faucet_url": FAUCET_URL,
            "agent_address": self.agent_address,
            "chain_id": self.chain_id,
            "network": "robinhood-testnet",
            "testnet": True,
            "tokens": list(RH_TESTNET_STOCK_TOKENS.keys()),
            "honesty": (
                "Faucet is browser-only. Claim ETH + stock tokens for the agent (gasless dust) "
                "and/or your UA address (self sync). Never treated as mainnet fills."
            ),
        }

    def read_holdings(self, address: str) -> dict[str, Any]:
        owner = Web3.to_checksum_address(address)
        eth_wei = int(self.w3.eth.get_balance(owner))
        tokens: list[dict[str, Any]] = []
        for symbol, meta in RH_TESTNET_STOCK_TOKENS.items():
            token = self._contract(meta["address"])
            raw = int(token.functions.balanceOf(owner).call())
            decimals = self._decimals(token)
            human = raw / (10**decimals) if decimals >= 0 else 0.0
            tokens.append(
                {
                    "symbol": symbol,
                    "name": meta["name"],
                    "address": meta["address"],
                    "raw": str(raw),
                    "balance": round(human, 6),
                    "decimals": decimals,
                    "explorer_url": f"{self.explorer}/token/{meta['address']}?a={owner}",
                }
            )
        return {
            "address": owner,
            "chain_id": self.chain_id,
            "network": "robinhood-testnet",
            "testnet": True,
            "explorer": self.explorer,
            "faucet_url": FAUCET_URL,
            "eth_balance": round(eth_wei / 1e18, 6),
            "tokens": tokens,
            "agent_address": self.agent_address,
            "honesty": "Balances read live from Robinhood Chain public testnet. Faucet is manual.",
        }

    def readiness(
        self,
        user_address: str | None,
        wanted_symbols: list[str] | None = None,
    ) -> dict[str, Any]:
        wanted = [s.upper() for s in (wanted_symbols or list(RH_TESTNET_STOCK_TOKENS.keys()))]
        agent_holdings = None
        agent_coverage = None
        agent_eth = 0.0
        if self.agent_address:
            agent_holdings = self.read_holdings(self.agent_address)
            agent_eth = float(agent_holdings["eth_balance"])
            agent_balances = {t["symbol"]: t["balance"] for t in agent_holdings["tokens"]}
            agent_coverage = evaluate_coverage(wanted, agent_balances, min_balance=HOLD_DUST)

        user_holdings = None
        user_coverage = None
        if user_address:
            user_holdings = self.read_holdings(user_address)
            user_balances = {t["symbol"]: t["balance"] for t in user_holdings["tokens"]}
            user_coverage = evaluate_coverage(wanted, user_balances)

        can_fund = bool(
            self.account
            and agent_eth >= 0.001
            and agent_coverage
            and agent_coverage["present"]
        )
        can_sync = bool(user_coverage and user_coverage["present"])

        if can_fund or can_sync:
            next_step = "activate_hold"
        elif self.agent_address:
            next_step = "faucet_agent_or_user"
        else:
            next_step = "configure_agent_wallet"

        return {
            "chain_id": self.chain_id,
            "network": "robinhood-testnet",
            "testnet": True,
            "faucet_url": FAUCET_URL,
            "wanted": wanted,
            "agent": {
                "address": self.agent_address,
                "eth_balance": agent_eth,
                "coverage": agent_coverage,
                "can_fund_dust": can_fund,
                "holdings": agent_holdings,
            },
            "user": {
                "address": user_address,
                "coverage": user_coverage,
                "can_sync": can_sync,
                "holdings": user_holdings,
            },
            "can_fund": can_fund,
            "can_sync": can_sync,
            "next_step": next_step,
            "honesty": (
                "Fail-closed: Activate hold only succeeds with live balances or real txs. "
                "Plans alone are not holdings."
            ),
        }

    def sync_from_balances(
        self,
        user_address: str,
        symbols: list[str],
    ) -> dict[str, Any]:
        holdings = self.read_holdings(user_address)
        balances = {t["symbol"]: t["balance"] for t in holdings["tokens"]}
        coverage = evaluate_coverage(symbols, balances)
        if coverage["status"] in ("awaiting_faucet", "empty_plan"):
            return {
                "status": coverage["status"],
                "mode": "sync",
                "testnet": True,
                "chain_id": self.chain_id,
                "network": "robinhood-testnet",
                "faucet_url": FAUCET_URL,
                "agent_address": self.agent_address,
                "recipient": holdings["address"],
                "txs": [],
                "skipped": [
                    {"symbol": s, "reason": "no on-chain balance — claim faucet for your UA"}
                    for s in coverage["missing"] or coverage["wanted"]
                ],
                "coverage": coverage,
                "holdings_snapshot": holdings,
                "recorded_at": datetime.now(timezone.utc).isoformat(),
                "honesty": "Fail-closed sync: refused to mark held without live token balances.",
            }

        legs = []
        for t in holdings["tokens"]:
            if t["symbol"] in coverage["present"]:
                legs.append(
                    {
                        "symbol": t["symbol"],
                        "balance": t["balance"],
                        "token": t["address"],
                        "explorer_url": t["explorer_url"],
                        "source": "user_balance",
                    }
                )

        return {
            "status": coverage["status"],
            "mode": "sync",
            "testnet": True,
            "chain_id": self.chain_id,
            "network": "robinhood-testnet",
            "faucet_url": FAUCET_URL,
            "agent_address": self.agent_address,
            "recipient": holdings["address"],
            "txs": [],
            "legs": legs,
            "skipped": [
                {"symbol": s, "reason": "no on-chain balance yet"} for s in coverage["missing"]
            ],
            "coverage": coverage,
            "holdings_snapshot": holdings,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "honesty": (
                "Synced from live RH testnet balances on the user UA — not mainnet fills, "
                "not invented txs."
            ),
        }

    def _gas_fees(self) -> dict[str, int]:
        block = self.w3.eth.get_block("latest")
        base_fee = int(block.get("baseFeePerGas") or self.w3.eth.gas_price or 0)
        priority = int(self.w3.to_wei(0.01, "gwei"))
        max_fee = max(base_fee * 2 + priority, priority + 1)
        return {"maxFeePerGas": max_fee, "maxPriorityFeePerGas": priority}

    def _transfer_token(self, token_address: str, to: str, amount_raw: int) -> dict[str, Any]:
        if not self.account:
            raise RuntimeError("AGENT_WALLET_PRIVATE_KEY required")
        token = self._contract(token_address)
        to_cs = Web3.to_checksum_address(to)
        nonce = self.w3.eth.get_transaction_count(self.account.address)
        fees = self._gas_fees()
        tx = token.functions.transfer(to_cs, amount_raw).build_transaction(
            {
                "from": self.account.address,
                "nonce": nonce,
                "chainId": self.chain_id,
                "type": 2,
                **fees,
            }
        )
        if "gas" not in tx:
            tx["gas"] = int(self.w3.eth.estimate_gas(tx))
        signed = self.account.sign_transaction(tx)
        raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
        tx_hash = self.w3.eth.send_raw_transaction(raw)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
        hx = Web3.to_hex(tx_hash)
        return {
            "success": receipt.status == 1,
            "tx_hash": hx,
            "block": receipt.blockNumber,
            "explorer_url": f"{self.explorer}/tx/{hx}",
        }

    def fund_hold_from_agent(
        self,
        recipient: str,
        symbols: list[str],
        *,
        dust: float = HOLD_DUST,
    ) -> dict[str, Any]:
        if not self.account:
            raise RuntimeError("AGENT_WALLET_PRIVATE_KEY required for RH hold funding")

        eth_bal = self.w3.eth.get_balance(self.account.address)
        if eth_bal < self.w3.to_wei(0.001, "ether"):
            raise RuntimeError(
                f"AGENT_WALLET needs RH testnet ETH for gas. Claim at {FAUCET_URL} "
                f"for {self.account.address}"
            )

        to = Web3.to_checksum_address(recipient)
        txs: list[dict[str, Any]] = []
        skipped: list[dict[str, str]] = []

        for symbol in symbols:
            meta = RH_TESTNET_STOCK_TOKENS.get(symbol.upper())
            if not meta:
                skipped.append({"symbol": symbol, "reason": "not in testnet registry"})
                continue
            token = self._contract(meta["address"])
            decimals = self._decimals(token)
            need = int(dust * (10**decimals))
            bal = int(token.functions.balanceOf(self.account.address).call())
            if bal < need:
                skipped.append(
                    {
                        "symbol": symbol.upper(),
                        "reason": (
                            f"agent balance too low — claim {symbol.upper()} at faucet "
                            f"for {self.account.address}"
                        ),
                    }
                )
                continue
            try:
                result = self._transfer_token(meta["address"], to, need)
                if not result.get("success"):
                    skipped.append(
                        {
                            "symbol": symbol.upper(),
                            "reason": f"tx reverted: {result.get('tx_hash')}",
                        }
                    )
                    continue
                txs.append(
                    {
                        "symbol": symbol.upper(),
                        "amount": dust,
                        "to": to,
                        "token": meta["address"],
                        **result,
                    }
                )
                time.sleep(0.4)
            except Exception as exc:
                logger.exception("RH hold transfer failed for %s", symbol)
                skipped.append({"symbol": symbol.upper(), "reason": str(exc)[:180]})

        holdings = self.read_holdings(to)
        balances = {t["symbol"]: t["balance"] for t in holdings["tokens"]}
        coverage = evaluate_coverage(symbols, balances)

        if txs and not skipped:
            status = "held"
        elif txs:
            status = "partial"
        else:
            status = "awaiting_faucet"

        return {
            "status": status,
            "mode": "fund",
            "testnet": True,
            "chain_id": self.chain_id,
            "network": "robinhood-testnet",
            "faucet_url": FAUCET_URL,
            "agent_address": self.agent_address,
            "recipient": to,
            "txs": txs,
            "skipped": skipped,
            "coverage": coverage,
            "holdings_snapshot": holdings,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "honesty": "AXIS-funded dust holds on Robinhood Chain public testnet — not mainnet fills.",
        }

    def activate(
        self,
        user_address: str,
        symbols: list[str],
        *,
        mode: HoldMode = "auto",
        dust: float = HOLD_DUST,
    ) -> dict[str, Any]:
        """Fail-closed activate: fund, sync, or auto-pick. Never invent fills."""
        symbols = [s.upper() for s in symbols]
        if not symbols:
            return {
                "status": "empty_plan",
                "mode": mode,
                "testnet": True,
                "chain_id": self.chain_id,
                "txs": [],
                "skipped": [],
                "honesty": "Save a basket before activating a hold.",
                "recorded_at": datetime.now(timezone.utc).isoformat(),
            }

        ready = self.readiness(user_address, symbols)

        if mode == "sync":
            return self.sync_from_balances(user_address, symbols)

        if mode == "fund":
            return self.fund_hold_from_agent(user_address, symbols, dust=dust)

        # auto: prefer gasless agent fund when ready, else sync user balances, else fail-closed
        if ready["can_fund"]:
            funded = self.fund_hold_from_agent(user_address, symbols, dust=dust)
            if funded.get("txs"):
                return funded
            # fall through to sync if fund produced nothing useful
        if ready["can_sync"]:
            return self.sync_from_balances(user_address, symbols)

        return {
            "status": "awaiting_faucet",
            "mode": "auto",
            "testnet": True,
            "chain_id": self.chain_id,
            "network": "robinhood-testnet",
            "faucet_url": FAUCET_URL,
            "agent_address": self.agent_address,
            "recipient": Web3.to_checksum_address(user_address),
            "txs": [],
            "skipped": [
                {
                    "symbol": s,
                    "reason": (
                        f"no agent dust and no user balance — claim at {FAUCET_URL} "
                        f"for agent {self.agent_address or '(unset)'} and/or your UA"
                    ),
                }
                for s in symbols
            ],
            "coverage": ready.get("user", {}).get("coverage"),
            "readiness": ready,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "honesty": (
                "Fail-closed: no live balances and no fundable agent inventory — "
                "refused to mark held."
            ),
        }
