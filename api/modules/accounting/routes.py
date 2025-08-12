from typing import Dict, List
from fastapi import APIRouter, Depends, Header, HTTPException
from .models import Transaction

router = APIRouter()

# In-memory storage
_db: Dict[int, Transaction] = {}
_next_id = 1

def require_role(x_role: str = Header(...)):
    if x_role not in {"Admin", "Manager"}:
        raise HTTPException(status_code=403, detail="Forbidden")
    return x_role

@router.get("/", response_model=List[Transaction])
def list_transactions(role: str = Depends(require_role)):
    return list(_db.values())

@router.post("/", response_model=Transaction)
def create_transaction(tx: Transaction, role: str = Depends(require_role)):
    global _next_id
    tx.id = _next_id
    _db[_next_id] = tx
    _next_id += 1
    return tx

@router.get("/{tx_id}", response_model=Transaction)
def get_transaction(tx_id: int, role: str = Depends(require_role)):
    tx = _db.get(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Not found")
    return tx

@router.put("/{tx_id}", response_model=Transaction)
def update_transaction(tx_id: int, tx: Transaction, role: str = Depends(require_role)):
    if tx_id not in _db:
        raise HTTPException(status_code=404, detail="Not found")
    tx.id = tx_id
    _db[tx_id] = tx
    return tx

@router.delete("/{tx_id}")
def delete_transaction(tx_id: int, role: str = Depends(require_role)):
    if tx_id not in _db:
        raise HTTPException(status_code=404, detail="Not found")
    del _db[tx_id]
    return {"ok": True}
