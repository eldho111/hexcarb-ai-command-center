from __future__ import annotations
import os
import json
import base64
from typing import Any, Dict, Optional

import requests
import streamlit as st


def get_api_base_url() -> str:
    """
    Resolve API_BASE_URL from environment or st.secrets.
    Default: http://127.0.0.1:8000 (local dev)
    """
    url = os.getenv("API_BASE_URL")
    if not url:
        try:
            url = st.secrets["API_BASE_URL"]  # type: ignore[index]
        except Exception:
            url = "http://127.0.0.1:8000"
    return url.rstrip("/")


def _decode_jwt_noverify(token: str) -> Dict[str, Any]:
    """
    Decode JWT header & payload without verification.
    UI-only convenience. Security is enforced by the API.
    """
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return {}
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = base64.urlsafe_b64decode(payload_b64.encode("utf-8")).decode("utf-8")
        return json.loads(payload)
    except Exception:
        return {}


def render_login_sidebar() -> bool:
    """
    Renders a login form in the sidebar. Returns True if logged in.
    Stores: st.session_state.token, st.session_state.role
    """
    st.header("Access")

    token = st.session_state.get("token")
    if not token:
        with st.form("login_form", clear_on_submit=False):
            username = st.text_input("Username")
            password = st.text_input("Password", type="password")
            submitted = st.form_submit_button("Sign in")

        if submitted:
            api_base = get_api_base_url()
            try:
                r = requests.post(
                    f"{api_base}/login",
                    data={"username": username, "password": password},
                    timeout=15,
                )
                if r.status_code == 200:
                    data = r.json()
                    st.session_state.token = data.get("access_token")
                    st.session_state.role = data.get("role", "user")
                    st.success("Signed in.")
                    st.rerun()
                else:
                    st.error("Login failed. Check credentials.")
            except requests.RequestException as e:
                st.error(f"Login endpoint unavailable: {e}")
        return False

    # Already logged in
    claims = _decode_jwt_noverify(token)
    role = st.session_state.get("role") or claims.get("role") or "user"
    user = claims.get("sub", "unknown")
    st.write(f"**User:** {user}  \n**Role:** {role}")
    if st.button("Sign out"):
        st.session_state.clear()
        st.rerun()
    return True


def api_headers() -> Dict[str, str]:
    """Authorization header for API calls."""
    token = st.session_state.get("token")
    return {"Authorization": f"Bearer {token}"} if token else {}


def _full_url(path: str) -> str:
    base = get_api_base_url()
    if not path.startswith("/"):
        path = "/" + path
    return f"{base}{path}"


def api_get(path: str, params: Optional[Dict[str, Any]] = None, timeout: int = 20) -> Optional[Any]:
    """GET helper that includes auth header and shows nice errors in UI."""
    try:
        r = requests.get(_full_url(path), headers=api_headers(), params=params, timeout=timeout)
        if r.status_code == 401:
            st.toast("Session expired. Please log in again.")
            st.session_state.clear()
            st.rerun()
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        st.info(f"⚠️ Backend not reachable at {path}. Error: {e}")
        return None


def api_post(path: str,
             data: Optional[Dict[str, Any]] = None,
             files: Optional[Dict[str, Any]] = None,
             timeout: int = 30) -> Optional[Any]:
    """POST helper that includes auth header and shows nice errors in UI."""
    try:
        r = requests.post(_full_url(path), headers=api_headers(), data=data, files=files, timeout=timeout)
        if r.status_code == 401:
            st.toast("Session expired. Please log in again.")
            st.session_state.clear()
            st.rerun()
        r.raise_for_status()

cat > app_auth.py <<'PYCODE'
from __future__ import annotations
import os
import importlib
import streamlit as st

from modules import auth  # our auth helpers

APP_NAME = os.getenv("APP_NAME", "HEXCARB AI Engine")

st.set_page_config(page_title=APP_NAME, page_icon="🧠", layout="wide")
st.markdown(f"<h1 style='margin-bottom:0'>{APP_NAME}</h1>", unsafe_allow_html=True)
st.caption("Login required. After sign-in, your existing tabs will be available below.")

# Sidebar login
with st.sidebar:
    logged_in = auth.render_login_sidebar()

if not logged_in:
    st.info("Please sign in from the left sidebar to continue.")
    st.stop()

# KPI pulse (proves API auth works)
kpis = auth.api_get("/kpis") or {}
with st.container():
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Experiments (7d)", kpis.get("experiments_this_week", 0))
    c2.metric("Docs Indexed", kpis.get("documents_indexed", 0))
    c3.metric("Open Action Items", kpis.get("open_pos", 0))
    c4.metric("Funding Leads", kpis.get("funding_leads", 0))

st.divider()

def safe_render(module_name: str, nice_title: str):
    """Import modules.<name> and call render()/main() if available."""
    try:
        mod = importlib.import_module(f"modules.{module_name}")
    except Exception as e:
        st.warning(f"Module `{module_name}` not found or failed to import: {e}")
        return
    render_fn = getattr(mod, "render", None) or getattr(mod, "main", None)
    if callable(render_fn):
        try:
            render_fn()
        except TypeError:
            render_fn()
    else:
        st.info(f"`{module_name}` has no `render()` or `main()` function to call.")

tab_titles = [
    ("chat_tab", "Chat"),
    ("rd_tab", "R&D"),
    ("proc_tab", "Procurement"),
    ("accounting_tab", "Accounting"),
    ("hr_tab", "HR"),
    ("settings_tab", "Settings"),
]

tabs = st.tabs([t[1] for t in tab_titles])

for idx, (module_name, nice_title) in enumerate(tab_titles):
    with tabs[idx]:
        safe_render(module_name, nice_title)
