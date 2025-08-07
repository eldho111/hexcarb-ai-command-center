# app.py — Hexcarb AI Command Center (final launcher)
import streamlit as st
from pathlib import Path
import importlib

ROOT = Path(__file__).parent

# Page config
st.set_page_config(page_title="Hexcarb AI Command Center", layout="wide")

# Apply theme (safe)
try:
    from modules import theme
    theme.apply()
except Exception as e:
    st.warning(f"Theme not applied: {e}")

# Sidebar header
st.sidebar.markdown(
    "<h2 style='text-align:center; margin:6px 0 14px 0; color: #FFFFFF;'>⚡ Hexcarb AI</h2>",
    unsafe_allow_html=True
)

# Navigation
menu_items = [
    "R&D",
    "Chat",
    "Procurement",
    "Accounting",     # ✅ Added
    "HR",             # ✅ Added
    "Settings"
]

if "hc_menu" not in st.session_state:
    st.session_state.hc_menu = menu_items[0]

selected = st.sidebar.radio("Navigate", menu_items, index=menu_items.index(st.session_state.hc_menu), key="hc_sidebar_radio")
st.session_state.hc_menu = selected

# Divider
st.sidebar.markdown("<hr style='border:1px solid rgba(255,255,255,0.06);'>", unsafe_allow_html=True)

# Map labels -> modules
module_map = {
    "R&D": "modules.rd_tab",
    "Chat": "modules.chat_tab",
    "Procurement": "modules.proc_tab",
    "Accounting": "modules.accounting_tab",  # ✅ Added
    "HR": "modules.hr_tab",                  # ✅ Added
    "Settings": "modules.settings_tab"
}

path = module_map.get(selected)

# Try to import and render the selected module
try:
    mod = importlib.import_module(path)
    if hasattr(mod, "render") and callable(mod.render):
        mod.render()
    else:
        st.info(f"Module {path} loaded but has no render() function.")
except Exception as e:
    st.error(f"Failed to load module {path}: {e}")
    import traceback
    st.expander("Traceback", expanded=True).write(traceback.format_exc())
# Temporary change to trigger Heroku build
# Triggering fresh Heroku build
