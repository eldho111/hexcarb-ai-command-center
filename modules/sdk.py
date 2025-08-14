from __future__ import annotations
import os, json, base64
from typing import Any, Dict, Optional
import requests, streamlit as st

def _api_base() -> str:
    return (os.getenv("API_BASE_URL") or "http://127.0.0.1:8000").rstrip("/")

def _headers() -> Dict[str, str]:
    t = st.session_state.get("token")
    return {"Authorization": f"Bearer {t}"} if t else {}

def api_get(path: str, params: Optional[Dict[str, Any]] = None, timeout: int = 15):
    if not path.startswith("/"): path = "/" + path
    try:
        r = requests.get(_api_base()+path, headers=_headers(), params=params, timeout=timeout)
        if r.status_code == 401:
            st.toast("Session expired. Please log in again."); st.session_state.clear(); st.rerun()
        r.raise_for_status(); return r.json()
    except requests.RequestException as e:
        st.info(f"⚠️ GET {path} failed: {e}"); return None

def api_post(path: str, data: Optional[Dict[str, Any]] = None, files: Optional[Dict[str, Any]] = None, timeout: int = 30):
    if not path.startswith("/"): path = "/" + path
    try:
        r = requests.post(_api_base()+path, headers=_headers(), data=data, files=files, timeout=timeout)
        if r.status_code == 401:
            st.toast("Session expired. Please log in again."); st.session_state.clear(); st.rerun()
        r.raise_for_status(); return r.json()
    except requests.RequestException as e:
        st.info(f"⚠️ POST {path} failed: {e}"); return None

def current_role() -> str:
    token = st.session_state.get("token","")
    try:
        parts = token.split("."); 
        if len(parts) < 2: return "user"
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = base64.urlsafe_b64decode(payload_b64.encode("utf-8")).decode("utf-8")
        return (json.loads(payload).get("role") or "user")
    except Exception:
        return "user"
