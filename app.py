from __future__ import annotations
import os, json, base64, importlib
from typing import Any, Dict, Optional
import requests, streamlit as st

# ------------- Auth & API helpers (inline) -------------
def get_api_base_url() -> str:
    url = os.getenv("API_BASE_URL") or "http://127.0.0.1:8000"
    return url.rstrip("/")

def _decode_jwt_noverify(token: str) -> Dict[str, Any]:
    try:
        parts = token.split(".")
        if len(parts) < 2: return {}
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = base64.urlsafe_b64decode(payload_b64.encode("utf-8")).decode("utf-8")
        return json.loads(payload)
    except Exception:
        return {}

def api_headers() -> Dict[str, str]:
    t = st.session_state.get("token")
    return {"Authorization": f"Bearer {t}"} if t else {}

def _full_url(path: str) -> str:
    if not path.startswith("/"): path = "/" + path
    return f"{get_api_base_url()}{path}"

def api_get(path: str, params: Optional[Dict[str, Any]] = None, timeout: int = 15):
    try:
        r = requests.get(_full_url(path), headers=api_headers(), params=params, timeout=timeout)
        if r.status_code == 401:
            st.toast("Session expired. Please log in again."); st.session_state.clear(); st.rerun()
        r.raise_for_status(); return r.json()
    except requests.RequestException as e:
        st.info(f"⚠️ GET {path} failed: {e}"); return None

def api_post(path: str, data: Optional[Dict[str, Any]] = None, files: Optional[Dict[str, Any]] = None, timeout: int = 30):
    try:
        r = requests.post(_full_url(path), headers=api_headers(), data=data, files=files, timeout=timeout)
        if r.status_code == 401:
            st.toast("Session expired. Please log in again."); st.session_state.clear(); st.rerun()
        r.raise_for_status(); return r.json()
    except requests.RequestException as e:
        st.info(f"⚠️ POST {path} failed: {e}"); return None

def render_login_sidebar() -> bool:
    st.header("Access")
    token = st.session_state.get("token")
    if not token:
        with st.form("login_form", clear_on_submit=False):
            u = st.text_input("Username")
            p = st.text_input("Password", type="password")
            ok = st.form_submit_button("Sign in")
        if ok:
            try:
                r = requests.post(_full_url("/login"), data={"username": u, "password": p}, timeout=15)
                if r.status_code == 200:
                    data = r.json()
                    st.session_state.token = data.get("access_token")
                    st.session_state.role  = data.get("role", "user")
                    st.success("Signed in."); st.rerun()
                else:
                    st.error("Login failed. Check credentials.")
            except requests.RequestException as e:
                st.error(f"Login endpoint unavailable: {e}")
        return False
    claims = _decode_jwt_noverify(token)
    role = st.session_state.get("role") or claims.get("role") or "user"
    st.write(f"**User:** {claims.get('sub','unknown')}  \n**Role:** {role}")
    if st.button("Sign out"): st.session_state.clear(); st.rerun()
    return True

def current_role() -> str:
    token = st.session_state.get("token") or ""
    try:
        parts = token.split("."); 
        if len(parts) < 2: return "user"
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = base64.urlsafe_b64decode(payload_b64.encode("utf-8")).decode("utf-8")
        return (json.loads(payload).get("role") or "user")
    except Exception:
        return "user"

# ------------- App Shell -------------
APP_NAME = os.getenv("APP_NAME", "HEXCARB AI Engine")
st.set_page_config(page_title=APP_NAME, page_icon="🧠", layout="wide")
st.markdown(f"<h1 style='margin-bottom:0'>{APP_NAME}</h1>", unsafe_allow_html=True)
st.caption("Login required. After sign-in, tabs are lazily loaded (no startup freezes).")

with st.sidebar:
    logged_in = render_login_sidebar()
if not logged_in:
    st.info("Please sign in from the left sidebar to continue.")
    st.stop()

# KPI cards (proves API/auth)
kpis = api_get("/kpis") or {}
c1, c2, c3, c4 = st.columns(4)
c1.metric("Experiments (7d)", kpis.get("experiments_this_week", 0))
c2.metric("Docs Indexed",     kpis.get("documents_indexed", 0))
c3.metric("Open Action Items",kpis.get("open_pos", 0))
c4.metric("Funding Leads",    kpis.get("funding_leads", 0))

st.divider()

# Safe module loader
def safe_render(module_name: str):
    try:
        mod = importlib.import_module(f"modules.{module_name}")
    except Exception as e:
        st.warning(f"Module `{module_name}` failed to import: {e}")
        return
    render_fn = getattr(mod, "render", None) or getattr(mod, "main", None)
    if callable(render_fn):
        try:
            render_fn()
        except Exception as e:
            st.error(f"Error in `{module_name}`: {e}")
    else:
        st.info(f"`{module_name}` has no render()/main().")

# Tabs (all present but each tab’s content is lazy & safe)
tabs = st.tabs(["Chat","R&D","Knowledge","Procurement","Accounting","HR","Settings"])
with tabs[0]: safe_render("chat_tab")
with tabs[1]: safe_render("rd_tab")
with tabs[2]: safe_render("knowledge_tab")
with tabs[3]: safe_render("proc_tab")
with tabs[4]: safe_render("accounting_tab")
with tabs[5]: safe_render("hr_tab")
with tabs[6]: safe_render("settings_tab")