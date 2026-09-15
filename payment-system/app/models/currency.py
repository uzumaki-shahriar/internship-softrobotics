from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Currency(SQLModel, table=True):
    __tablename__ = "currencies"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    symbol: str = Field(max_length=10)
    code: str = Field(max_length=5, unique=True, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": datetime.utcnow},
    )
