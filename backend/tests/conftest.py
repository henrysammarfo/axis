"""Test fixtures."""

import os

# Set env before any settings cache
os.environ["ENVIRONMENT"] = "testing"
os.environ["VENICE_API_KEY"] = "test-venice-key"
os.environ["MAGIC_SECRET_KEY"] = "test-magic-secret"

import pytest
from httpx import ASGITransport, AsyncClient

from config import get_settings
from database import init_db
from main import app

get_settings.cache_clear()

AUTH_HEADERS = {"Authorization": "Bearer test-did-token"}


@pytest.fixture(autouse=True)
async def setup_db():
    await init_db()
    yield


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
