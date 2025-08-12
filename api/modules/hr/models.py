from datetime import date
from pydantic import BaseModel, EmailStr


class Employee(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    status: str
    joined_on: date
    leave_balance: float
