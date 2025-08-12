from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from ...db import get_session
from ...models import Transaction, Role
from ...auth import require_roles, get_current_user

router = APIRouter(prefix="/api/accounting", tags=["accounting"])

@router.get("/", response_model=List[Transaction])
def list_tx(session: Session = Depends(get_session), user=Depends(get_current_user)):
    return session.exec(select(Transaction)).all()

@router.post("/", response_model=Transaction, dependencies=[Depends(require_roles([Role.admin, Role.manager]))])
def create_tx(tx: Transaction, session: Session = Depends(get_session)):
    session.add(tx)
    session.commit()
    session.refresh(tx)
    return tx

@router.put("/{tx_id}", response_model=Transaction, dependencies=[Depends(require_roles([Role.admin, Role.manager]))])
def update_tx(tx_id: int, tx: Transaction, session: Session = Depends(get_session)):
    cur = session.get(Transaction, tx_id)
    if not cur:
        raise HTTPException(404, "Not found")
    for k, v in tx.dict(exclude_unset=True).items():
        setattr(cur, k, v)
    session.add(cur)
    session.commit()
    session.refresh(cur)
    return cur

@router.delete("/{tx_id}", dependencies=[Depends(require_roles([Role.admin, Role.manager]))])
def delete_tx(tx_id: int, session: Session = Depends(get_session)):
    cur = session.get(Transaction, tx_id)
    if not cur:
        raise HTTPException(404, "Not found")
    session.delete(cur)
    session.commit()
    return {"ok": True}
