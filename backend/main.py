"""AXIS — AI DeFi Portfolio Agent backend."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from rate_limit import limiter
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from config import get_settings, validate_startup_config
from database import init_db
from routes.agent import router as agent_router
from routes.auth import router as auth_router
from routes.basket import router as basket_router
from routes.health import router as health_router
from routes.portfolio import router as portfolio_router
from vercel_path import unwrap_vercel_path

settings = get_settings()
limiter.default_limits = [f"{settings.rate_limit_per_minute}/minute"]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    validate_startup_config()
    await init_db()
    yield


app = FastAPI(
    title="AXIS API",
    description="AI DeFi Portfolio Agent — Set. Forget. Earn.",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    # Scope previews to AXIS Vercel projects only (e.g. axis-mainnet-<hash>-*.vercel.app);
    # do NOT allow arbitrary *.vercel.app origins.
    allow_origin_regex=r"https://axis[a-z0-9-]*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(agent_router, prefix="/api")
app.include_router(portfolio_router, prefix="/api")
app.include_router(basket_router, prefix="/api")


@app.get("/")
@app.get("/api")
async def root():
    return {"service": "AXIS API", "docs": "/docs", "health": "/health"}


class _VercelPathASGI:
    """Vercel FastAPI entrypoint is `main:app` and now sees rewrite destinations."""

    def __init__(self, inner):
        self.app = inner

    async def __call__(self, scope, receive, send):
        if scope.get("type") in {"http", "websocket"}:
            path = unwrap_vercel_path(scope.get("path") or "/")
            scope = {**scope, "path": path, "raw_path": path.encode("utf-8")}
        await self.app(scope, receive, send)

    def __getattr__(self, name):
        return getattr(self.app, name)


app = _VercelPathASGI(app)
