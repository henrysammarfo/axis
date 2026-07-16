"""SQLAlchemy ORM models for AXIS portfolio state."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ua_address: Mapped[str | None] = mapped_column(String(42), nullable=True, unique=True, index=True)
    sra_address: Mapped[str | None] = mapped_column(String(42), nullable=True)
    eip7702_tx_hash: Mapped[str | None] = mapped_column(String(66), nullable=True)
    eip7702_delegated: Mapped[bool] = mapped_column(default=False)
    risk_level: Mapped[str] = mapped_column(String(32), default="moderate")
    goal: Mapped[str] = mapped_column(String(255), default="maximize yield")
    budget_usdc: Mapped[float] = mapped_column(Float, default=0.0)
    active: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    protocol: Mapped[str] = mapped_column(String(32))
    asset: Mapped[str] = mapped_column(String(32))
    amount_usdc: Mapped[float] = mapped_column(Float)
    estimated_apy: Mapped[float] = mapped_column(Float, default=0.0)
    tx_hash: Mapped[str | None] = mapped_column(String(66), nullable=True)
    chain: Mapped[str] = mapped_column(String(32), default="arbitrum")
    status: Mapped[str] = mapped_column(String(32), default="open")
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ActionLog(Base):
    __tablename__ = "action_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    tool: Mapped[str] = mapped_column(String(64))
    action_input: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict] = mapped_column(JSON)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class X402Spend(Base):
    __tablename__ = "x402_spends"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    amount_usdc: Mapped[float] = mapped_column(Float)
    query: Mapped[str] = mapped_column(Text)
    paid: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
