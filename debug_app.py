# debug_app.py — run this to show import/render errors for each module
import streamlit as st
import importlib, traceback

st.title("Debug — module loader")
st.write("This will try to import each tab module and call its render() inside a safe try/except.")

modules = {
    "R&D": "modules.rd_tab",
    "Chat": "modules.chat_tab",
    "Procurement": "modules.proc_tab",
    "Settings": "modules.settings_tab",
    "Theme": "modules.theme",
    "DB": "modules.db",
    "Utils": "modules.utils",
}

for label, path in modules.items():
    st.header(label)
    try:
        mod = importlib.import_module(path)
        st.success(f"Imported {path} as {mod.__name__}")
        render_fn = getattr(mod, "render", None)
        if callable(render_fn):
            try:
                st.subheader(f"Calling render() for {label}")
                render_fn()
                st.success(f"render() for {label} completed (no exception)")
            except Exception:
                st.error(f"Exception while running {path}.render()")
                st.expander("Traceback", expanded=True).write(traceback.format_exc())
        else:
            st.info(f"No render() function on {path}. (This may be okay for utils/db modules.)")
    except Exception:
        st.error(f"Failed to import {path}")
        st.expander("Traceback", expanded=True).write(traceback.format_exc())
