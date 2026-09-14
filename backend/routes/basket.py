"""RH stock basket routes — Open House Singapore."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import require_auth, require_own_user
from services.basket_policy import build_basket_from_english, catalog
from services.liquidity_rails import liquidity_rails
from services.portfolio_tracker import PortfolioTracker
from services.rh_hold import FAUCET_URL, RhHoldService
from services.stock_registry import network_status

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


@router.post("/preview")
async def basket_preview(body: PreviewRequest):
    plan = build_basket_from_english(body.prompt, body.budget_usdc)
    return {"plan": plan.to_dict()}


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
    }
