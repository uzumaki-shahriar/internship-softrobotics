from datetime import datetime, date
from decimal import Decimal
from typing import Optional

from sqlmodel import Field, SQLModel


class SettlementStatus(str):
    Pending = "pending"
    Settled = "settled"
    Failed = "failed"


class Settlement(SQLModel, table=True):
    __tablename__ = "settlements"

    id: Optional[int] = Field(default=None, primary_key=True)
    merchant_id: int = Field(foreign_key="merchants.id")
    currency_id: int = Field(foreign_key="currencies.id")
    gross_total: Decimal = Field(default=Decimal("0.00"), max_digits=15, decimal_places=2)
    fee_total: Decimal = Field(default=Decimal("0.00"), max_digits=15, decimal_places=2)
    net_total: Decimal = Field(default=Decimal("0.00"), max_digits=15, decimal_places=2)
    status: str = Field(default=SettlementStatus.Pending)
    scheduled_at: datetime = Field(default_factory=datetime.utcnow)
    settled_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": datetime.utcnow},
    )


class SettlementItem(SQLModel, table=True):
    __tablename__ = "settlement_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    settlement_id: int = Field(foreign_key="settlements.id")
    transaction_id: int = Field(foreign_key="transactions.id", unique=True)
    gross: Decimal = Field(default=Decimal("0.00"), max_digits=15, decimal_places=2)
    fee: Decimal = Field(default=Decimal("0.00"), max_digits=15, decimal_places=2)
    net: Decimal = Field(default=Decimal("0.00"), max_digits=15, decimal_places=2)

    created_at: datetime = Field(default_factory=datetime.utcnow)
