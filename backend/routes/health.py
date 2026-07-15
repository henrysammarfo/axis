"""Health and configuration status endpoints."""

from fastapi import APIRouter

from config import get_settings
from chain_config import ARBITRUM_ONE_CHAIN_ID

router = APIRouter(tags=["health"])


def _magic_auth_status() -> dict:
    settings = get_settings()
    if not settings.magic_secret_key:
        return {"ready": False, "mode": "unconfigured"}
    try:
        from services.auth_service import _magic_admin_client

        _magic_admin_client()
        publishable_suffix = settings.magic_publishable_key[-8:] if settings.magic_publishable_key else None
        return {
            "ready": True,
            "mode": "magic-admin",
            "publishable_suffix": publishable_suffix,
        }
    except Exception as exc:
        return {"ready": False, "mode": "magic-admin", "error": str(exc)[:120]}


@router.get("/health")
async def health():
    settings = get_settings()
    missing = settings.missing_required()
    return {
        "status": "ok" if settings.fully_configured else "degraded",
        "service": "axis-backend",
        "environment": settings.environment,
        "ai_provider": settings.ai_provider,
        "fully_configured": settings.fully_configured,
        "missing_keys": missing,
    }


@router.get("/config/status")
async def config_status():
    """Public-safe config status for frontend setup checklist."""
    settings = get_settings()
    missing = settings.missing_required()
    return {
        "fully_configured": settings.fully_configured,
        "missing_keys": missing,
        "ai": {
            "venice": bool(settings.venice_api_key),
            "openai": bool(settings.openai_api_key),
            "active_provider": settings.ai_provider,
        },
        "wallet": {
            "magic": bool(settings.magic_secret_key and settings.magic_publishable_key),
            "magic_auth": _magic_auth_status(),
            "particle": bool(
                settings.particle_project_id and settings.particle_client_key and settings.particle_app_id
            ),
            "zerodev": settings.zerodev_configured,
            "google_oauth": bool(settings.google_client_id),
        },
        "chain": {
            "arbitrum_rpc": settings.arbitrum_rpc,
            "chain_id": settings.arbitrum_chain_id,
            "dedicated_rpc": settings.chain_configured,
            "is_mainnet": settings.arbitrum_chain_id == ARBITRUM_ONE_CHAIN_ID,
        },
        "intelligence": {
            "tinyfish": bool(settings.tinyfish_api_key),
            "x402_wallet": bool(settings.agent_wallet_private_key),
            "x402_facilitator": bool(settings.x402_facilitator_url),
        },
    }
