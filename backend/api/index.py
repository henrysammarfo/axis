"""Vercel Python FastAPI entrypoint.

Vercel now routes framework rewrites using the destination path. Unwrap it
so FastAPI sees the routes defined in `main.py`. See `vercel_path.py`.
"""

from main import app as fastapi_app
from vercel_path import unwrap_vercel_path


class _PreserveOriginalPath:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") in {"http", "websocket"}:
            path = unwrap_vercel_path(scope.get("path") or "/")
            scope = {**scope, "path": path, "raw_path": path.encode("utf-8")}
        await self.app(scope, receive, send)


app = _PreserveOriginalPath(fastapi_app)

__all__ = ["app"]
