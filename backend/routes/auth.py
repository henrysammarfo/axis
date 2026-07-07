"""Magic Labs authentication routes."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from services.auth_service import AuthService
from services.portfolio_tracker import PortfolioTracker

router = APIRouter(prefix="/auth", tags=["auth"])


class VerifyRequest(BaseModel):
    did_token: str


class RegisterRequest(BaseModel):
    did_token: str
    ua_address: str | None = None
    sra_address: str | None = None


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
    user = await tracker.ensure_user(
        user_id=user_id,
        email=result.get("email"),
        ua_address=request.ua_address,
        sra_address=request.sra_address,
    )

    return {
        "user_id": user.id,
        "email": user.email,
        "ua_address": user.ua_address,
        "sra_address": user.sra_address,
    }
