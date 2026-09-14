"""SQLAlchemy ORM models for AXIS portfolio state."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    # Magic issuer can exceed 64 chars (did:ethr:0x… / longer DIDs). Keep wide.
    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ua_address: Mapped[str | None] = mapped_column(String(42), nullable=True, unique=True, index=True)
    sra_address: Mapped[str | None] = mapped_column(String(42), nullable=True)
    eip7702_tx_hash: Mapped[str | None] = mapped_column(String(66), nullable=True)
    eip7702_delegated: Mapped[bool] = mapped_column(default=False)
    risk_level: Mapped[str] = mapped_column(String(32), default="moderate")
    goal: Mapped[str] = mapped_column(String(255), default="maximize yield")
    budget_usdc: Mapped[float] = mapped_column(Float, default=0.0)
    active: Mapped[bool] = mapped_column(default=False)
    # Autonomous agent: policy-bounded ZeroDev session key approval (serialized).
    session_key_approval: Mapped[str | None] = mapped_column(Text, nullable=True)
    session_key_signer: Mapped[str | None] = mapped_column(String(42), nullable=True)
    session_active: Mapped[bool] = mapped_column(default=False)
    # Power-user custom strategy (allowlisted legs + weights), JSON-encoded.
    custom_strategy: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # One-time explicit consent for market-risk positions (Uniswap V3 LP).
    market_risk_consent: Mapped[bool] = mapped_column(default=False)
    # Profile (syncs across devices): display name + avatar. Avatar is either an
    # AXIS avatar id (e.g. "axis-03") or an uploaded image data URL, so use Text.
    display_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    avatar: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Open House: saved RH stock-token basket (English prefs → weights).
    stock_basket: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Open House: RH testnet hold evidence (txs + balances snapshot).
    rh_holds: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(255), index=True)
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
    user_id: Mapped[str] = mapped_column(String(255), index=True)
    tool: Mapped[str] = mapped_column(String(64))
    action_input: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict] = mapped_column(JSON)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class X402Spend(Base):
    __tablename__ = "x402_spends"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(255), index=True)
    amount_usdc: Mapped[float] = mapped_column(Float)
    query: Mapped[str] = mapped_column(Text)
    paid: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
