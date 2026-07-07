"""Test fixtures."""

import pytest
from httpx import ASGITransport, AsyncClient

from database import init_db
from main import app


@pytest.fixture(autouse=True)
async def setup_db():
    await init_db()
    yield


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
