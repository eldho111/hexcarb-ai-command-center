import os
from datetime import datetime, timedelta
from typing import Callable

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlmodel import Session, select

from .db import get_session
from .models import RoleEnum, User

router = APIRouter(prefix="/auth")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_SECRET = os.environ["JWT_SECRET"]
TOKEN_HOURS = 12


def _create_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


@router.post("/login")
def login(
    response: Response,
    form: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    stmt = select(User).where(User.email == form.username)
    user = session.exec(stmt).first()
    if not user or not pwd_context.verify(form.password, user.password_hash) or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    user.last_login_at = datetime.utcnow()
    session.add(user)
    session.commit()
    token = _create_token(user)
    response.set_cookie(
        "hc_token",
        token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=TOKEN_HOURS * 3600,
    )
    return {"ok": True}


@router.post("/logout")
def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie("hc_token")
    return {"ok": True}


def current_user(
    hc_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> User:
    if not hc_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    try:
        payload = jwt.decode(hc_token, JWT_SECRET, algorithms=["HS256"])
        user_id = int(payload.get("sub", 0))
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    user = session.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return user


def require_role(role: str) -> Callable[[User], User]:
    def checker(user: User = Depends(current_user)) -> User:
        if user.role != role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user

    return checker
