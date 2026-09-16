from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlmodel import Field, SQLModel

from app.models.transaction import TransactionState


class Refund(SQLModel, table=True):
    __tablename__ = "refunds"

    id: Optional[int] = Field(default=None, primary_key=True)
    transaction_id: int = Field(foreign_key="transactions.id")
    invoice_id: str = Field(index=True)
    transaction_state: TransactionState
    amount: Decimal = Field(max_digits=15, decimal_places=2)
    idempotency_key: str = Field(unique=True, index=True)
    bank_reference: Optional[str] = Field(default=None, index=True)
    decline_reason: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": datetime.utcnow},
    )
