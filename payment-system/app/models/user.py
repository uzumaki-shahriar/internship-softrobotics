from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class UserType(str, Enum):
    admin = "admin"
    merchant = "merchant"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    user_type: UserType
    status: bool = Field(default=True)
    email: str = Field(unique=True, index=True)
    password: str  # bcrypt hash, see app.core.security

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": datetime.utcnow},
    )
