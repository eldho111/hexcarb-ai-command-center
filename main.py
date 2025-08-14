from __future__ import annotations
import os, io, time, json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import jwt
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# -------------------------------------------------
# Config from env
# -------------------------------------------------
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "admin123")

ACCESS_TOKEN_EXPIRE_SECONDS = int(os.getenv("ACCESS_TOKEN_EXPIRE_SECONDS", "60"))  # 60s default
RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "90"))
RATE_LIMIT_BURST   = int(os.getenv("RATE_LIMIT_BURST", "30"))

UI_ORIGINS = [o.strip() for o in os.getenv("UI_ORIGINS", "*").split(",") if o.strip()]

# -------------------------------------------------
# App + CORS
# -------------------------------------------------
app = FastAPI(title="HEXCARB API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=UI_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET","POST","OPTIONS"],
    allow_headers=["Authorization","Content-Type","Accept","X-Requested-With"],
    expose_headers=["Authorization"],
    max_age=600,
)

# -------------------------------------------------
# Minimal stores (MVP in-memory)
# -------------------------------------------------
USERS: Dict[str, Dict[str, Any]] = {
    ADMIN_USER: {"username": ADMIN_USER, "password": ADMIN_PASS, "role": "admin"}
}

RECIPES: List[Dict[str, Any]] = []
KNOWLEDGE: List[Dict[str, Any]] = []

# Some sample data for KPIs/funding
FUNDING = [{"source": "KSUM", "amount": 10000}, {"source": "Angel", "amount": 25000}]

# -------------------------------------------------
# Rate limiter (best-effort, per instance)
# -------------------------------------------------
from collections import deque, defaultdict

class RateLimiter(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.hits = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        ip = (request.client.host if request.client else "unknown") or "unknown"
        now = time.time()
        window = 60.0  # seconds

        dq = self.hits[ip]
        dq.append(now)
        # prune old
        while dq and now - dq[0] > window:
            dq.popleft()

        if len(dq) > (RATE_LIMIT_PER_MIN + RATE_LIMIT_BURST):
            return JSONResponse({"detail": "Too Many Requests"}, status_code=429)

        return await call_next(request)

app.add_middleware(RateLimiter)

# -------------------------------------------------
# JWT helpers
# -------------------------------------------------
def create_access_token(sub: str, role: str) -> str:
    payload = {"sub": sub, "role": role, "exp": datetime.utcnow() + timedelta(seconds=ACCESS_TOKEN_EXPIRE_SECONDS)}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def decode_access_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(authorization: str = Header(default="")) -> Dict[str, Any]:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    claims = decode_access_token(token)
    username = claims.get("sub")
    role = claims.get("role", "user")
    user = USERS.get(username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"username": username, "role": role}

# -------------------------------------------------
# Endpoints
# -------------------------------------------------
@app.get("/")
def health():
    return {"service": "hexcarb-api", "status": "ok"}

@app.post("/login")
def login(username: str = Form(...), password: str = Form(...)):
    user = USERS.get(username)
    if not user or user["password"] != password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user["username"], user.get("role", "user"))
    return {"access_token": token, "token_type": "bearer", "role": user.get("role", "user")}

@app.post("/refresh")
def refresh_token(authorization: str = Header(default="")):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    old = authorization.split(" ", 1)[1]
    try:
        claims = jwt.decode(old, SECRET_KEY, algorithms=["HS256"], options={"verify_exp": False})
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    username = claims.get("sub")
    role = claims.get("role", "user")
    if not username or username not in USERS:
        raise HTTPException(status_code=401, detail="User not found")
    new_token = create_access_token(username, role)
    return {"access_token": new_token, "token_type": "bearer", "role": role}

@app.get("/kpis")
def kpis(user=Depends(get_current_user)):
    return {
        "experiments_this_week": 0,
        "documents_indexed": len(KNOWLEDGE),
        "open_pos": 0,
        "funding_leads": len(FUNDING),
    }

# ---- Knowledge ----
@app.post("/knowledge/ingest")
def knowledge_ingest(file: UploadFile = File(...), user=Depends(get_current_user)):
    try:
        text = file.file.read().decode("utf-8", errors="ignore")
    except Exception:
        text = ""
    item = {"id": str(int(time.time() * 1000)), "name": file.filename or "untitled.txt", "text": text}
    KNOWLEDGE.append(item)
    return {"ok": True, "id": item["id"], "name": item["name"], "len": len(text)}

@app.get("/knowledge/search")
def knowledge_search(q: str, user=Depends(get_current_user)):
    ql = (q or "").lower()
    hits: List[Dict[str, Any]] = []
    for it in KNOWLEDGE:
        t = it.get("text", "")
        i = t.lower().find(ql)
        if i >= 0:
            start = max(0, i - 60); end = min(len(t), i + 60)
            hits.append({"title": it.get("name", "(untitled)"), "snippet": t[start:end]})
    return hits

# ---- Procurement demo ----
@app.post("/ops/vendor/checklist")
def vendor_checklist(vendor: str = Form(...), country: str = Form("IN"), use_case: str = Form("general"), user=Depends(get_current_user)):
    checklist = [
        {"item": "GST & PAN verification"},
        {"item": "Vendor onboarding form"},
        {"item": "Compliance: MSDS (if chemicals)"},
        {"item": "Payment terms & bank details verification"},
    ]
    return {"vendor": vendor, "country": country, "use_case": use_case, "checklist": checklist, "ts": int(time.time())}

# ---- R&D stubs ----



@app.post("/admin/users")
def admin_add_user(username: str = Form(...), password: str = Form(...), role: str = Form("user"), user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    USERS[username] = {"username": username, "password": password, "role": role}
    return {"ok": True, "username": username, "role": role}


# ------------- R&D: Experiments & Results (in-memory MVP) -------------
EXPERIMENTS: Dict[str, Dict[str, Any]] = {}  # id -> {id,title,objective,params,status,ts}
RESULTS: List[Dict[str, Any]] = []           # [{exp_id,name,bytes/text,ts}]

def _mk_id() -> str:
    return str(int(time.time() * 1000))

@app.post("/rnd/experiments/create")
def rnd_create_experiment(payload: str = Form(...), user=Depends(get_current_user)):
    try:
        data = json.loads(payload)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON in payload")
    title = data.get("title") or "Untitled"
    exp_id = _mk_id()
    EXPERIMENTS[exp_id] = {
        "id": exp_id,
        "title": title,
        "objective": data.get("objective",""),
        "params": data.get("params",{}),
        "status": "planned",
        "ts": int(time.time()),
    }
    return {"ok": True, "experiment": EXPERIMENTS[exp_id]}

@app.get("/rnd/experiments")
def rnd_list_experiments(user=Depends(get_current_user)):
    # newest first
    return sorted(EXPERIMENTS.values(), key=lambda x: x["ts"], reverse=True)

@app.post("/rnd/experiments/status")
def rnd_update_status(exp_id: str = Form(...), status: str = Form(...), user=Depends(get_current_user)):
    if exp_id not in EXPERIMENTS:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if status not in {"planned","running","paused","completed","failed"}:
        raise HTTPException(status_code=400, detail="Invalid status")
    EXPERIMENTS[exp_id]["status"] = status
    return {"ok": True, "experiment": EXPERIMENTS[exp_id]}

@app.post("/rnd/results/upload")
def rnd_results_upload(exp_id: str = Form(...), file: UploadFile = File(...), user=Depends(get_current_user)):
    if exp_id not in EXPERIMENTS:
        raise HTTPException(status_code=404, detail="Experiment not found")
    content = file.file.read()
    item = {"exp_id": exp_id, "name": file.filename or "result.bin", "ts": int(time.time())}
    try:
        # Try store as text if decodable (handy for CSV/TXT)
        item["text"] = content.decode("utf-8", errors="ignore")[:200000]
    except Exception:
        item["bytes"] = len(content)
    RESULTS.append(item)
    return {"ok": True, "result": item}

@app.get("/rnd/results")
def rnd_results(exp_id: Optional[str] = None, user=Depends(get_current_user)):
    rows = [r for r in RESULTS if (not exp_id or r["exp_id"] == exp_id)]
    rows.sort(key=lambda x: x["ts"], reverse=True)
    return rows


# ------------- Procurement (in-memory MVP) -------------
VENDORS: Dict[str, Dict[str, Any]] = VENDORS if 'VENDORS' in globals() else {}
RFQS: List[Dict[str, Any]] = RFQS if 'RFQS' in globals() else []

def _now_id() -> str:
    return str(int(time.time() * 1000))

@app.post("/ops/vendors/create")
def vendors_create(name: str = Form(...), country: str = Form("IN"), rating: int = Form(3), user=Depends(get_current_user)):
    vid = _now_id()
    VENDORS[vid] = {"id": vid, "name": name.strip(), "country": country.strip(), "rating": int(rating), "ts": int(time.time())}
    return {"ok": True, "vendor": VENDORS[vid]}

@app.get("/ops/vendors")
def vendors_list(user=Depends(get_current_user)):
    return sorted(VENDORS.values(), key=lambda x: x["ts"], reverse=True)

@app.post("/ops/rfq/create")
def rfq_create(vendor_id: str = Form(...), item: str = Form(...), qty: int = Form(...), currency: str = Form("INR"), user=Depends(get_current_user)):
    if vendor_id not in VENDORS:
        raise HTTPException(status_code=404, detail="Vendor not found")
    rid = _now_id()
    row = {
        "id": rid, "vendor_id": vendor_id, "vendor": VENDORS[vendor_id]["name"],
        "item": item.strip(), "qty": int(qty), "currency": currency.strip(),
        "status": "draft", "ts": int(time.time())
    }
    RFQS.append(row)
    return {"ok": True, "rfq": row}

@app.get("/ops/rfq")
def rfq_list(user=Depends(get_current_user)):
    return sorted(RFQS, key=lambda x: x["ts"], reverse=True)

@app.post("/ops/rfq/quote")
def rfq_quote(rfq_id: str = Form(...), price: float = Form(...), lead_time_days: int = Form(...), user=Depends(get_current_user)):
    for r in RFQS:
        if r["id"] == rfq_id:
            r["price"] = float(price)
            r["lead_time_days"] = int(lead_time_days)
            r["status"] = "quoted"
            return {"ok": True, "rfq": r}
    raise HTTPException(status_code=404, detail="RFQ not found")

@app.post("/ops/rfq/choose")
def rfq_choose(rfq_id: str = Form(...), approve: bool = Form(...), user=Depends(get_current_user)):
    for r in RFQS:
        if r["id"] == rfq_id:
            r["status"] = "approved" if approve else "rejected"
            r["decision_ts"] = int(time.time())
            return {"ok": True, "rfq": r}
    raise HTTPException(status_code=404, detail="RFQ not found")


# ---------------- Accounting (in-memory MVP) ----------------
LEDGER = LEDGER if 'LEDGER' in globals() else []  # list of {date, description, amount, type, ts}

@app.post("/acct/ingest_csv")
def acct_ingest_csv(file: UploadFile = File(...), user=Depends(get_current_user)):
    import csv, io, time
    try:
        raw = file.file.read()
        txt = raw.decode("utf-8", errors="ignore")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read file")

    reader = csv.DictReader(io.StringIO(txt))
    added = 0
    for row in reader:
        # Normalize keys
        r = {k.lower().strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
        date = r.get("date") or ""
        desc = r.get("description") or r.get("desc") or ""
        try:
            amount = float(r.get("amount", 0) or 0)
        except Exception:
            amount = 0.0
        typ = (r.get("type") or "").lower()
        if typ not in ("income", "expense"):
            # guess by sign if missing
            typ = "income" if amount >= 0 else "expense"
        LEDGER.append({"date": date, "description": desc, "amount": amount, "type": typ, "ts": int(time.time())})
        added += 1
    return {"ok": True, "rows_added": added, "total_rows": len(LEDGER)}

@app.get("/acct/ledgers")
def acct_ledgers(user=Depends(get_current_user)):
    # newest first
    return sorted(LEDGER, key=lambda x: x.get("ts", 0), reverse=True)

@app.get("/accounting/kpis")
def accounting_kpis(user=Depends(get_current_user)):
    income = sum(x["amount"] for x in LEDGER if x.get("type") == "income")
    expense = sum(x["amount"] for x in LEDGER if x.get("type") == "expense")
    net = income - expense
    return {"income": income, "expense": expense, "net": net, "rows": len(LEDGER)}

