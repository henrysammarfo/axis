"""AXIS Agent API routes."""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import require_auth, require_own_user
from rate_limit import limiter
from services.ai_agent import AxisAgent
from services.defi_executor import DeFiExecutor
from services.portfolio_tracker import PortfolioTracker
from services.tenant_guard import assert_same_user, assert_wallet_belongs_to_user
from services.x402_client import X402Client

router = APIRouter(prefix="/agent", tags=["agent"])


class ActivateRequest(BaseModel):
    user_id: str
    budget_usdc: float = Field(gt=0, le=100_000)
    risk_level: str = "moderate"
    goal: str = "maximize yield"
    ua_address: str
    sra_address: str | None = None


class RebalanceRequest(BaseModel):
    user_id: str
    ua_address: str
    instruction: str


@router.post("/activate")
@limiter.limit("10/minute")
async def activate_axis(
    request_body: ActivateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    assert_same_user(auth_user_id, request_body.user_id)

    tracker = PortfolioTracker(db)
    existing = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(
        existing,
        request_body.ua_address,
        request_body.sra_address,
        allow_first_bind=True,
    )

    await tracker.activate_user(
        user_id=request_body.user_id,
        budget_usdc=request_body.budget_usdc,
        risk_level=request_body.risk_level,
        goal=request_body.goal,
        ua_address=request_body.ua_address,
        sra_address=request_body.sra_address,
    )

    defi = DeFiExecutor(request_body.ua_address)
    x402 = X402Client(request_body.ua_address, db)
    agent = AxisAgent(defi, x402, tracker)

    try:
        result = await agent.run(
            user_id=request_body.user_id,
            budget_usdc=request_body.budget_usdc,
            risk_level=request_body.risk_level,
            goal=request_body.goal,
        )
        return {
            "status": "activated",
            "explanation": result["explanation"],
            "actions_taken": len(result["actions"]),
            "actions": result["actions"],
            "provider": result.get("provider"),
            "message": "AXIS is now managing your portfolio. Check back for weekly reports.",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/rebalance")
@limiter.limit("20/minute")
async def manual_rebalance(
    request_body: RebalanceRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    assert_same_user(auth_user_id, request_body.user_id)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not registered")

    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=False)

    budget = user.budget_usdc
    defi = DeFiExecutor(request_body.ua_address)
    x402 = X402Client(request_body.ua_address, db)
    agent = AxisAgent(defi, x402, tracker)

    result = await agent.run(
        user_id=request_body.user_id,
        budget_usdc=budget,
        risk_level=user.risk_level,
        goal=request_body.instruction,
    )

    return {
        "status": "rebalanced",
        "explanation": result["explanation"],
        "actions": result["actions"],
        "provider": result.get("provider"),
    }


@router.get("/report/{user_id}")
async def get_weekly_report(
    user_id: str = Depends(require_own_user),
    db: AsyncSession = Depends(get_db),
):
    tracker = PortfolioTracker(db)
    defi = DeFiExecutor("")
    x402 = X402Client("", db)
    agent = AxisAgent(defi, x402, tracker)
    report = await agent.generate_weekly_report(user_id)
    return {"report": report, "user_id": user_id}


@router.get("/status/{user_id}")
async def get_agent_status(
    user_id: str = Depends(require_own_user),
    db: AsyncSession = Depends(get_db),
):
    tracker = PortfolioTracker(db)
    summary = await tracker.get_summary(user_id)
    x402 = X402Client(summary.get("ua_address") or "", db)
    summary["x402_spend"] = await x402.get_spend_summary(user_id)
    return summary
