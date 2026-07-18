"""AXIS Agent API routes — StrategyEngine allocate, client-signed Aave settle."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import require_auth, require_own_user
from rate_limit import limiter
from services.aave_transactions import (
    FundingError,
    build_activation_transactions,
    require_usdc_funding,
    verify_tx_success,
)
from services.ai_agent import AxisAgent
from services.defi_executor import DeFiExecutor
from services.portfolio_tracker import PortfolioTracker
from services.strategy_engine import (
    MIN_BUDGET_USDC,
    build_plan,
    parse_goal,
    parse_risk_level,
)
from services.tenant_guard import assert_same_user, assert_wallet_belongs_to_user
from services.x402_client import X402Client
from services.yield_fetcher import YieldFetcher

router = APIRouter(prefix="/agent", tags=["agent"])


class ActivateRequest(BaseModel):
    user_id: str
    budget_usdc: float = Field(ge=MIN_BUDGET_USDC, le=100_000)
    risk_level: str = "moderate"
    goal: str = "Maximize yield"
    ua_address: str
    sra_address: str | None = None


class ConfirmActivateRequest(BaseModel):
    user_id: str
    ua_address: str
    sra_address: str | None = None
    budget_usdc: float = Field(ge=MIN_BUDGET_USDC, le=100_000)
    risk_level: str
    goal: str
    plan: dict[str, Any]
    signed_txs: list[dict[str, Any]] = Field(
        ...,
        description="List of {purpose, tx_hash, leg_asset?, amount_usdc?, estimated_apy?}",
    )


class RebalanceRequest(BaseModel):
    user_id: str
    ua_address: str
    instruction: str


class PreviewRequest(BaseModel):
    budget_usdc: float = Field(ge=MIN_BUDGET_USDC, le=100_000)
    risk_level: str = "moderate"
    goal: str = "Maximize yield"


async def _live_aave_apys() -> dict[str, float]:
    fetcher = YieldFetcher()
    out: dict[str, float] = {}
    for asset in ("USDC", "USDT"):
        try:
            data = await fetcher.get_aave_apy(asset)
            out[asset] = float(data.get("supply_apy", 0) or 0)
        except Exception:
            out[asset] = 0.0
    return out


def _validate_enums(risk_level: str, goal: str) -> tuple[str, str]:
    try:
        risk = parse_risk_level(risk_level)
        goal_e = parse_goal(goal)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return risk.value, goal_e.value


@router.post("/strategy/preview")
@limiter.limit("30/minute")
async def preview_strategy(request_body: PreviewRequest, request: Request):
    """Return the locked matrix plan + live APYs (no auth required for onboard preview)."""
    risk, goal = _validate_enums(request_body.risk_level, request_body.goal)
    apys = await _live_aave_apys()
    plan = build_plan(risk, goal, request_body.budget_usdc, apys)
    return {"plan": plan.to_dict(), "live_apys": apys}


@router.post("/activate")
@limiter.limit("10/minute")
async def activate_axis(
    request_body: ActivateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """
    Set up the agent: save budget/risk/goal and return the locked plan.

    No signing and no funding required here — activation is configuration only.
    Money is put to work later via /agent/deploy when the user chooses.
    """
    assert_same_user(auth_user_id, request_body.user_id)
    risk, goal = _validate_enums(request_body.risk_level, request_body.goal)

    tracker = PortfolioTracker(db)
    existing = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(
        existing,
        request_body.ua_address,
        request_body.sra_address,
        allow_first_bind=True,
    )

    apys = await _live_aave_apys()
    plan = build_plan(risk, goal, request_body.budget_usdc, apys)

    await tracker.save_strategy_prefs(
        user_id=request_body.user_id,
        budget_usdc=request_body.budget_usdc,
        risk_level=risk,
        goal=goal,
        ua_address=request_body.ua_address,
        sra_address=request_body.sra_address,
        mark_active=True,
    )

    defi = DeFiExecutor(request_body.ua_address)
    x402 = X402Client(request_body.ua_address, db)
    agent = AxisAgent(defi, x402, tracker)
    explained = await agent.explain_plan(plan)

    return {
        "status": "activated",
        "plan": plan.to_dict(),
        "explanation": explained["explanation"],
        "provider": explained["provider"],
        "message": (
            "Your AXIS agent is set up. Add USDC to your address on Arbitrum, "
            "then deploy whenever you're ready — no rush, no trading now."
        ),
    }


@router.post("/deploy/prepare")
@limiter.limit("10/minute")
async def prepare_deploy(
    request_body: ActivateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """
    Optional, explicit deploy step: check USDC funding + build the Aave txs to sign.
    Only called when the user actively chooses to put money to work.
    """
    assert_same_user(auth_user_id, request_body.user_id)
    risk, goal = _validate_enums(request_body.risk_level, request_body.goal)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(
        user,
        request_body.ua_address,
        request_body.sra_address,
        allow_first_bind=True,
    )

    try:
        require_usdc_funding(request_body.ua_address, request_body.budget_usdc)
    except FundingError as exc:
        raise HTTPException(status_code=402, detail=str(exc)) from exc

    apys = await _live_aave_apys()
    plan = build_plan(risk, goal, request_body.budget_usdc, apys)

    try:
        transactions = build_activation_transactions(
            owner=request_body.ua_address,
            plan=plan,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": "pending_signatures",
        "plan": plan.to_dict(),
        "transactions": transactions,
        "message": "Sign these Aave deposits in your wallet to start earning.",
    }


@router.post("/activate/confirm")
@limiter.limit("10/minute")
async def confirm_activate(
    request_body: ConfirmActivateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """Verify on-chain txs, persist positions, mark active."""
    assert_same_user(auth_user_id, request_body.user_id)
    risk, goal = _validate_enums(request_body.risk_level, request_body.goal)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(
        user,
        request_body.ua_address,
        request_body.sra_address,
        allow_first_bind=False,
    )

    if not request_body.signed_txs:
        raise HTTPException(status_code=422, detail="signed_txs required")

    supply_legs = [
        t
        for t in request_body.signed_txs
        if str(t.get("purpose", "")).startswith("supply_aave")
    ]
    if not supply_legs:
        raise HTTPException(
            status_code=422,
            detail="At least one supply_aave_* transaction hash is required",
        )

    verified: list[dict[str, Any]] = []
    for item in request_body.signed_txs:
        tx_hash = item.get("tx_hash")
        if not tx_hash:
            raise HTTPException(status_code=422, detail="Each signed tx needs tx_hash")
        try:
            receipt = verify_tx_success(str(tx_hash))
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        verified.append({**item, **receipt})

    for leg in supply_legs:
        amount = float(leg.get("amount_usdc") or 0)
        asset = str(leg.get("leg_asset") or "USDC")
        apy = float(leg.get("estimated_apy") or 0)
        result = {
            "success": True,
            "tx_hash": leg["tx_hash"],
            "chain": "arbitrum",
            "estimated_apy": apy,
            "executed_via": "Magic wallet · Aave v3",
        }
        await tracker.log_action(
            request_body.user_id,
            "execute_allocation",
            {
                "protocol": "aave",
                "asset": asset,
                "amount_usdc": amount,
                "action": "supply",
            },
            result,
            message=f"Supplied ${amount:.2f} {asset} to Aave",
        )

    await tracker.save_strategy_prefs(
        user_id=request_body.user_id,
        budget_usdc=request_body.budget_usdc,
        risk_level=risk,
        goal=goal,
        ua_address=request_body.ua_address,
        sra_address=request_body.sra_address,
        mark_active=True,
    )

    plan_notes = request_body.plan.get("notes") if isinstance(request_body.plan, dict) else None
    explanation = (
        "Activation confirmed. Your funds are supplied to Aave on Arbitrum."
        if not plan_notes
        else f"Activation confirmed. {plan_notes[0] if isinstance(plan_notes, list) and plan_notes else ''}"
    )

    return {
        "status": "activated",
        "explanation": explanation,
        "actions_taken": len(supply_legs),
        "verified_txs": verified,
        "message": "AXIS is managing your Aave positions. Check the dashboard for live status.",
    }


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

    # v1: rebalance does not invent new protocols — explain current matrix prefs only.
    apys = await _live_aave_apys()
    plan = build_plan(user.risk_level, user.goal or "grow", user.budget_usdc or MIN_BUDGET_USDC, apys)
    defi = DeFiExecutor(request_body.ua_address)
    x402 = X402Client(request_body.ua_address, db)
    agent = AxisAgent(defi, x402, tracker)
    explained = await agent.explain_plan(plan)

    return {
        "status": "rebalance_preview",
        "explanation": (
            f"Noted: {request_body.instruction.strip()[:200]}. "
            f"{explained['explanation']} "
            "To change risk or goal, run Activate again with a new selection."
        ),
        "actions": [],
        "plan": plan.to_dict(),
        "provider": explained["provider"],
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
