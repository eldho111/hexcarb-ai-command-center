from fastapi import APIRouter, Depends

from .auth import current_user, require_role
from .models import User

router = APIRouter(prefix="/secure")


@router.get("/ping")
def ping(user: User = Depends(current_user)) -> dict[str, bool]:
    return {"ok": True}


@router.get("/admin-only")
def admin_only(user: User = Depends(require_role("admin"))) -> dict[str, bool]:
    return {"ok": True}
