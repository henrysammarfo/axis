"""Test fixtures."""

import os

# Set env before any settings cache — all keys required in production
_TEST_ENV = {
    "ENVIRONMENT": "testing",
    "VENICE_API_KEY": "test-venice-key",
    "OPENAI_API_KEY": "test-openai-key",
    "TINYFISH_API_KEY": "test-tinyfish-key",
    "MAGIC_SECRET_KEY": "test-magic-secret",
    "MAGIC_PUBLISHABLE_KEY": "pk_test_magic",
    "PARTICLE_PROJECT_ID": "test-particle-project",
    "PARTICLE_CLIENT_KEY": "test-particle-client",
    "PARTICLE_APP_ID": "test-particle-app",
    "ZERODEV_PROJECT_ID": "test-zerodev-project",
    "ZERODEV_RPC_URL": "https://rpc.zerodev.app/api/v3/test-zerodev-project/chain/421614",
    "GOOGLE_CLIENT_ID": "test-google-client-id.apps.googleusercontent.com",
    "ARBITRUM_RPC": "https://arb-sepolia.g.alchemy.com/v2/test-alchemy-key",
    "AGENT_WALLET_PRIVATE_KEY": "0x" + "a" * 64,
    "X402_FACILITATOR_URL": "https://facilitator.payai.network",
}
for _key, _value in _TEST_ENV.items():
    os.environ.setdefault(_key, _value)

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
