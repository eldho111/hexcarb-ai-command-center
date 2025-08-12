import os
from typing import List
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from .db import init_db
from .auth import router as auth_router
from .modules.accounting.routes import router as accounting_router
from .modules.hr.routes import router as hr_router
from .modules.rd.routes import router as rd_router

def get_allowed_origins() -> List[str]:
    raw = os.getenv("ALLOWED_ORIGINS")
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    return ["https://hexcarb.in", "https://ai.hexcarb.in", "http://localhost:8000"]

class HTTPSRedirectIfForwarded(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.headers.get("x-forwarded-proto", "http") == "http" and os.getenv("FORCE_HTTPS", "true").lower() == "true":
            # Let Heroku handle HTTPS; typically not rewriting URLs here
            pass
        return await call_next(request)

app = FastAPI(title="HexCarb AI Command Center")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(HTTPSRedirectIfForwarded)

@app.on_event("startup")
def on_startup():
    init_db()

app.include_router(auth_router)
app.include_router(accounting_router)
app.include_router(hr_router)
app.include_router(rd_router)

@app.get("/secure/ping")
def secure_ping():
    return {"ok": True}
