from __future__ import annotations
import streamlit as st
import requests  # keep if you later call an API; safe to leave

def render():
    st.subheader("Chat (safe)")
    st.caption("Loads on demand to avoid startup freezes.")

    # Gate the tab so nothing runs until you click:
    if not st.button("Load Chat"):
        return

    # Lightweight demo (no background loops; add timeouts if you call APIs)
    user_msg = st.text_input("Your message")
    if st.button("Send"):
        st.write("Echo:", user_msg or "(empty)")
