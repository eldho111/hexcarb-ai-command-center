from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from ...db import get_session
from ...models import Employee, Role
from ...auth import require_roles, get_current_user

router = APIRouter(prefix="/api/hr", tags=["hr"])

@router.get("/", response_model=List[Employee])
def list_employees(session: Session = Depends(get_session), user=Depends(get_current_user)):
    return session.exec(select(Employee)).all()

@router.post("/", response_model=Employee, dependencies=[Depends(require_roles([Role.admin, Role.manager]))])
def create_employee(emp: Employee, session: Session = Depends(get_session)):
    session.add(emp)
    session.commit()
    session.refresh(emp)
    return emp

@router.put("/{emp_id}", response_model=Employee, dependencies=[Depends(require_roles([Role.admin, Role.manager]))])
def update_employee(emp_id: int, emp: Employee, session: Session = Depends(get_session)):
    cur = session.get(Employee, emp_id)
    if not cur:
        raise HTTPException(404, "Not found")
    for k, v in emp.dict(exclude_unset=True).items():
        setattr(cur, k, v)
    session.add(cur)
    session.commit()
    session.refresh(cur)
    return cur

@router.delete("/{emp_id}", dependencies=[Depends(require_roles([Role.admin, Role.manager]))])
def delete_employee(emp_id: int, session: Session = Depends(get_session)):
    cur = session.get(Employee, emp_id)
    if not cur:
        raise HTTPException(404, "Not found")
    session.delete(cur)
    session.commit()
    return {"ok": True}
