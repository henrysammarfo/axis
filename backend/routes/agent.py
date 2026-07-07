"""AXIS Agent API routes."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import require_auth
from services.ai_agent import AxisAgent
from services.defi_executor import DeFiExecutor
from services.portfolio_tracker import PortfolioTracker
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
async def activate_axis(
    request: ActivateRequest,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    if request.user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="User ID does not match authenticated session")
    tracker = PortfolioTracker(db)
    await tracker.activate_user(
        user_id=request.user_id,
        budget_usdc=request.budget_usdc,
        risk_level=request.risk_level,
        goal=request.goal,
        ua_address=request.ua_address,
        sra_address=request.sra_address,
    )

    defi = DeFiExecutor(request.ua_address)
    x402 = X402Client(request.ua_address, db)
    agent = AxisAgent(defi, x402, tracker)

    try:
        result = await agent.run(
            user_id=request.user_id,
            budget_usdc=request.budget_usdc,
            risk_level=request.risk_level,
            goal=request.goal,
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
async def manual_rebalance(
    request: RebalanceRequest,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    if request.user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="User ID does not match authenticated session")
    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request.user_id)
    budget = user.budget_usdc if user else 0

    defi = DeFiExecutor(request.ua_address)
    x402 = X402Client(request.ua_address, db)
    agent = AxisAgent(defi, x402, tracker)

    result = await agent.run(
        user_id=request.user_id,
        budget_usdc=budget,
        risk_level=user.risk_level if user else "moderate",
        goal=request.instruction,
    )

    return {
        "status": "rebalanced",
        "explanation": result["explanation"],
        "actions": result["actions"],
        "provider": result.get("provider"),
    }


@router.get("/report/{user_id}")
async def get_weekly_report(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    if user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    tracker = PortfolioTracker(db)
    defi = DeFiExecutor("")
    x402 = X402Client("", db)
    agent = AxisAgent(defi, x402, tracker)
    report = await agent.generate_weekly_report(user_id)
    return {"report": report, "user_id": user_id}


@router.get("/status/{user_id}")
async def get_agent_status(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    if user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    tracker = PortfolioTracker(db)
    summary = await tracker.get_summary(user_id)
    x402 = X402Client(summary.get("ua_address") or "", db)
    summary["x402_spend"] = await x402.get_spend_summary(user_id)
    return summary
