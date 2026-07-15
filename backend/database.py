"""SQLAlchemy async database session management."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import get_settings


def _async_url(url: str) -> str:
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("sqlite://"):
        return url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    return url


settings = get_settings()
engine = create_async_engine(_async_url(settings.database_url), echo=settings.environment == "development")
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
    from models import ActionLog, Position, User, X402Spend  # noqa: F401
    from sqlalchemy import inspect, text

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        def _migrate_user_columns(sync_conn) -> None:
            inspector = inspect(sync_conn)
            if "users" not in inspector.get_table_names():
                return
            existing = {col["name"] for col in inspector.get_columns("users")}
            if "eip7702_tx_hash" not in existing:
                sync_conn.execute(text("ALTER TABLE users ADD COLUMN eip7702_tx_hash VARCHAR(66)"))
            if "eip7702_delegated" not in existing:
                sync_conn.execute(
                    text("ALTER TABLE users ADD COLUMN eip7702_delegated BOOLEAN DEFAULT 0")
                )

        await conn.run_sync(_migrate_user_columns)
