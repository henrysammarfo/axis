"""SQLAlchemy async database session management."""

import ssl
from collections.abc import AsyncGenerator
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import get_settings

# libpq params that psycopg2 understands but asyncpg does not accept as query args.
_ASYNCPG_INCOMPATIBLE_PARAMS = {"sslmode", "channel_binding", "gssencmode", "target_session_attrs"}


def _async_url(url: str) -> str:
    """Normalize a DB URL to its async driver, stripping asyncpg-incompatible params.

    Managed Postgres URLs (Neon, Supabase, Vercel) ship `?sslmode=require&channel_binding=...`,
    which crash asyncpg. We strip them here and enable TLS via connect_args instead.
    """
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("sqlite://"):
        return url.replace("sqlite://", "sqlite+aiosqlite://", 1)

    if url.startswith("postgresql+asyncpg://"):
        parts = urlsplit(url)
        kept = [(k, v) for k, v in parse_qsl(parts.query) if k.lower() not in _ASYNCPG_INCOMPATIBLE_PARAMS]
        # Disable SQLAlchemy's prepared-statement cache so the Supabase/pgBouncer
        # transaction pooler (port 6543) works — it can't reuse prepared statements.
        if not any(k.lower() == "prepared_statement_cache_size" for k, _ in kept):
            kept.append(("prepared_statement_cache_size", "0"))
        url = urlunsplit(parts._replace(query=urlencode(kept)))
    return url


def _connect_args(url: str) -> dict[str, Any]:
    # Managed Postgres (Supabase pooler) requires TLS. We encrypt but skip strict
    # cert verification — equivalent to libpq `sslmode=require` — which is what the
    # Supabase transaction pooler expects and avoids CA-bundle drift across
    # environments (Vercel's runtime vs. Supavisor's cert chain).
    # statement_cache_size=0 keeps transaction-mode pooling (pgBouncer) compatible.
    if url.startswith(("postgresql://", "postgres://", "postgresql+asyncpg://")):
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        return {"ssl": ssl_ctx, "statement_cache_size": 0}
    return {}


settings = get_settings()
engine = create_async_engine(
    _async_url(settings.database_url),
    echo=settings.environment == "development",
    connect_args=_connect_args(settings.database_url),
    pool_pre_ping=True,
)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    from models import ActionLog, Position, User, WaitlistSignup, X402Spend  # noqa: F401
    from sqlalchemy import inspect, text

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        def _migrate_user_columns(sync_conn) -> None:
            inspector = inspect(sync_conn)
            if "users" not in inspector.get_table_names():
                return
            # Dialect-safe boolean default (Postgres rejects `DEFAULT 0` on BOOLEAN).
            false_default = "false" if sync_conn.dialect.name == "postgresql" else "0"
            existing = {col["name"] for col in inspector.get_columns("users")}
            if "eip7702_tx_hash" not in existing:
                sync_conn.execute(text("ALTER TABLE users ADD COLUMN eip7702_tx_hash VARCHAR(66)"))
            if "eip7702_delegated" not in existing:
                sync_conn.execute(
                    text(f"ALTER TABLE users ADD COLUMN eip7702_delegated BOOLEAN DEFAULT {false_default}")
                )
            if "session_key_approval" not in existing:
                sync_conn.execute(text("ALTER TABLE users ADD COLUMN session_key_approval TEXT"))
            if "session_key_signer" not in existing:
                sync_conn.execute(
                    text("ALTER TABLE users ADD COLUMN session_key_signer VARCHAR(42)")
                )
            if "session_active" not in existing:
                sync_conn.execute(
                    text(f"ALTER TABLE users ADD COLUMN session_active BOOLEAN DEFAULT {false_default}")
                )
            if "custom_strategy" not in existing:
                sync_conn.execute(text("ALTER TABLE users ADD COLUMN custom_strategy JSON"))
            if "market_risk_consent" not in existing:
                sync_conn.execute(
                    text(f"ALTER TABLE users ADD COLUMN market_risk_consent BOOLEAN DEFAULT {false_default}")
                )
            if "display_name" not in existing:
                sync_conn.execute(text("ALTER TABLE users ADD COLUMN display_name VARCHAR(64)"))
            if "avatar" not in existing:
                sync_conn.execute(text("ALTER TABLE users ADD COLUMN avatar TEXT"))
            if "stock_basket" not in existing:
                sync_conn.execute(text("ALTER TABLE users ADD COLUMN stock_basket JSON"))
            if "rh_holds" not in existing:
                sync_conn.execute(text("ALTER TABLE users ADD COLUMN rh_holds JSON"))
            if "retention_policy" not in existing:
                sync_conn.execute(text("ALTER TABLE users ADD COLUMN retention_policy JSON"))

        await conn.run_sync(_migrate_user_columns)
