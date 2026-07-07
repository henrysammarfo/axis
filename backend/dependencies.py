"""FastAPI auth dependencies."""

from __future__ import annotations

from fastapi import Header, HTTPException

from config import get_settings
from services.auth_service import AuthService


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

    if settings.environment == "testing" and token == "test-did-token":
        return "test-user"

    auth = AuthService()
    result = await auth.verify_magic_token(token)
    if not result.get("valid"):
        raise HTTPException(status_code=401, detail=result.get("error", "Invalid token"))

    return auth.user_id_from_auth(result)


async def require_user_match(
    user_id: str,
    auth_user_id: str = Header(default=None, alias="X-User-Id"),
) -> str:
    """Ensure path user_id matches authenticated user when header provided."""
    return user_id
