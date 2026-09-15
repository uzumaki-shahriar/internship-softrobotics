from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class TransactionState(str, Enum):
    Pending = "Pending"
    Completed = "Completed"
    Failed = "Failed"
    Refunded = "Refunded"
    Partial_Refunded = "Partial Refunded"


class Transaction(SQLModel, table=True):
    __tablename__ = "transactions"

    id: Optional[int] = Field(default=None, primary_key=True)
    invoice_id: str = Field(index=True)
    order_id: str = Field(index=True)
    transaction_state: TransactionState = Field(default=TransactionState.Pending)
    gross: Decimal = Field(max_digits=15, decimal_places=2)
    net: Decimal = Field(default=Decimal("0.00"), max_digits=15, decimal_places=2)
    fee: Decimal = Field(default=Decimal("0.00"), max_digits=15, decimal_places=2)
    refunded_amount: Decimal = Field(default=Decimal("0.00"), max_digits=15, decimal_places=2)
    pos_id: int = Field(foreign_key="pos.id")
    currency_id: int = Field(foreign_key="currencies.id")
    merchant_id: int = Field(foreign_key="merchants.id")
    settlement_date: Optional[date] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": datetime.utcnow},
    )
