import os
import secrets
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.routing import APIRouter

app = FastAPI()

# Public endpoint
@app.get("/health")
async def health():
    return {"status": "ok"}

security = HTTPBasic()

def verify_credentials(credentials: HTTPBasicCredentials = Depends(security)):
    username = os.environ.get("ADMIN_USER", "")
    password = os.environ.get("ADMIN_PASS", "")
    is_valid_user = secrets.compare_digest(credentials.username, username)
    is_valid_pass = secrets.compare_digest(credentials.password, password)
    if not (is_valid_user and is_valid_pass):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
            headers={"WWW-Authenticate": "Basic"},
        )

secure_router = APIRouter(prefix="/secure", dependencies=[Depends(verify_credentials)])

@secure_router.get("/ping")
async def secure_ping():
    return {"ok": True}

app.include_router(secure_router)
