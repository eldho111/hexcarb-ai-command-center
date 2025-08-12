from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status

from .models import Employee

router = APIRouter(prefix="/employees", tags=["employees"])

# simple in-memory store for demo purposes
_db: List[Employee] = []


def get_role(x_role: str = Header(...)) -> str:
    return x_role


def admin_or_manager(role: str = Depends(get_role)) -> None:
    if role not in {"Admin", "Manager"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Manager access required",
        )


@router.get("/", response_model=List[Employee], dependencies=[Depends(admin_or_manager)])
def list_employees(q: Optional[str] = None) -> List[Employee]:
    if q:
        q_lower = q.lower()
        return [e for e in _db if q_lower in e.name.lower() or q_lower in e.email.lower()]
    return _db


@router.post(
    "/", response_model=Employee, status_code=status.HTTP_201_CREATED, dependencies=[Depends(admin_or_manager)]
)
def create_employee(emp: Employee) -> Employee:
    if any(e.id == emp.id for e in _db):
        raise HTTPException(status_code=400, detail="Employee ID already exists")
    _db.append(emp)
    return emp


@router.get("/{emp_id}", response_model=Employee, dependencies=[Depends(admin_or_manager)])
def get_employee(emp_id: int) -> Employee:
    for e in _db:
        if e.id == emp_id:
            return e
    raise HTTPException(status_code=404, detail="Employee not found")


@router.put("/{emp_id}", response_model=Employee, dependencies=[Depends(admin_or_manager)])
def update_employee(emp_id: int, emp: Employee) -> Employee:
    for i, e in enumerate(_db):
        if e.id == emp_id:
            _db[i] = emp
            return emp
    raise HTTPException(status_code=404, detail="Employee not found")


@router.delete("/{emp_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(admin_or_manager)])
def delete_employee(emp_id: int) -> None:
    for i, e in enumerate(_db):
        if e.id == emp_id:
            _db.pop(i)
            return
    raise HTTPException(status_code=404, detail="Employee not found")
