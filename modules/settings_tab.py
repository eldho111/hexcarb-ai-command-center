from __future__ import annotations
import os, streamlit as st
from modules import sdk

def _get_env_or_default(key: str, default: str="(env var)")->str:
    val = os.getenv(key)
    if val: return val
    try:
        return st.secrets.get(key, default)  # guarded; no crash if secrets.toml missing
    except Exception:
        return default

def render():
    role = sdk.current_role()
    if role not in {"admin","superadmin"}:
        st.error("🔒 Admins only.")
        return

    st.subheader("Settings (Admin)")
    st.caption("Environment, service URLs, user management (future).")

    api_base = _get_env_or_default("API_BASE_URL")
    st.markdown("**Environment**")
    st.code(f"API_BASE_URL = {api_base}")
    st.info("Tip: export API_BASE_URL in your shell, or set via Streamlit secrets.")

# -- ADMIN USERS BEGIN --
    st.divider()
    st.markdown("### User Management")

    with st.form("add_user_form"):
        new_user = st.text_input("Username")
        new_pass = st.text_input("Password", type="password")
        new_role = st.selectbox("Role", ["user","admin"])
        submitted = st.form_submit_button("Create User")
    if submitted:
        from modules import sdk
        res = sdk.api_post("/admin/users", data={"username": new_user, "password": new_pass, "role": new_role})
        if res and res.get("ok"):
            st.success(f"User created: {new_user} ({new_role})")
        else:
            st.error("Failed to create user (check logs/role/auth).")
# -- ADMIN USERS END --
