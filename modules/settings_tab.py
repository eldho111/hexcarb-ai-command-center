# modules/settings_tab.py
import streamlit as st
import pandas as pd
import os
from pathlib import Path

try:
    from modules import db as coredb
except Exception:
    coredb = None

try:
    from modules import utils
except Exception:
    utils = None

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"

def render():
    st.markdown('<div class="tile"><div class="tile-header">⚙ Settings & Diagnostics</div><div>', unsafe_allow_html=True)

    st.subheader("Maintenance")
    col1, col2 = st.columns(2)
    with col1:
        if st.button("Reinitialize DB (create tables)"):
            if coredb:
                coredb.init_db(); st.success("DB init attempted.")
            else:
                st.warning("DB module not found.")
        if st.button("Delete local vector store"):
            f1 = DATA_DIR / "faiss.index"; f2 = DATA_DIR / "vector_chunks.pkl"
            removed = []
            for f in (f1, f2):
                if f.exists():
                    f.unlink(); removed.append(f.name)
            if removed:
                st.success("Deleted: " + ", ".join(removed))
            else:
                st.info("No vector store files present.")

    with col2:
        if st.button("Warm up models (embedder & index)"):
            if utils:
                _ = utils.get_embedder(); _ = utils.load_faiss_and_data(); st.success("Warm-up attempted.")
            else:
                st.warning("Utils module not available.")

        if st.button("Download core DB (sqlite)"):
            p = DATA_DIR / "hexcarb_core.db"
            if p.exists():
                with open(p, "rb") as fh:
                    st.download_button("Download DB file", fh.read(), file_name="hexcarb_core.db", mime="application/x-sqlite3")
            else:
                st.warning("DB file not found.")

    st.markdown("---")
    st.subheader("Exports")
    if coredb:
        if st.button("Export notes → CSV"):
            rows = coredb.list_notes(5000)
            df = pd.DataFrame(rows); st.download_button("Download notes CSV", df.to_csv(index=False), file_name="hexcarb_notes.csv", mime="text/csv")
    else:
        st.info("DB not available — exports disabled.")

    st.markdown("---")
    st.subheader("Diagnostics")
    st.write(f"- Data dir: `{str(DATA_DIR)}`")
    st.write(f"- Core DB present: { (DATA_DIR / 'hexcarb_core.db').exists() }")
    st.write(f"- Vector index present: { (DATA_DIR / 'faiss.index').exists() }")
    st.markdown('</div></div>', unsafe_allow_html=True)
