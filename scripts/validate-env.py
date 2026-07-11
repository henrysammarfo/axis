#!/usr/bin/env python3
"""Validate backend .env has all required keys before starting."""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure backend package imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from config import get_settings, validate_startup_config  # noqa: E402


def main() -> int:
    get_settings.cache_clear()
    settings = get_settings()

    if settings.environment == "testing":
        print("ENVIRONMENT=testing — skipping key validation")
        return 0

    missing = settings.missing_required()
    if missing:
        print("Missing or invalid required environment variables:")
        for name in missing:
            print(f"  - {name}")
        print("\nFull setup guide: docs/KEYS_SETUP.md")
        return 1

    try:
        validate_startup_config()
    except RuntimeError as exc:
        print(exc)
        return 1

    print("All required backend keys are configured.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
