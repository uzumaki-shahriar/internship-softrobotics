from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlmodel import Field, SQLModel


class Wallet(SQLModel, table=True):
    __tablename__ = "wallets"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id")
    currency_id: int = Field(foreign_key="currencies.id")
    amount: Decimal = Field(default=Decimal("0.00"), max_digits=15, decimal_places=2)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": datetime.utcnow},
    )
