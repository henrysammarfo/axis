"""FastAPI auth dependencies."""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException

from config import get_settings
from services.auth_service import AuthService
from services.tenant_guard import assert_same_user


async def require_auth(
    authorization: str | None = Header(default=None),
    x_did_token: str | None = Header(default=None),
) -> str:
    settings = get_settings()

    token: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    elif x_did_token:
        token = x_did_token.strip()

    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    if settings.environment == "testing":
        auth = AuthService()
        result = await auth.verify_magic_token(token)
        if result.get("valid"):
            return auth.user_id_from_auth(result)

    auth = AuthService()
    result = await auth.verify_magic_token(token)
    if not result.get("valid"):
        raise HTTPException(status_code=401, detail=result.get("error", "Invalid token"))

    return auth.user_id_from_auth(result)


async def require_own_user(
    user_id: str,
    auth_user_id: str = Depends(require_auth),
) -> str:
    """Path param user_id must match authenticated Magic issuer."""
    assert_same_user(auth_user_id, user_id)
    return user_id
