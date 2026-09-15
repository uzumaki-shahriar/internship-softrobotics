from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Bank(SQLModel, table=True):
    __tablename__ = "banks"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    issuer_name: str
    api_url: Optional[str] = None
    user_name: str
    user_password: str
    status: bool = Field(default=True)
    code: Optional[str] = None
    branch: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": datetime.utcnow},
    )
