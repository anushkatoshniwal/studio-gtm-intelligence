from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProductSignal(Base):
    __tablename__ = "product_signals"
    __table_args__ = (
        CheckConstraint(
            "segment IN ('creator', 'media_agency', 'enterprise', 'other')",
            name="ck_product_signals_segment",
        ),
        CheckConstraint(
            "strength BETWEEN 1 AND 5",
            name="ck_product_signals_strength",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    signal: Mapped[str] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    segment: Mapped[str] = mapped_column(String(50), default="other", server_default="other")
    signal_type: Mapped[str] = mapped_column(String(100), default="other", server_default="other")
    strength: Mapped[int] = mapped_column(Integer, default=3, server_default="3")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class CustomerSignal(Base):
    __tablename__ = "customer_signals"
    __table_args__ = (
        CheckConstraint(
            "segment IN ('creator', 'media_agency', 'enterprise', 'other')",
            name="ck_customer_signals_segment",
        ),
        CheckConstraint(
            "strength BETWEEN 1 AND 5",
            name="ck_customer_signals_strength",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    signal: Mapped[str] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    segment: Mapped[str] = mapped_column(String(50), default="other", server_default="other")
    signal_type: Mapped[str] = mapped_column(String(100), default="other", server_default="other")
    strength: Mapped[int] = mapped_column(Integer, default=3, server_default="3")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class MarketSignal(Base):
    __tablename__ = "market_signals"
    __table_args__ = (
        CheckConstraint(
            "segment IN ('creator', 'media_agency', 'enterprise', 'other')",
            name="ck_market_signals_segment",
        ),
        CheckConstraint(
            "strength BETWEEN 1 AND 5",
            name="ck_market_signals_strength",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    signal: Mapped[str] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    segment: Mapped[str] = mapped_column(String(50), default="other", server_default="other")
    signal_type: Mapped[str] = mapped_column(String(100), default="other", server_default="other")
    strength: Mapped[int] = mapped_column(Integer, default=3, server_default="3")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
