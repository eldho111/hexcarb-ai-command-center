from __future__ import annotations
import os, json, base64
from typing import Any, Dict, Optional

import requests
import streamlit as st

def _api_base() -> str:
    url = os.getenv("API_BASE_URL")
    if not url:
        try:
            url = st.secrets["API_BASE_URL"]  # type: ignore[index]
        except Exception:
            url = "http://127.0.0.1:8000"
    return url.rstrip("/")

def _headers() -> Dict[str, str]:
    token = st.session_state.get("token")
    return {"Authorization": f"Bearer {token}"} if token else {}

def api_get(path: str, params: Optional[Dict[str, Any]] = None, timeout: int = 20):
    if not path.startswith("/"): path = "/" + path
    try:
        r = requests.get(_api_base()+path, headers=_headers(), params=params, timeout=timeout)
        if r.status_code == 401:
            st.toast("Session expired. Please log in again.")
            st.session_state.clear(); st.rerun()
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        st.info(f"⚠️ Backend not reachable at {path}. Error: {e}")
        return None

def api_post(path: str, data: Optional[Dict[str, Any]] = None, files: Optional[Dict[str, Any]] = None, timeout: int = 30):
    if not path.startswith("/"): path = "/" + path
    try:
        r = requests.post(_api_base()+path, headers=_headers(), data=data, files=files, timeout=timeout)
        if r.status_code == 401:
            st.toast("Session expired. Please log in again.")
            st.session_state.clear(); st.rerun()
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        st.info(f"⚠️ Backend not reachable at {path}. Error: {e}")
        return None

def current_role() -> str:
    token = st.session_state.get("token", "")
    if not token: return "anonymous"
    try:
        parts = token.split(".")
        if len(parts) < 2: return "user"
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = base64.urlsafe_b64decode(payload_b64.encode("utf-8")).decode("utf-8")
        role = json.loads(payload).get("role", "user")
        return role or "user"
    except Exception:
        return "user"
