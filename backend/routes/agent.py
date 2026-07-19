"""AXIS Agent API routes — StrategyEngine allocate, client-signed Aave settle."""

from __future__ import annotations

import time
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
    build_rebalance_calls,
    build_supply_calls,
    get_native_balance_wei,
    get_token_balance_usdc,
    require_usdc_funding,
    verify_tx_success,
)
from services.ai_agent import AxisAgent
from services.defi_executor import DeFiExecutor
from services.portfolio_tracker import PortfolioTracker
from services.strategy_engine import (
    GMX_GM_ASSET,
    GMX_GM_PROTOCOL,
    MIN_BUDGET_USDC,
    RiskLevel,
    UNISWAP_LP_ASSET,
    UNISWAP_LP_PROTOCOL,
    build_plan,
    build_plan_from_custom,
    parse_goal,
    parse_risk_level,
    recommend_gmx_usdc,
    recommend_lp_usdc,
    validate_custom_legs,
)
from services.gmx_gm import (
    build_gm_deposit_calls,
    build_gm_withdraw_calls,
    estimate_execution_fee_wei,
    get_gm_balance,
)
from services.uniswap_lp import build_lp_enter_calls, build_lp_exit_calls, find_lp_position
from services.tenant_guard import assert_same_user, assert_wallet_belongs_to_user
from services.x402_client import X402Client
from services.yield_fetcher import YieldFetcher
from services.yield_router import (
    VENUE_AAVE_USDC,
    VENUE_GMX_GM,
    VENUE_UNISWAP_LP,
    route_best_yield,
)

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


class EnableSessionRequest(BaseModel):
    user_id: str
    ua_address: str
    approval: str = Field(..., min_length=1)
    session_signer: str


class RebalancePrepareRequest(BaseModel):
    user_id: str
    ua_address: str
    instruction: str


class RebalanceConfirmRequest(BaseModel):
    user_id: str
    ua_address: str
    instruction: str
    tx_hash: str
    actions: list[dict[str, Any]] = Field(default_factory=list)


class MarketRiskConsentRequest(BaseModel):
    user_id: str
    ua_address: str
    consent: bool = True


class ProfileUpdateRequest(BaseModel):
    user_id: str
    ua_address: str
    display_name: str | None = None
    avatar: str | None = None


class LpPrepareRequest(BaseModel):
    user_id: str
    ua_address: str
    usdc_amount: float | None = Field(default=None, ge=0)


class LpConfirmRequest(BaseModel):
    user_id: str
    ua_address: str
    usdc_amount: float = Field(gt=0)
    tx_hash: str
    estimated_apy: float = 0.0


class LpExitPrepareRequest(BaseModel):
    user_id: str
    ua_address: str


class LpExitConfirmRequest(BaseModel):
    user_id: str
    ua_address: str
    tx_hash: str


class GmxDepositPrepareRequest(BaseModel):
    user_id: str
    ua_address: str
    usdc_amount: float | None = Field(default=None, ge=0)


class GmxDepositConfirmRequest(BaseModel):
    user_id: str
    ua_address: str
    usdc_amount: float = Field(gt=0)
    tx_hash: str
    estimated_apy: float = 0.0


class GmxWithdrawPrepareRequest(BaseModel):
    user_id: str
    ua_address: str


class GmxWithdrawConfirmRequest(BaseModel):
    user_id: str
    ua_address: str
    tx_hash: str


class RoutePreviewRequest(BaseModel):
    user_id: str
    ua_address: str
    # Optional what-if amount; defaults to idle USDC (or the saved budget as a projection).
    budget_usdc: float | None = Field(default=None, ge=0)
    # Power-user toggles: venues to keep out of the auto-route (e.g. ["gmx_gm"]).
    exclude_venues: list[str] = Field(default_factory=list)


class RouteApplyPrepareRequest(BaseModel):
    user_id: str
    ua_address: str
    exclude_venues: list[str] = Field(default_factory=list)


class RouteApplyLeg(BaseModel):
    venue: str
    tx_hash: str
    amount_usdc: float = 0.0
    estimated_apy: float = 0.0


class RouteApplyConfirmRequest(BaseModel):
    user_id: str
    ua_address: str
    legs: list[RouteApplyLeg] = Field(default_factory=list)


class CustomStrategyLeg(BaseModel):
    protocol: str = "aave"
    asset: str
    weight_pct: float


class CustomStrategyRequest(BaseModel):
    user_id: str
    ua_address: str
    legs: list[CustomStrategyLeg]


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


def _read_wallet_balances(owner: str) -> dict[str, float]:
    """Best-effort snapshot of what the account actually holds (never raises)."""
    def _tok(asset: str) -> float:
        try:
            return round(float(get_token_balance_usdc(owner, asset) or 0.0), 2)
        except Exception:
            return 0.0

    eth = 0.0
    try:
        eth = round(get_native_balance_wei(owner) / 1e18, 6)
    except Exception:
        eth = 0.0
    return {"usdc": _tok("USDC"), "usdt": _tok("USDT"), "eth": eth}


def _gmx_fundability(eth_balance: float) -> tuple[bool, float]:
    """(fundable, estimated keeper fee in ETH) — GMX needs the user's own ETH."""
    try:
        fee_wei = estimate_execution_fee_wei()
    except Exception:
        fee_wei = 3_000_000_000_000_000  # cap fallback (~0.003 ETH)
    fee_eth = round(fee_wei / 1e18, 6)
    return (eth_balance + 1e-9 >= fee_eth, fee_eth)


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


@router.post("/route/preview")
@limiter.limit("30/minute")
async def preview_route(
    request_body: RoutePreviewRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """
    Best-yield router: scan every venue's live APY and return ONE risk-adjusted
    allocation for the user's profile + available funds.

    Aave is always eligible; the Uniswap stable LP and GMX GM pool are only routed
    into when the user is Aggressive AND has given one-time market-risk consent.
    This is a recommendation — execution stays with the signing-free actions
    (deploy → Aave, open LP, add to GMX), each of which takes an explicit amount.
    """
    assert_same_user(auth_user_id, request_body.user_id)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=False)
    if not user:
        raise HTTPException(status_code=404, detail="User not registered")

    risk = parse_risk_level(user.risk_level or "moderate")
    goal = user.goal or "grow"

    idle = 0.0
    try:
        idle = float(get_token_balance_usdc(request_body.ua_address, "USDC") or 0.0)
    except Exception:
        idle = 0.0

    saved_budget = float(user.budget_usdc or 0.0)
    if request_body.budget_usdc and request_body.budget_usdc > 0:
        amount = float(request_body.budget_usdc)
        projected = amount > idle + 0.01
    elif idle >= MIN_BUDGET_USDC:
        amount = idle
        projected = False
    else:
        # Not enough idle to route yet — project against the saved budget so the
        # user can still see the plan before funding.
        amount = max(saved_budget, MIN_BUDGET_USDC)
        projected = True

    market_risk_ok = risk == RiskLevel.AGGRESSIVE and bool(user.market_risk_consent)

    balances = _read_wallet_balances(request_body.ua_address)
    gmx_fundable, gmx_fee_eth = _gmx_fundability(balances["eth"])

    plan = await route_best_yield(
        risk_level=risk,
        goal=goal,
        budget_usdc=amount,
        market_risk_ok=market_risk_ok,
        exclude_venues={v.lower() for v in request_body.exclude_venues},
    )

    return {
        "status": "ok",
        "route": plan.to_dict(),
        "idle_usdc": round(idle, 2),
        "projected": projected,
        "market_risk_ok": market_risk_ok,
        "session_active": bool(user.session_active),
        "balances": balances,
        "gmx_fundable": gmx_fundable,
        "gmx_fee_eth": gmx_fee_eth,
    }


def _apply_leg_meta(venue: str) -> tuple[str, str, str, str] | None:
    """(protocol, asset, action, executed_via) for a route leg's confirm log."""
    if venue == VENUE_AAVE_USDC:
        return ("aave", "USDC", "supply", "AXIS session key · Aave V3")
    if venue == VENUE_UNISWAP_LP:
        return (UNISWAP_LP_PROTOCOL, UNISWAP_LP_ASSET, "lp", "AXIS session key · Uniswap V3")
    if venue == VENUE_GMX_GM:
        return (GMX_GM_PROTOCOL, GMX_GM_ASSET, "gm_deposit", "AXIS session key · GMX V2 (keeper-settled)")
    return None


@router.post("/route/apply/prepare")
@limiter.limit("20/minute")
async def prepare_route_apply(
    request_body: RouteApplyPrepareRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """
    One-tap "apply the best route": recompute the winning allocation for the user's
    idle USDC and return the session calls, grouped per venue.

    The frontend runs each group as its own gasless UserOp (session key, no signing),
    skipping any leg that can't land so the safe legs still go through. The stable
    Aave USDC core is always first; the market sleeve (LP, GMX) only appears when the
    user is Aggressive AND has given one-time market-risk consent.
    """
    assert_same_user(auth_user_id, request_body.user_id)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=False)

    if not (user and user.session_active):
        raise HTTPException(status_code=409, detail="Turn on hands-off mode first.")

    idle = 0.0
    try:
        idle = float(get_token_balance_usdc(request_body.ua_address, "USDC") or 0.0)
    except Exception:
        idle = 0.0

    if idle < MIN_BUDGET_USDC:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Add at least ${MIN_BUDGET_USDC:.0f} idle USDC to apply a route "
                f"(idle: ${idle:.2f})."
            ),
        )

    risk = parse_risk_level(user.risk_level or "moderate")
    goal = user.goal or "grow"
    market_risk_ok = risk == RiskLevel.AGGRESSIVE and bool(user.market_risk_consent)

    balances = _read_wallet_balances(request_body.ua_address)
    gmx_fundable, gmx_fee_eth = _gmx_fundability(balances["eth"])

    # Balance-aware pre-skip: GMX needs the user's own ETH for the keeper fee. If
    # they don't hold enough, keep GMX OUT of the tap (its share folds into the
    # stable core / LP) so the one-tap never attempts a leg that can't settle.
    excluded = {v.lower() for v in request_body.exclude_venues}
    pre_skipped: list[dict[str, Any]] = []
    if not gmx_fundable and VENUE_GMX_GM not in excluded:
        excluded.add(VENUE_GMX_GM)
        pre_skipped.append(
            {
                "venue": VENUE_GMX_GM,
                "reason": f"needs ~{gmx_fee_eth} ETH for GMX's keeper fee",
            }
        )

    plan = await route_best_yield(
        risk_level=risk,
        goal=goal,
        budget_usdc=idle,
        market_risk_ok=market_risk_ok,
        exclude_venues=excluded,
    )

    deadline = int(time.time()) + 1200
    groups: list[dict[str, Any]] = []
    total_fee_wei = 0
    for leg in plan.legs:
        calls: list[dict[str, Any]] = []
        try:
            if leg.venue == VENUE_AAVE_USDC:
                calls = build_supply_calls(owner=request_body.ua_address, usdc_amount=leg.amount_usdc)
            elif leg.venue == VENUE_UNISWAP_LP:
                calls = build_lp_enter_calls(
                    owner=request_body.ua_address, usdc_amount=leg.amount_usdc, deadline=deadline
                )
            elif leg.venue == VENUE_GMX_GM:
                calls, fee_wei = build_gm_deposit_calls(
                    owner=request_body.ua_address, usdc_amount=leg.amount_usdc
                )
                total_fee_wei += int(fee_wei)
            else:
                continue
        except ValueError:
            continue  # amount too small for this venue → skip the leg, keep the rest

        if not calls:
            continue

        groups.append(
            {
                "venue": leg.venue,
                "protocol": leg.protocol,
                "asset": leg.asset,
                "amount_usdc": leg.amount_usdc,
                "estimated_apy": leg.estimated_apy,
                "risk_tier": leg.risk_tier,
                "calls": calls,
            }
        )

    if not groups:
        raise HTTPException(
            status_code=400,
            detail="Nothing to apply right now — no eligible venue for your funds.",
        )

    return {
        "status": "pending_execution",
        "route": plan.to_dict(),
        "groups": groups,
        "idle_usdc": round(idle, 2),
        "execution_fee_wei": str(total_fee_wei),
        "balances": balances,
        "pre_skipped": pre_skipped,
        "explanation": (
            f"AXIS is putting your ${plan.deployed_usdc:.2f} to work across "
            f"{len(groups)} venue(s) — no signing. GMX's small ETH keeper fee (if any) "
            "comes from your wallet's ETH; everything else is gas-sponsored."
        ),
    }


@router.post("/route/apply/confirm")
@limiter.limit("20/minute")
async def confirm_route_apply(
    request_body: RouteApplyConfirmRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """Verify each executed route leg on-chain and record the positions."""
    assert_same_user(auth_user_id, request_body.user_id)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=False)

    applied: list[dict[str, Any]] = []
    for leg in request_body.legs:
        meta = _apply_leg_meta(leg.venue)
        if not meta:
            continue
        try:
            receipt = verify_tx_success(leg.tx_hash)
        except Exception:
            continue  # unverifiable/failed tx → don't record it, keep going

        protocol, asset, action, executed_via = meta
        amount = round(float(leg.amount_usdc or 0.0), 2)
        await tracker.log_action(
            request_body.user_id,
            "execute_allocation",
            {"protocol": protocol, "asset": asset, "amount_usdc": amount, "action": action},
            {
                "success": True,
                "tx_hash": leg.tx_hash,
                "chain": "arbitrum",
                "estimated_apy": float(leg.estimated_apy or 0.0),
                "executed_via": executed_via,
                **receipt,
            },
            message=f"Route leg: {protocol} {asset} · ${amount:.2f}",
        )
        applied.append(
            {
                "venue": leg.venue,
                "protocol": protocol,
                "asset": asset,
                "amount_usdc": amount,
                "tx_hash": leg.tx_hash,
            }
        )

    return {
        "status": "applied",
        "applied": applied,
        "count": len(applied),
        "explanation": (
            f"Done — AXIS put your money to work across {len(applied)} venue(s)."
            if applied
            else "No legs were confirmed on-chain."
        ),
    }


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
    custom_legs = (user.custom_strategy or {}).get("legs") if user else None
    if custom_legs:
        # Power-user custom mix — still bounded by the same on-chain session policy.
        plan = build_plan_from_custom(custom_legs, request_body.budget_usdc, apys, risk, goal)
    else:
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


@router.post("/session/enable")
@limiter.limit("10/minute")
async def enable_session(
    request_body: EnableSessionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """Store the user's policy-bounded session-key approval (turns on hands-off mode)."""
    assert_same_user(auth_user_id, request_body.user_id)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=True)

    await tracker.save_session_approval(
        user_id=request_body.user_id,
        ua_address=request_body.ua_address,
        approval=request_body.approval,
        session_signer=request_body.session_signer,
    )
    return {
        "status": "session_enabled",
        "session_active": True,
        "message": "AXIS can now invest for you hands-free, within your locked limits.",
    }


@router.get("/session/approval/{user_id}")
@limiter.limit("60/minute")
async def get_session_approval(
    user_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """Return the caller's own serialized session approval (used by the server executor)."""
    assert_same_user(auth_user_id, user_id)
    tracker = PortfolioTracker(db)
    user = await tracker.get_user(user_id)
    if not (user and user.session_active and user.session_key_approval):
        raise HTTPException(status_code=404, detail="No active hands-off session.")
    return {
        "approval": user.session_key_approval,
        "session_signer": user.session_key_signer,
    }


@router.post("/rebalance/prepare")
@limiter.limit("20/minute")
async def prepare_rebalance(
    request_body: RebalancePrepareRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """Build policy-safe (USDC-only) rebalance calls the session key can execute."""
    assert_same_user(auth_user_id, request_body.user_id)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=False)

    if not (user and user.session_active):
        raise HTTPException(status_code=409, detail="Hands-off mode is not enabled yet.")

    try:
        calls, actions, explanation = build_rebalance_calls(
            owner=request_body.ua_address,
            instruction=request_body.instruction,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": "pending_execution" if calls else "no_action",
        "explanation": explanation,
        "calls": calls,
        "actions": actions,
    }


@router.post("/rebalance/confirm")
@limiter.limit("20/minute")
async def confirm_rebalance(
    request_body: RebalanceConfirmRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """Verify the session-executed rebalance on-chain and log it."""
    assert_same_user(auth_user_id, request_body.user_id)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=False)

    try:
        receipt = verify_tx_success(request_body.tx_hash)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    for action in request_body.actions:
        await tracker.log_action(
            request_body.user_id,
            "rebalance",
            {"instruction": request_body.instruction[:200], **action},
            {"success": True, "tx_hash": request_body.tx_hash, **receipt, "executed_via": "AXIS session key"},
            message=f"AXIS rebalanced: {action.get('action', 'update')} {action.get('asset', '')}".strip(),
        )

    return {
        "status": "rebalanced",
        "explanation": "AXIS updated your positions hands-free.",
    }


@router.post("/strategy/custom")
@limiter.limit("10/minute")
async def save_custom_strategy(
    request_body: CustomStrategyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """Validate + persist a power-user custom strategy (bounded to the allowlist)."""
    assert_same_user(auth_user_id, request_body.user_id)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=True)

    legs = [leg.model_dump() for leg in request_body.legs]
    try:
        clean = validate_custom_legs(legs)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    budget = (user.budget_usdc if user and user.budget_usdc else MIN_BUDGET_USDC)
    apys = await _live_aave_apys()
    try:
        plan = build_plan_from_custom(clean, budget, apys)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    await tracker.save_custom_strategy(
        user_id=request_body.user_id,
        ua_address=request_body.ua_address,
        custom_strategy={"legs": clean},
    )
    return {
        "status": "saved",
        "plan": plan.to_dict(),
        "custom_strategy": {"legs": clean},
        "message": "Your custom strategy is saved. Deploy or rebalance to apply it.",
    }


MIN_LP_USDC = 2.0  # need at least ~$1 per side after the split


@router.post("/consent/market-risk")
@limiter.limit("10/minute")
async def set_market_risk_consent(
    request_body: MarketRiskConsentRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """Record the user's one-time consent to market-risk positions (Uniswap V3 LP)."""
    assert_same_user(auth_user_id, request_body.user_id)
    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=True)

    await tracker.save_market_risk_consent(
        user_id=request_body.user_id,
        ua_address=request_body.ua_address,
        consent=request_body.consent,
    )
    return {"status": "ok", "market_risk_consent": bool(request_body.consent)}


# Cap avatar payload so an uploaded data URL can't bloat the row (a 256px JPEG
# data URL is ~30-50KB; anything much bigger is rejected).
_MAX_AVATAR_LEN = 300_000


@router.post("/profile")
@limiter.limit("20/minute")
async def update_profile(
    request_body: ProfileUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """Persist display name + avatar so they sync across a user's devices."""
    assert_same_user(auth_user_id, request_body.user_id)
    if request_body.avatar and len(request_body.avatar) > _MAX_AVATAR_LEN:
        raise HTTPException(status_code=413, detail="Avatar image is too large.")

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=True)

    saved = await tracker.save_profile(
        user_id=request_body.user_id,
        ua_address=request_body.ua_address,
        display_name=request_body.display_name,
        avatar=request_body.avatar,
    )
    return {
        "status": "ok",
        "display_name": saved.display_name,
        "avatar": saved.avatar,
    }


@router.post("/lp/prepare")
@limiter.limit("20/minute")
async def prepare_lp(
    request_body: LpPrepareRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """
    Build policy-safe Uniswap V3 USDC/USDT stable-LP calls for the session key.

    Gated: hands-off session ON + market-risk consent given + Aggressive tier.
    """
    assert_same_user(auth_user_id, request_body.user_id)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=False)

    if not (user and user.session_active):
        raise HTTPException(status_code=409, detail="Turn on hands-off mode first.")
    if not user.market_risk_consent:
        raise HTTPException(
            status_code=403,
            detail="Market-risk positions need your one-time consent first.",
        )
    if parse_risk_level(user.risk_level or "moderate") != RiskLevel.AGGRESSIVE:
        raise HTTPException(
            status_code=403,
            detail="The stable LP is available on the Aggressive risk level only.",
        )

    idle = get_token_balance_usdc(request_body.ua_address, "USDC")
    suggested = recommend_lp_usdc(user.risk_level, user.goal or "grow", user.budget_usdc or 0.0)
    amount = request_body.usdc_amount if request_body.usdc_amount else suggested
    amount = round(min(float(amount or 0.0), idle), 2)

    if amount < MIN_LP_USDC:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Need at least ${MIN_LP_USDC:.0f} idle USDC to open a stable LP "
                f"(idle: ${idle:.2f})."
            ),
        )

    try:
        calls = build_lp_enter_calls(
            owner=request_body.ua_address,
            usdc_amount=amount,
            deadline=int(time.time()) + 1200,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": "pending_execution",
        "calls": calls,
        "usdc_amount": amount,
        "explanation": (
            f"Opening a Uniswap V3 USDC/USDT stable LP with ${amount:.2f}. "
            "Full-range, both legs stablecoins, and the position is minted to you."
        ),
    }


@router.post("/lp/confirm")
@limiter.limit("20/minute")
async def confirm_lp(
    request_body: LpConfirmRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """Verify the session-executed LP mint on-chain and record the position."""
    assert_same_user(auth_user_id, request_body.user_id)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=False)

    try:
        receipt = verify_tx_success(request_body.tx_hash)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await tracker.log_action(
        request_body.user_id,
        "execute_allocation",
        {
            "protocol": UNISWAP_LP_PROTOCOL,
            "asset": UNISWAP_LP_ASSET,
            "amount_usdc": round(float(request_body.usdc_amount), 2),
            "action": "lp",
        },
        {
            "success": True,
            "tx_hash": request_body.tx_hash,
            "chain": "arbitrum",
            "estimated_apy": float(request_body.estimated_apy or 0.0),
            "executed_via": "AXIS session key · Uniswap V3",
            **receipt,
        },
        message=f"Opened Uniswap USDC/USDT LP with ${request_body.usdc_amount:.2f}",
    )
    return {
        "status": "lp_opened",
        "explanation": "Your Uniswap USDC/USDT stable LP is open and minted to you.",
    }


@router.post("/lp/exit/prepare")
@limiter.limit("20/minute")
async def prepare_lp_exit(
    request_body: LpExitPrepareRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """
    Build policy-safe calls to fully close the user's USDC/USDT stable LP.

    Reads the live position on-chain (source of truth), then decreases liquidity,
    collects everything to the owner, and burns the emptied NFT. Recipient is
    pinned to the owner by the session CallPolicy — funds only ever return to them.
    """
    assert_same_user(auth_user_id, request_body.user_id)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=False)

    if not (user and user.session_active):
        raise HTTPException(status_code=409, detail="Turn on hands-off mode first.")
    if not user.market_risk_consent:
        raise HTTPException(
            status_code=403,
            detail="Market-risk positions need your one-time consent first.",
        )

    position = find_lp_position(request_body.ua_address)
    if not position:
        return {
            "status": "no_action",
            "calls": [],
            "explanation": "No open USDC/USDT stable LP found for your wallet.",
        }

    token_id, liquidity = position
    try:
        calls = build_lp_exit_calls(
            owner=request_body.ua_address,
            token_id=token_id,
            liquidity=liquidity,
            deadline=int(time.time()) + 1200,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": "pending_execution",
        "calls": calls,
        "token_id": token_id,
        "explanation": (
            "Closing your Uniswap USDC/USDT stable LP: withdrawing liquidity and "
            "collecting everything back to your wallet."
        ),
    }


@router.post("/lp/exit/confirm")
@limiter.limit("20/minute")
async def confirm_lp_exit(
    request_body: LpExitConfirmRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """Verify the session-executed LP close on-chain and mark the position closed."""
    assert_same_user(auth_user_id, request_body.user_id)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=False)

    try:
        receipt = verify_tx_success(request_body.tx_hash)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    closed = await tracker.close_positions(
        request_body.user_id, UNISWAP_LP_PROTOCOL, UNISWAP_LP_ASSET
    )
    await tracker.log_action(
        request_body.user_id,
        "close_position",
        {"protocol": UNISWAP_LP_PROTOCOL, "asset": UNISWAP_LP_ASSET, "action": "lp_exit"},
        {
            "success": True,
            "tx_hash": request_body.tx_hash,
            "chain": "arbitrum",
            "executed_via": "AXIS session key · Uniswap V3",
            "positions_closed": closed,
            **receipt,
        },
        message="Closed Uniswap USDC/USDT stable LP",
    )
    return {
        "status": "lp_closed",
        "explanation": "Your stable LP is closed and the funds are back in your wallet.",
    }


MIN_GMX_USDC = 5.0  # keep deposits meaningfully above the keeper execution fee


def _require_gmx_eligible(user) -> None:
    """GMX GM is a signing-free market-risk action: hands-off + Aggressive + consent."""
    if not user:
        raise HTTPException(status_code=404, detail="User not registered")
    if not user.session_active:
        raise HTTPException(status_code=409, detail="Turn on hands-off mode first.")
    if not user.market_risk_consent:
        raise HTTPException(
            status_code=403,
            detail="GMX carries market risk and needs your one-time consent first.",
        )
    if parse_risk_level(user.risk_level or "moderate") != RiskLevel.AGGRESSIVE:
        raise HTTPException(
            status_code=403,
            detail="GMX GM pools are available on the Aggressive risk level only.",
        )


@router.post("/gmx/deposit/prepare")
@limiter.limit("20/minute")
async def prepare_gmx_deposit(
    request_body: GmxDepositPrepareRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """
    Build signing-free session calls to add USDC liquidity to the GMX GM ETH/USD pool.

    Market-risk action (hands-off + Aggressive + consent). Gas is sponsored by the
    paymaster, so there is NO signing — the agent executes it. The one thing the
    paymaster can't cover is GMX's native ETH keeper fee, so the account needs a
    little ETH for that (excess refunded). GM tokens are minted to the user
    (receiver pinned to the owner on-chain).
    """
    assert_same_user(auth_user_id, request_body.user_id)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=False)
    _require_gmx_eligible(user)

    idle = get_token_balance_usdc(request_body.ua_address, "USDC")
    suggested = recommend_gmx_usdc(user.risk_level, user.goal or "grow", user.budget_usdc or 0.0)
    amount = request_body.usdc_amount if request_body.usdc_amount else suggested
    amount = round(min(float(amount or 0.0), idle), 2)

    if amount < MIN_GMX_USDC:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Need at least ${MIN_GMX_USDC:.0f} idle USDC for a GMX deposit "
                f"(idle: ${idle:.2f})."
            ),
        )

    try:
        calls, fee_wei = build_gm_deposit_calls(owner=request_body.ua_address, usdc_amount=amount)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": "pending_execution",
        "calls": calls,
        "usdc_amount": amount,
        "execution_fee_wei": str(fee_wei),
        "execution_fee_eth": round(fee_wei / 1e18, 6),
        "explanation": (
            f"AXIS is adding ${amount:.2f} USDC to the GMX ETH/USD GM pool for you — no signing. "
            "Gas is on us; GMX's small ETH keeper fee comes from your wallet's ETH "
            "(any excess is refunded). GM tokens are minted to you and settle in a few seconds."
        ),
    }


@router.post("/gmx/deposit/confirm")
@limiter.limit("20/minute")
async def confirm_gmx_deposit(
    request_body: GmxDepositConfirmRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """Verify the GMX createDeposit tx and record the (keeper-settled) position."""
    assert_same_user(auth_user_id, request_body.user_id)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=False)

    try:
        receipt = verify_tx_success(request_body.tx_hash)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await tracker.log_action(
        request_body.user_id,
        "execute_allocation",
        {
            "protocol": GMX_GM_PROTOCOL,
            "asset": GMX_GM_ASSET,
            "amount_usdc": round(float(request_body.usdc_amount), 2),
            "action": "gm_deposit",
        },
        {
            "success": True,
            "tx_hash": request_body.tx_hash,
            "chain": "arbitrum",
            "estimated_apy": float(request_body.estimated_apy or 0.0),
            "executed_via": "AXIS session key · GMX V2 (keeper-settled)",
            **receipt,
        },
        message=f"Added ${request_body.usdc_amount:.2f} to GMX ETH/USD GM pool",
    )
    return {
        "status": "gmx_deposit_submitted",
        "explanation": (
            "Your GMX deposit is submitted. GM tokens are minted to you once the keeper "
            "settles it (usually a few seconds)."
        ),
    }


@router.post("/gmx/withdraw/prepare")
@limiter.limit("20/minute")
async def prepare_gmx_withdraw(
    request_body: GmxWithdrawPrepareRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """Build signing-free session calls to redeem the account's full GMX GM ETH/USD position."""
    assert_same_user(auth_user_id, request_body.user_id)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=False)
    _require_gmx_eligible(user)

    gm_balance = get_gm_balance(request_body.ua_address)
    if gm_balance <= 0:
        return {
            "status": "no_action",
            "calls": [],
            "explanation": "No GMX GM ETH/USD position found for your wallet.",
        }

    try:
        calls, fee_wei = build_gm_withdraw_calls(
            owner=request_body.ua_address, gm_amount_raw=gm_balance
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": "pending_execution",
        "calls": calls,
        "gm_amount_raw": str(gm_balance),
        "execution_fee_wei": str(fee_wei),
        "execution_fee_eth": round(fee_wei / 1e18, 6),
        "explanation": (
            "AXIS is closing your GMX ETH/USD GM position for you — no signing. GMX's small "
            "ETH keeper fee comes from your wallet's ETH; your ETH + USDC settle back to you "
            "once the keeper executes it."
        ),
    }


@router.post("/gmx/withdraw/confirm")
@limiter.limit("20/minute")
async def confirm_gmx_withdraw(
    request_body: GmxWithdrawConfirmRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    """Verify the GMX createWithdrawal tx and mark the position closed."""
    assert_same_user(auth_user_id, request_body.user_id)

    tracker = PortfolioTracker(db)
    user = await tracker.get_user(request_body.user_id)
    assert_wallet_belongs_to_user(user, request_body.ua_address, allow_first_bind=False)

    try:
        receipt = verify_tx_success(request_body.tx_hash)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    closed = await tracker.close_positions(request_body.user_id, GMX_GM_PROTOCOL, GMX_GM_ASSET)
    await tracker.log_action(
        request_body.user_id,
        "close_position",
        {"protocol": GMX_GM_PROTOCOL, "asset": GMX_GM_ASSET, "action": "gm_withdraw"},
        {
            "success": True,
            "tx_hash": request_body.tx_hash,
            "chain": "arbitrum",
            "executed_via": "AXIS session key · GMX V2 (keeper-settled)",
            "positions_closed": closed,
            **receipt,
        },
        message="Closed GMX ETH/USD GM position",
    )
    return {
        "status": "gmx_withdraw_submitted",
        "explanation": (
            "Your GMX withdrawal is submitted. Funds settle back to your wallet once the "
            "keeper executes it (usually a few seconds)."
        ),
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
