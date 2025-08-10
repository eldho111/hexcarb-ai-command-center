from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel, Column
from sqlalchemy import Enum as SQLEnum


class RoleEnum(str, Enum):
    admin = "admin"
    ops = "ops"
    viewer = "viewer"


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    role: RoleEnum = Field(sa_column=Column(SQLEnum(RoleEnum, native_enum=False)))
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login_at: Optional[datetime] = None
