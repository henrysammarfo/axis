"""Map Vercel rewrite destination paths back to FastAPI routes."""


def unwrap_vercel_path(path: str) -> str:
    """Vercel now delivers the rewrite destination, not the browser path.

    Catch-all `/(.*) → /api/$1` means `/health` arrives as `/api/health` and
    `/api/auth/verify` arrives as `/api/api/auth/verify`.
    """
    if path.startswith("/api/api/"):
        return path[4:]
    if path == "/api" or path == "/api/":
        return "/"
    if path.startswith("/api/"):
        rest = path[4:]
        if rest.startswith("/auth") or rest.startswith("/agent") or rest.startswith("/portfolio"):
            return path
        return rest if rest.startswith("/") else f"/{rest}"
    return path or "/"
