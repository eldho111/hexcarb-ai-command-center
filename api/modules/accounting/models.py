from datetime import date
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

class TransactionType(str, Enum):
    income = "income"
    expense = "expense"

class Transaction(BaseModel):
    id: Optional[int] = None
    date: date
    type: TransactionType
    amount: float = Field(..., ge=0)
    note: str = ""
