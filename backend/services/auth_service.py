"""Magic Labs DID token verification."""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

from config import get_settings

logger = logging.getLogger(__name__)


@lru_cache
def _magic_admin_client():
    from magic_admin import Magic

    settings = get_settings()
    return Magic(api_secret_key=settings.magic_secret_key)


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

        return self._verify_with_magic_admin(did_token)

    def _verify_with_magic_admin(self, did_token: str) -> dict[str, Any]:
        from magic_admin.error import (
            APIConnectionError,
            APIError,
            DIDTokenExpired,
            DIDTokenInvalid,
            DIDTokenMalformed,
            ExpectedBearerStringError,
        )

        try:
            magic = _magic_admin_client()
            magic.Token.validate(did_token)
            response = magic.User.get_metadata_by_token(did_token)
            data = response.data if hasattr(response, "data") else response
            return {
                "valid": True,
                "issuer": data.get("issuer"),
                "email": data.get("email"),
                "public_address": data.get("public_address"),
            }
        except (DIDTokenExpired, DIDTokenInvalid, DIDTokenMalformed, ExpectedBearerStringError) as exc:
            logger.info("Magic token rejected: %s", exc)
            return {"valid": False, "error": "Invalid or expired sign-in. Please sign in again."}
        except APIConnectionError as exc:
            logger.error("Magic API connection failed: %s", exc)
            return {
                "valid": False,
                "error": "Magic sign-in service unavailable. Try again in a moment.",
            }
        except APIError as exc:
            status = getattr(exc, "status_code", None)
            logger.error("Magic API error (%s): %s", status, exc)
            if status in {401, 403}:
                return {
                    "valid": False,
                    "error": "MAGIC_SECRET_KEY does not match your Magic app. Check backend .env.",
                }
            return {"valid": False, "error": f"Magic API returned {status or 'error'}"}
        except Exception as exc:
            logger.error("Magic verification failed: %s", exc)
            return {"valid": False, "error": str(exc)}

    def user_id_from_auth(self, auth: dict[str, Any]) -> str:
        if auth.get("issuer"):
            return str(auth["issuer"])
        if auth.get("public_address"):
            return str(auth["public_address"]).lower()
        return "anonymous"
