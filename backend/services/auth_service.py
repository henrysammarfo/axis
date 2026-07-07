"""Magic Labs DID token verification."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from jose import JWTError, jwt

from config import get_settings

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def verify_magic_token(self, did_token: str) -> dict[str, Any]:
        if not self.settings.magic_secret_key:
            # Development mode: decode without verification
            try:
                payload = jwt.get_unverified_claims(did_token)
                return {
                    "valid": True,
                    "issuer": payload.get("iss", "dev"),
                    "email": payload.get("email"),
                    "public_address": payload.get("public_address"),
                    "dev_mode": True,
                }
            except JWTError as exc:
                return {"valid": False, "error": str(exc)}

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.post(
                    "https://api.magic.link/v1/admin/auth/user/get_metadata",
                    headers={
                        "X-Magic-Secret-Key": self.settings.magic_secret_key,
                        "Authorization": f"Bearer {did_token}",
                    },
                )
                if r.status_code == 200:
                    data = r.json().get("data", r.json())
                    return {
                        "valid": True,
                        "issuer": data.get("issuer"),
                        "email": data.get("email"),
                        "public_address": data.get("public_address"),
                    }
                return {"valid": False, "error": f"Magic API returned {r.status_code}"}
        except Exception as exc:
            logger.error("Magic verification failed: %s", exc)
            return {"valid": False, "error": str(exc)}

    def user_id_from_auth(self, auth: dict[str, Any]) -> str:
        if auth.get("issuer"):
            return str(auth["issuer"])
        if auth.get("public_address"):
            return str(auth["public_address"]).lower()
        return "anonymous"
