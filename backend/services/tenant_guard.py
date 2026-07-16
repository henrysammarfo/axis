"""Per-user tenant isolation helpers."""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import HTTPException
from web3 import Web3

if TYPE_CHECKING:
    from models import User
    from services.portfolio_tracker import PortfolioTracker


def normalize_address(address: str | None) -> str | None:
    if not address:
        return None
    cleaned = address.strip()
    if not cleaned:
        return None
    try:
        return Web3.to_checksum_address(cleaned)
    except (ValueError, TypeError):
        return cleaned.lower()


def assert_same_user(auth_user_id: str, resource_user_id: str) -> None:
    if auth_user_id != resource_user_id:
        raise HTTPException(status_code=403, detail="Forbidden")


def assert_wallet_belongs_to_user(
    user: User | None,
    ua_address: str,
    sra_address: str | None = None,
    *,
    allow_first_bind: bool = False,
) -> None:
    normalized_ua = normalize_address(ua_address)
    if not normalized_ua:
        raise HTTPException(status_code=400, detail="Invalid ua_address")

    if user is None:
        if allow_first_bind:
            return
        raise HTTPException(status_code=404, detail="User not registered")

    stored_ua = normalize_address(user.ua_address)
    if stored_ua and stored_ua != normalized_ua:
        raise HTTPException(
            status_code=403,
            detail="ua_address does not belong to this user",
        )

    if sra_address is not None:
        normalized_sra = normalize_address(sra_address)
        stored_sra = normalize_address(user.sra_address)
        if stored_sra and normalized_sra and stored_sra != normalized_sra:
            raise HTTPException(
                status_code=403,
                detail="sra_address does not belong to this user",
            )


async def assert_address_not_claimed(
    tracker: PortfolioTracker,
    ua_address: str | None,
    user_id: str,
) -> None:
    if not ua_address:
        return

    owner = await tracker.get_user_by_ua_address(ua_address)
    if owner and owner.id != user_id:
        raise HTTPException(
            status_code=409,
            detail="Wallet address already registered to another user",
        )
