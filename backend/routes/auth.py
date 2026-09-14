"""Magic Labs authentication routes."""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from rate_limit import limiter
from services.auth_service import AuthService
from services.eip7702_sponsor import Eip7702Sponsor
from services.portfolio_tracker import PortfolioTracker
from services.tenant_guard import assert_address_not_claimed

router = APIRouter(prefix="/auth", tags=["auth"])


class VerifyRequest(BaseModel):
    did_token: str


class RegisterRequest(BaseModel):
    did_token: str
    ua_address: str | None = None
    sra_address: str | None = None
    email: str | None = None
    eip7702_tx_hash: str | None = None
    eip7702_delegated: bool | None = None


class SponsorEip7702Request(BaseModel):
    did_token: str
    authority: str = Field(min_length=42, max_length=42)
    authorization: dict


@router.post("/verify")
async def verify_token(request: VerifyRequest):
    auth = AuthService()
    result = await auth.verify_magic_token(request.did_token)
    if not result.get("valid"):
        raise HTTPException(status_code=401, detail=result.get("error", "Invalid token"))
    return {
        "valid": True,
        "user_id": auth.user_id_from_auth(result),
        "email": result.get("email"),
        "public_address": result.get("public_address"),
        "dev_mode": result.get("dev_mode", False),
    }


@router.post("/register")
async def register_user(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    auth = AuthService()
    result = await auth.verify_magic_token(request.did_token)
    if not result.get("valid"):
        raise HTTPException(status_code=401, detail=result.get("error", "Invalid token"))

    user_id = auth.user_id_from_auth(result)
    tracker = PortfolioTracker(db)

    if request.ua_address:
        await assert_address_not_claimed(tracker, request.ua_address, user_id)

    user = await tracker.ensure_user(
        user_id=user_id,
        email=result.get("email") or request.email,
        ua_address=request.ua_address,
        sra_address=request.sra_address,
        eip7702_tx_hash=request.eip7702_tx_hash,
        eip7702_delegated=request.eip7702_delegated,
    )

    # Returning users already have strategy / hands-off — frontend must skip
    # "Build your agent" and go straight to the dashboard.
    agent_ready = bool(
        user.active
        or (user.budget_usdc or 0) > 0
        or user.session_key_approval
        or user.session_active
    )

    return {
        "user_id": user.id,
        "email": user.email,
        "ua_address": user.ua_address,
        "sra_address": user.sra_address,
        "eip7702_tx_hash": user.eip7702_tx_hash,
        "eip7702_delegated": bool(user.eip7702_delegated),
        "active": bool(user.active),
        "agent_ready": agent_ready,
        "risk_level": user.risk_level,
        "goal": user.goal,
        "budget_usdc": float(user.budget_usdc or 0),
    }


@router.post("/sponsor-eip7702")
@limiter.limit("5/minute")
async def sponsor_eip7702(
    request_body: SponsorEip7702Request,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Broadcast Type-4 EIP-7702 for the Magic EOA — AXIS pays gas."""
    auth = AuthService()
    result = await auth.verify_magic_token(request_body.did_token)
    if not result.get("valid"):
        raise HTTPException(status_code=401, detail=result.get("error", "Invalid token"))

    magic_address = result.get("public_address")
    if not magic_address:
        raise HTTPException(status_code=400, detail="Magic wallet address unavailable from DID token")

    if magic_address.lower() != request_body.authority.lower():
        raise HTTPException(
            status_code=403,
            detail="Authority must match the Magic wallet on the DID token",
        )

    user_id = auth.user_id_from_auth(result)
    tracker = PortfolioTracker(db)

    try:
        sponsor = Eip7702Sponsor()
        outcome = sponsor.sponsor_delegation(
            authority=request_body.authority,
            authorization=request_body.authorization,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"EIP-7702 sponsorship failed: {exc}") from exc

    await assert_address_not_claimed(tracker, request_body.authority, user_id)
    user = await tracker.ensure_user(
        user_id=user_id,
        email=result.get("email"),
        ua_address=request_body.authority,
        eip7702_tx_hash=outcome["tx_hash"],
        eip7702_delegated=True,
    )

    return {
        "tx_hash": outcome["tx_hash"],
        "delegated": True,
        "authority": outcome["authority"],
        "sponsor": outcome["sponsor"],
        "user_id": user.id,
        "ua_address": user.ua_address,
        "eip7702_tx_hash": user.eip7702_tx_hash,
        "eip7702_delegated": True,
    }
