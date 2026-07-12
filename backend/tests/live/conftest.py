"""Live test fixtures — loads real backend/.env and hits Sepolia."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

# Load real secrets before config import
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_ENV_PATH, override=True)
os.environ["ENVIRONMENT"] = "testing"  # allow test-did-token in live e2e; keys still from .env

from config import get_settings  # noqa: E402

get_settings.cache_clear()


def pytest_configure(config):
    config.addinivalue_line("markers", "live: live integration tests with real APIs and txs")


@pytest.fixture(scope="session")
def live_settings():
    settings = get_settings()
    missing = settings.missing_required()
    if missing:
        pytest.skip(f"Live tests require all backend keys. Missing: {', '.join(missing)}")
    return settings
