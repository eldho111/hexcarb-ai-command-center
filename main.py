from __future__ import annotations
import os, json, time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm, HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt

# --- Config ---
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "admin123")
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8

# --- App ---
app = FastAPI(title="HEXCARB API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# --- In-memory stores (replace with DB later) ---
USERS: Dict[str, Dict[str, Any]] = {
    ADMIN_USER: {"username": ADMIN_USER, "password": ADMIN_PASS, "role": "admin"}
}
RECIPES: List[Dict[str, Any]] = []
DOCS: List[Dict[str, Any]] = []      # {id, name, content, ts}
EXPERIMENTS: List[Dict[str, Any]] = []
FUNDING: List[Dict[str, Any]] = [
    {"source": "KSUM Grant", "stage": "idea", "deadline": "2025-09-15", "fit": 0.85},
    {"source": "DST-SERB Seed", "stage": "prototype", "deadline": "2025-10-01", "fit": 0.78},
]
AUDIT_LOG: List[Dict[str, Any]] = []

# --- Models ---
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"

# --- Auth helpers ---
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")

def decode_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

security = HTTPBearer()

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(creds.credentials)
    username: str = payload.get("sub")
    role: str = payload.get("role", "user")
    user = USERS.get(username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"username": username, "role": role}

# --- Routes ---
@app.get("/")
async def root():
    return {"service": "hexcarb-api", "status": "ok"}

@app.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = USERS.get(form_data.username)
    if not user or user.get("password") != form_data.password:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    token = create_access_token({"sub": user["username"], "role": user["role"]})
    AUDIT_LOG.append({"ts": time.time(), "evt": "login", "user": user["username"]})
    return {"access_token": token, "role": user["role"], "token_type": "bearer"}

@app.get("/me")
async def me(user=Depends(get_current_user)):
    return user

@app.get("/kpis")
async def kpis(user=Depends(get_current_user)):
    return {
        "experiments_this_week": sum(1 for e in EXPERIMENTS if (time.time() - e.get("ts", 0)) < 7*86400),
        "documents_indexed": len(DOCS),
        "open_pos": 0,
        "funding_leads": len(FUNDING),
    }

# Knowledge
@app.get("/knowledge/search")
async def knowledge_search(q: str, user=Depends(get_current_user)):
    ql = q.lower()
    hits = []
    for d in DOCS:
        text = (d.get("content") or "").lower()
        if ql in text:
            snippet = text[:300] + ("..." if len(text) > 300 else "")
            hits.append({"title": d.get("name"), "snippet": snippet, "score": 1.0})
    return hits

@app.post("/knowledge/ingest")
async def knowledge_ingest(file: UploadFile = File(...), user=Depends(get_current_user)):
    raw = await file.read()
    content = raw[:200000].decode("utf-8", errors="ignore")  # naive text capture
    DOCS.append({"id": len(DOCS)+1, "name": file.filename, "content": content, "ts": time.time()})
    AUDIT_LOG.append({"ts": time.time(), "evt": "doc_ingest", "user": user["username"], "name": file.filename})
    return {"ok": True, "indexed": True, "name": file.filename}

# Market & funding
@app.get("/market/funding")
async def funding_list(user=Depends(get_current_user)):
    return FUNDING

# Operations
@app.post("/ops/vendor/checklist")
async def vendor_checklist(vendor: str = Form(...), country: str = Form("IN"), use_case: str = Form("general"), user=Depends(get_current_user)):
    checklist = [
        {"item": "GST registration / PAN verification", "status": "pending"},
        {"item": f"BIS/ISO compliance for {use_case}", "status": "pending"},
        {"item": f"Import/export docs ({country})", "status": "pending"},
        {"item": "Quality certificate & MSDS", "status": "pending"},
    ]
    AUDIT_LOG.append({"ts": time.time(), "evt": "vendor_checklist", "user": user["username"], "vendor": vendor})
    return {"vendor": vendor, "country": country, "use_case": use_case, "checklist": checklist}

# R&D
@app.post("/rnd/plan")
async def rnd_plan(payload: str = Form(...), user=Depends(get_current_user)):
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    data.update({"id": len(EXPERIMENTS)+1, "ts": time.time(), "owner": user["username"]})
    EXPERIMENTS.append(data)
    AUDIT_LOG.append({"ts": time.time(), "evt": "experiment_plan", "user": user["username"], "title": data.get("title")})
    return {"ok": True, "plan": data}

@app.get("/rnd/recipes")
async def recipes_list(user=Depends(get_current_user)):
    return RECIPES

@app.post("/rnd/recipes")
async def recipes_upload(file: UploadFile = File(...), user=Depends(get_current_user)):
    raw = await file.read()
    text = raw.decode("utf-8", errors="ignore")
    body: Dict[str, Any]
    try:
        if file.filename.endswith(".json"):
            body = json.loads(text)
        elif file.filename.endswith(".csv"):
            rows = [r.split(",") for r in text.splitlines() if r.strip()]
            body = {"csv": rows}
        else:
            body = {"text": text}
    except Exception:
        body = {"raw": text[:5000]}
    item = {"id": len(RECIPES)+1, "name": file.filename, "content": body, "ts": time.time()}
    RECIPES.append(item)
    AUDIT_LOG.append({"ts": time.time(), "evt": "recipe_upload", "user": user["username"], "name": file.filename})
    return {"ok": True, "recipe_id": item["id"], "name": file.filename}
