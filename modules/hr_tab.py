from __future__ import annotations
import streamlit as st

def render():
    st.subheader("HR (safe)")
    st.warning("Safe mode: click to load HR panel.")
    if not st.button("Load HR"):
        return
    st.info("Placeholder: add onboarding, leave tracker, and payroll integrations.")
