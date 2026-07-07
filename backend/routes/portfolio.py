"""Portfolio and position routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from services.portfolio_tracker import PortfolioTracker
from services.yield_fetcher import YieldFetcher

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("/positions/{user_id}")
async def get_positions(user_id: str, db: AsyncSession = Depends(get_db)):
    tracker = PortfolioTracker(db)
    return {"positions": await tracker.get_positions(user_id)}


@router.get("/history/{user_id}")
async def get_history(user_id: str, db: AsyncSession = Depends(get_db)):
    tracker = PortfolioTracker(db)
    return {"actions": await tracker.get_weekly_actions(user_id)}


@router.get("/yields/aave/{asset}")
async def aave_yield(asset: str):
    fetcher = YieldFetcher()
    return await fetcher.get_aave_apy(asset)


@router.get("/yields/gmx")
async def gmx_yield():
    fetcher = YieldFetcher()
    return await fetcher.get_gmx_apy()


@router.get("/yields/uniswap")
async def uniswap_yield(token0: str = "USDC", token1: str = "ETH", fee_tier: int = 3000):
    fetcher = YieldFetcher()
    return await fetcher.get_uniswap_apy(token0, token1, fee_tier)
