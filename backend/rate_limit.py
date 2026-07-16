"""Rate limiting keyed by authenticated user when possible."""

from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def user_or_ip_key(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        if token:
            return f"user:{token[:48]}"
    return get_remote_address(request)


limiter = Limiter(key_func=user_or_ip_key, default_limits=[])
