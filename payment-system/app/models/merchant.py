from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Merchant(SQLModel, table=True):
    __tablename__ = "merchants"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id")
    store_id: str = Field(unique=True, index=True)
    name: str
    email: str = Field(unique=True, index=True)
    address: Optional[str] = None
    status: bool = Field(default=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": datetime.utcnow},
    )
