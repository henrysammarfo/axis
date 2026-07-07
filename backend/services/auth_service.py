"""Magic Labs DID token verification."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from config import get_settings

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def verify_magic_token(self, did_token: str) -> dict[str, Any]:
        if self.settings.environment == "testing":
            test_users = {
                "test-did-token": {
                    "issuer": "test-user",
                    "email": "test@axis.app",
                    "public_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
                },
                "test-did-token-user-b": {
                    "issuer": "test-user-b",
                    "email": "userb@axis.app",
                    "public_address": "0x1111111111111111111111111111111111111111",
                },
            }
            profile = test_users.get(did_token)
            if profile:
                return {"valid": True, **profile}

        if not self.settings.magic_secret_key:
            raise ValueError("MAGIC_SECRET_KEY required for authentication")

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
