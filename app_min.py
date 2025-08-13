from __future__ import annotations
import os, json, base64
from typing import Any, Dict, Optional
import requests
import streamlit as st

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

def _full_url(path: str) -> str:
    base = get_api_base_url()
    if not path.startswith("/"): path = "/" + path
    return f"{base}{path}"

def api_headers() -> Dict[str, str]:
    token = st.session_state.get("token")
    return {"Authorization": f"Bearer {token}"} if token else {}

def api_get(path: str):
    try:
        r = requests.get(_full_url(path), headers=api_headers(), timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        st.error(f"GET {path} failed: {e}")
        return None

def render_login_sidebar() -> bool:
    st.header("Access")
    token = st.session_state.get("token")
    if not token:
        with st.form("login_form", clear_on_submit=False):
            username = st.text_input("Username")
            password = st.text_input("Password", type="password")
            submitted = st.form_submit_button("Sign in")
        if submitted:
            try:
                r = requests.post(_full_url("/login"),
                                  data={"username": username, "password": password},
                                  timeout=10)
                if r.status_code == 200:
                    data = r.json()
                    st.session_state.token = data.get("access_token")
                    st.session_state.role = data.get("role", "user")
                    st.success("Signed in."); st.rerun()
                else:
                    st.error("Login failed.")
            except Exception as e:
                st.error(f"Login endpoint unavailable: {e}")
        return False
    claims = _decode_jwt_noverify(token)
    role = st.session_state.get("role") or claims.get("role") or "user"
    user = claims.get("sub","unknown")
    st.write(f"**User:** {user}  \n**Role:** {role}")
    if st.button("Sign out"): st.session_state.clear(); st.rerun()
    return True

APP_NAME = os.getenv("APP_NAME", "HEXCARB AI Engine – Safe")
st.set_page_config(page_title=APP_NAME, page_icon="🧠", layout="wide")
st.title(APP_NAME)
st.caption("Safe mode: login + KPI ping only.")

with st.sidebar:
    logged_in = render_login_sidebar()

if not logged_in:
    st.stop()

st.write("Pinging /kpis …")
kpis = api_get("/kpis") or {}
c1, c2, c3, c4 = st.columns(4)
c1.metric("Experiments (7d)", kpis.get("experiments_this_week", 0))
c2.metric("Docs Indexed", kpis.get("documents_indexed", 0))
c3.metric("Open Action Items", kpis.get("open_pos", 0))
c4.metric("Funding Leads", kpis.get("funding_leads", 0))

st.success("Safe UI loaded. This confirms API + login are good.")
