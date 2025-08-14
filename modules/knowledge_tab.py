from __future__ import annotations
import streamlit as st
from modules import sdk

def render():
    st.subheader("Knowledge")

    up, search = st.columns([1,2])

    # ---- Upload / Ingest ----
    with up:
        st.markdown("**Ingest Document**")
        f = st.file_uploader("Upload text-like files", type=["txt","md","csv","json"])
        if f is not None and st.button("Ingest"):
            res = sdk.api_post("/knowledge/ingest", files={"file": (f.name, f.read())})
            if res and res.get("ok"):
                st.success(f"Indexed: {res.get('name')}")
            else:
                st.error("Ingest failed.")

    # ---- Search ----
    with search:
        st.markdown("**Search**")
        q = st.text_input("Query", placeholder="e.g., Raman ID/IG, BIS for solvents, KSUM grant…")
        if st.button("Search") and q.strip():
            hits = sdk.api_get("/knowledge/search", params={"q": q})
            if not hits:
                st.info("No matches.")
                return
            for h in hits:
                st.markdown(f"**{h.get('title','(untitled)')}**")
                st.code((h.get('snippet','') or '')[:800])
                st.divider()
