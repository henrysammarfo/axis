"""Health and configuration status endpoints."""

from fastapi import APIRouter

from config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    settings = get_settings()
    return {
        "status": "ok",
        "service": "axis-backend",
        "environment": settings.environment,
        "ai_provider": settings.ai_provider,
        "wallet_configured": settings.wallet_configured,
        "zerodev_configured": settings.zerodev_configured,
    }


@router.get("/config/status")
async def config_status():
    """Public-safe config status for frontend to show setup progress."""
    settings = get_settings()
    return {
        "ai": {
            "venice": bool(settings.venice_api_key),
            "openai": bool(settings.openai_api_key),
            "anthropic": bool(settings.anthropic_api_key),
            "active_provider": settings.ai_provider,
        },
        "wallet": {
            "magic": bool(settings.magic_secret_key and settings.magic_publishable_key),
            "particle": bool(settings.particle_project_id and settings.particle_client_key),
            "zerodev": settings.zerodev_configured,
            "google_oauth": bool(settings.google_client_id),
        },
        "chain": {
            "arbitrum_rpc": settings.arbitrum_rpc,
            "chain_id": settings.arbitrum_chain_id,
        },
        "intelligence": {
            "tinyfish": bool(settings.tinyfish_api_key),
            "x402_wallet": bool(settings.agent_wallet_private_key),
        },
    }
