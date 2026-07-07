"""Test fixtures."""

import os

# Set env before any settings cache
os.environ["ENVIRONMENT"] = "testing"
os.environ["VENICE_API_KEY"] = "test-venice-key"
os.environ["MAGIC_SECRET_KEY"] = "test-magic-secret"

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from config import get_settings
from database import Base, get_db
from main import app

get_settings.cache_clear()

AUTH_HEADERS = {"Authorization": "Bearer test-did-token"}

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(autouse=True)
async def setup_db():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session
            await session.commit()

    app.dependency_overrides[get_db] = override_get_db

    yield

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def db_session(setup_db):
    override = app.dependency_overrides[get_db]

    gen = override()
    session = await gen.__anext__()
    try:
        yield session
    finally:
        await gen.aclose()
