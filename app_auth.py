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
