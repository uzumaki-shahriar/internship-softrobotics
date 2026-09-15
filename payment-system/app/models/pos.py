from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlmodel import Field, SQLModel


class Pos(SQLModel, table=True):
    __tablename__ = "pos"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    bank_id: int = Field(foreign_key="banks.id")
    currency_id: int = Field(foreign_key="currencies.id")
    status: bool = Field(default=True)
    commission_percentage: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    commission_fixed: Decimal = Field(default=Decimal("0.00"), max_digits=10, decimal_places=2)
    bank_fee: Decimal = Field(default=Decimal("0.00"), max_digits=10, decimal_places=2)
    settlement_day: int = Field(default=0)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": datetime.utcnow},
    )
