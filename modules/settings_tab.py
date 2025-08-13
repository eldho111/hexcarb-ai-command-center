from __future__ import annotations
import os
import streamlit as st
from modules import sdk

def _get_secret_safe(key: str, default: str = "(env var)") -> str:
    # Prefer environment variable
    val = os.getenv(key)
    if val:
        return val
    # Try st.secrets, but guard it to avoid StreamlitSecretNotFoundError
    try:
        return st.secrets.get(key, default)  # type: ignore[attr-defined]
    except Exception:
        return default

def render():
    role = sdk.current_role()
    if role not in {"admin", "superadmin"}:
        st.error("🔒 Admins only.")
        return

    st.subheader("Settings (Admin)")
    st.caption("User management, secrets, environment config, service URLs, etc.")

    api_base_display = _get_secret_safe("API_BASE_URL")
    st.markdown("**Environment**")
    st.code(f"API_BASE_URL = {api_base_display}")
    st.info("Tip: set API_BASE_URL via environment variables or Streamlit secrets.\n"
            "For local dev, export in your shell: `export API_BASE_URL=http://127.0.0.1:8000`")
