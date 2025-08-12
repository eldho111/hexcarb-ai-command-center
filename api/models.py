from datetime import datetime, date
from enum import Enum
from typing import Optional, Literal

from sqlmodel import SQLModel, Field

class Role(str, Enum):
    admin = "admin"
    manager = "manager"
    member = "member"

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    role: Role = Field(default=Role.member)
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Accounting
class TxType(str, Enum):
    income = "income"
    expense = "expense"

class Transaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: date = Field(default_factory=lambda: date.today())
    type: TxType
    amount: float
    note: Optional[str] = None

# HR
class Employee(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str
    role: str
    status: str = "active"
    joined_on: date = Field(default_factory=lambda: date.today())
    leave_balance: float = 0.0

# R&D
class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    owner: str
    status: str = "active"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Task(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    title: str
    state: Literal["todo", "doing", "done"] = "todo"
    assignee: str = ""
    due_date: Optional[date] = None
