"""RH stock basket routes — Open House Singapore."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import require_auth, require_own_user
from services.beachhead import beachhead_pack, evaluate_geo, normalize_region
from services.basket_policy import build_basket_from_english, catalog
from services.fragmentation import compare_underlying, desk_catalog
from services.instrument_truth import (
    all_instruments,
    get_instrument,
    instruments_for_underlying,
    truth_card,
)
from services.liquidity_rails import liquidity_rails
from services.packages import package_catalog
from services.portfolio_tracker import PortfolioTracker
from services.retention import normalize_policy, retention_status
from services.rh_hold import FAUCET_URL, RhHoldService
from services.stock_registry import network_status
from services.usdg_path import usdg_path
from models import WaitlistSignup
from sqlalchemy import select

router = APIRouter(prefix="/basket", tags=["basket"])


class PreviewRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)
    budget_usdc: float = Field(default=100.0, ge=0, le=100_000)


class SaveRequest(BaseModel):
    user_id: str
    prompt: str = Field(min_length=1, max_length=500)
    budget_usdc: float = Field(default=100.0, ge=0, le=100_000)


class HoldRequest(BaseModel):
    user_id: str
    symbols: list[str] | None = None
    dust: float = Field(default=0.01, ge=0.001, le=1.0)
    mode: str = Field(default="auto", pattern="^(auto|fund|sync)$")


class RetentionPolicyBody(BaseModel):
    user_id: str
    cadence: str = Field(default="weekly", pattern="^(weekly|biweekly)$")
    weekday: str = Field(default="monday", max_length=16)
    timezone: str = Field(default="UTC", max_length=64)
    include_arb_yield: bool = True
    include_stock_legs: bool = True
    include_fragmentation_warnings: bool = True
    rebalance_mode: str = Field(default="report_only", pattern="^(report_only|suggest)$")


class WaitlistBody(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    region: str = Field(default="prefer_not", max_length=32)
    intent: str = Field(default="stock_path", max_length=64)
    user_id: str | None = None
    note: str | None = Field(default=None, max_length=280)


def _wanted_from_user(user) -> list[str]:
    plan = user.stock_basket or {}
    legs = plan.get("legs") or []
    return [leg["symbol"] for leg in legs if isinstance(leg, dict) and leg.get("symbol")]


def _persist_hold(user, result: dict) -> dict:
    prior = user.rh_holds if isinstance(user.rh_holds, dict) else {}
    history = list(prior.get("history") or [])
    history.append(
        {
            "recorded_at": result.get("recorded_at"),
            "mode": result.get("mode"),
            "status": result.get("status"),
            "txs": result.get("txs"),
            "skipped": result.get("skipped"),
            "coverage": result.get("coverage"),
            "legs": result.get("legs"),
        }
    )
    payload = {
        **result,
        "history": history[-20:],
    }
    user.rh_holds = payload
    return payload


@router.get("/network")
async def basket_network():
    return network_status()


@router.get("/catalog")
async def basket_catalog():
    return {"stocks": catalog(), "network": network_status()}


@router.get("/rails")
async def basket_rails():
    return liquidity_rails()


@router.get("/usdg")
async def basket_usdg():
    return usdg_path()


@router.get("/beachhead")
async def basket_beachhead(region: str | None = None):
    pack = beachhead_pack()
    if region:
        pack = {**pack, "geo": evaluate_geo(region)}
    else:
        pack = {**pack, "geo": evaluate_geo(None)}
    return pack


@router.get("/packages")
async def basket_packages():
    return package_catalog()


@router.get("/geo")
async def basket_geo(region: str = "prefer_not"):
    return evaluate_geo(region)


@router.post("/waitlist")
async def basket_waitlist(
    body: WaitlistBody,
    db: AsyncSession = Depends(get_db),
):
    email = body.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=422, detail="Valid email required")
    region = normalize_region(body.region)
    existing = await db.execute(
        select(WaitlistSignup).where(
            WaitlistSignup.email == email,
            WaitlistSignup.intent == body.intent,
        )
    )
    row = existing.scalar_one_or_none()
    if row:
        row.region = region
        row.user_id = body.user_id or row.user_id
        row.note = body.note or row.note
        await db.flush()
        created = False
    else:
        row = WaitlistSignup(
            email=email,
            region=region,
            intent=body.intent[:64],
            user_id=body.user_id,
            note=body.note,
        )
        db.add(row)
        await db.flush()
        created = True
    geo = evaluate_geo(region)
    return {
        "status": "joined" if created else "updated",
        "email": email,
        "region": region,
        "intent": row.intent,
        "geo": geo,
        "honesty": (
            "Waitlist records interest only — not eligibility, KYC, or a promise of mainnet "
            "stock access."
        ),
    }


@router.get("/faucet")
async def basket_faucet():
    try:
        svc = RhHoldService(require_signer=False)
        return svc.faucet_hint()
    except Exception as exc:
        return {
            "faucet_url": FAUCET_URL,
            "error": str(exc)[:200],
            "testnet": True,
            "chain_id": 46630,
        }


@router.get("/instruments")
async def basket_instruments(underlying: str | None = None):
    if underlying:
        rows = instruments_for_underlying(underlying)
        return {
            "underlying": underlying.upper().strip(),
            "instruments": rows,
            "count": len(rows),
            "honesty": "Same ticker ≠ same instrument. AXIS routes only address_verified + axis_routeable.",
        }
    rows = all_instruments()
    return {
        "instruments": rows,
        "count": len(rows),
        "honesty": "Instrument Truth registry — fail-closed on unverified addresses.",
    }


@router.get("/instruments/{instrument_id:path}")
async def basket_instrument(instrument_id: str):
    row = get_instrument(instrument_id)
    if not row:
        raise HTTPException(status_code=404, detail="Instrument not in AXIS truth registry")
    return row


@router.get("/truth/{symbol}")
async def basket_truth(symbol: str):
    return truth_card(symbol)


@router.get("/fragmentation")
async def basket_fragmentation_desk():
    return desk_catalog()


@router.get("/fragmentation/{symbol}")
async def basket_fragmentation_compare(symbol: str):
    return compare_underlying(symbol)


@router.post("/preview")
async def basket_preview(body: PreviewRequest):
    plan = build_basket_from_english(body.prompt, body.budget_usdc)
    # Attach truth cards so preview is instrument-honest, not ticker-only.
    truth = {leg.symbol: truth_card(leg.symbol) for leg in plan.legs}
    frag = {
        leg.symbol: {
            "instrument_count": truth[leg.symbol]["instrument_count"],
            "verified_count": truth[leg.symbol]["verified_count"],
            "fungible": False,
        }
        for leg in plan.legs
    }
    return {"plan": plan.to_dict(), "truth": truth, "fragmentation": frag}


@router.post("/save")
async def basket_save(
    body: SaveRequest,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    if body.user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="user_id mismatch")
    plan = build_basket_from_english(body.prompt, body.budget_usdc)
    if not plan.legs:
        raise HTTPException(status_code=422, detail=plan.english_summary)
    tracker = PortfolioTracker(db)
    user = await tracker.ensure_user(user_id=body.user_id)
    user.stock_basket = plan.to_dict()
    # Plan saved ≠ held — fail-closed status until Activate
    if not isinstance(user.rh_holds, dict) or user.rh_holds.get("status") not in (
        "held",
        "partial",
    ):
        user.rh_holds = {
            "status": "planned",
            "mode": None,
            "testnet": True,
            "chain_id": plan.chain_id,
            "network": plan.network,
            "txs": [],
            "honesty": "Basket saved as plan only — Activate hold required for live evidence.",
        }
    await db.flush()
    return {"status": "saved", "plan": plan.to_dict(), "holds": user.rh_holds}


@router.get("/{user_id}/readiness")
async def basket_readiness(
    user_id: str = Depends(require_own_user),
    db: AsyncSession = Depends(get_db),
):
    tracker = PortfolioTracker(db)
    user = await tracker.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not registered")
    try:
        svc = RhHoldService(require_signer=False)
        return {
            "readiness": svc.readiness(user.ua_address, _wanted_from_user(user) or None),
            "plan": user.stock_basket,
            "holds": user.rh_holds,
            "network": network_status(),
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"RH readiness failed: {exc}") from exc


@router.get("/{user_id}/holdings")
async def basket_holdings(
    user_id: str = Depends(require_own_user),
    db: AsyncSession = Depends(get_db),
):
    tracker = PortfolioTracker(db)
    user = await tracker.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not registered")
    if not user.ua_address:
        raise HTTPException(status_code=400, detail="UA address missing — complete onboarding first")
    try:
        svc = RhHoldService(require_signer=False)
        wanted = _wanted_from_user(user)
        holdings = svc.read_holdings(user.ua_address)
        readiness = svc.readiness(user.ua_address, wanted or None)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"RH RPC read failed: {exc}") from exc
    return {
        "holdings": holdings,
        "holds": user.rh_holds,
        "plan": user.stock_basket,
        "readiness": readiness,
        "network": network_status(),
        "rails": liquidity_rails(),
    }


@router.post("/hold")
async def basket_hold(
    body: HoldRequest,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    if body.user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="user_id mismatch")
    tracker = PortfolioTracker(db)
    user = await tracker.get_user(body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not registered")
    if not user.ua_address:
        raise HTTPException(status_code=400, detail="UA address missing — complete onboarding first")

    symbols = body.symbols or _wanted_from_user(user)
    if not symbols:
        raise HTTPException(
            status_code=422,
            detail="Save a stock basket first, or pass symbols to hold",
        )

    try:
        # fund needs signer; sync/auto may not
        require_signer = body.mode == "fund"
        svc = RhHoldService(require_signer=require_signer)
        if body.mode == "auto" and svc.account is None:
            # auto without agent key → sync-only path
            result = svc.activate(user.ua_address, symbols, mode="sync", dust=body.dust)
        else:
            if body.mode in ("auto", "fund") and svc.account is None:
                raise RuntimeError("AGENT_WALLET_PRIVATE_KEY required for fund/auto dust path")
            # ensure signer available for fund branch of auto
            if body.mode in ("auto", "fund"):
                svc = RhHoldService(require_signer=True)
            result = svc.activate(
                user.ua_address,
                symbols,
                mode=body.mode,  # type: ignore[arg-type]
                dust=body.dust,
            )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"RH hold failed: {exc}") from exc

    holds = _persist_hold(user, result)
    await db.flush()

    holdings = result.get("holdings_snapshot")
    if holdings is None and user.ua_address:
        try:
            holdings = RhHoldService(require_signer=False).read_holdings(user.ua_address)
        except Exception:
            holdings = None

    return {
        "hold": holds,
        "holdings": holdings,
        "network": network_status(),
        "rails": liquidity_rails(),
    }


@router.get("/retention/{user_id}")
async def basket_retention_get(
    user_id: str = Depends(require_own_user),
    db: AsyncSession = Depends(get_db),
):
    tracker = PortfolioTracker(db)
    user = await tracker.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not registered")
    return retention_status(
        policy=user.retention_policy,
        stock_basket=user.stock_basket,
        rh_holds=user.rh_holds,
        last_report_at=(user.rh_holds or {}).get("last_report_at")
        if isinstance(user.rh_holds, dict)
        else None,
    )


@router.post("/retention")
async def basket_retention_save(
    body: RetentionPolicyBody,
    db: AsyncSession = Depends(get_db),
    auth_user_id: str = Depends(require_auth),
):
    if body.user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="user_id mismatch")
    tracker = PortfolioTracker(db)
    user = await tracker.ensure_user(user_id=body.user_id)
    policy = normalize_policy(body.model_dump(exclude={"user_id"}))
    user.retention_policy = policy
    await db.flush()
    return retention_status(
        policy=policy,
        stock_basket=user.stock_basket,
        rh_holds=user.rh_holds,
    )


@router.get("/{user_id}")
async def basket_get(
    user_id: str = Depends(require_own_user),
    db: AsyncSession = Depends(get_db),
):
    tracker = PortfolioTracker(db)
    user = await tracker.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not registered")
    return {
        "plan": user.stock_basket,
        "holds": user.rh_holds,
        "network": network_status(),
        "faucet_url": FAUCET_URL,
        "ua_address": user.ua_address,
        "rails": liquidity_rails(),
        "retention": retention_status(
            policy=user.retention_policy,
            stock_basket=user.stock_basket,
            rh_holds=user.rh_holds,
        ),
    }
