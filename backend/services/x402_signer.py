"""x402 v2 payment signing via official SDK."""

from __future__ import annotations

import logging
from typing import Any

from eth_account import Account
from x402 import x402Client
from x402.http import x402HTTPClient
from x402.http.clients import x402HttpxClient
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client

from config import get_settings

logger = logging.getLogger(__name__)

# PayAI echo merchant — refunds test payments; proves real on-chain settlement
X402_ECHO_ARBITRUM_SEPOLIA = "https://x402.payai.network/api/arbitrum-sepolia/paid-content"


def agent_account() -> Account:
    settings = get_settings()
    key = settings.agent_wallet_private_key.strip()
    if not key:
        raise RuntimeError("AGENT_WALLET_PRIVATE_KEY is required")
    return Account.from_key(key)


def build_x402_client() -> x402Client:
    client = x402Client()
    register_exact_evm_client(client, EthAccountSigner(agent_account()))
    return client


async def pay_url(
    url: str,
    *,
    method: str = "GET",
    json_body: dict[str, Any] | None = None,
    timeout: float = 90,
) -> dict[str, Any]:
    """Execute full x402 flow (402 → sign → retry) and return settlement details."""
    client = build_x402_client()
    http_helper = x402HTTPClient(client)

    async with x402HttpxClient(client) as http:
        if method.upper() == "GET":
            response = await http.get(url, timeout=timeout)
        elif method.upper() == "POST":
            response = await http.post(url, json=json_body or {}, timeout=timeout)
        else:
            raise ValueError(f"Unsupported x402 method: {method}")

        await response.aread()
        body_text = response.text

        if not response.is_success:
            raise RuntimeError(
                f"x402 payment failed ({response.status_code}): {body_text[:500]}"
            )

        settlement = None
        try:
            settlement = http_helper.get_payment_settle_response(
                lambda name: response.headers.get(name)
            )
        except ValueError:
            logger.warning("x402 succeeded but PAYMENT-RESPONSE header missing for %s", url)

        return {
            "status_code": response.status_code,
            "body": body_text,
            "settlement": settlement.model_dump() if settlement else None,
            "payer": agent_account().address,
        }
