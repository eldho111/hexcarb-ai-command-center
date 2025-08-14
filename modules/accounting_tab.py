from __future__ import annotations
import os, io, json
import pandas as pd
import streamlit as st
from modules import sdk

def render():
    # Admin gate
    role = sdk.current_role()
    if role not in {"admin", "superadmin"}:
        st.error("🔒 Admins only.")
        return

    st.subheader("Accounting (admin)")

    # KPIs
    kpis = sdk.api_get("/accounting/kpis") or {"income":0, "expense":0, "net":0, "rows":0}
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Income", f"{kpis.get('income',0):,.2f}")
    c2.metric("Expense", f"{kpis.get('expense',0):,.2f}")
    c3.metric("Net", f"{kpis.get('net',0):,.2f}")
    c4.metric("Rows", f"{kpis.get('rows',0)}")

    st.divider()
    st.markdown("### Upload Transactions (CSV)")
    st.caption("CSV headers (case-insensitive): date, description, amount, type (income|expense). Positive amounts can be auto-classified as income, negative as expense.")
    up = st.file_uploader("Choose CSV", type=["csv"])
    if st.button("Upload CSV"):
        if not up:
            st.warning("Choose a CSV file first.")
        else:
            res = sdk.api_post("/acct/ingest_csv", files={"file": (up.name, up.read())})
            if res and res.get("ok"):
                st.success(f"Added {res.get('rows_added',0)} rows. Total: {res.get('total_rows',0)}")
            else:
                st.error("Upload failed. Check CSV format and try again.")

    st.divider()
    st.markdown("### Ledger")
    rows = sdk.api_get("/acct/ledgers") or []
    if rows:
        df = pd.DataFrame(rows)
        # Order columns if available
        cols = [c for c in ["date","description","amount","type","ts"] if c in df.columns] + [c for c in df.columns if c not in ["date","description","amount","type","ts"]]
        st.dataframe(df[cols], use_container_width=True, hide_index=True)
    else:
        st.info("No ledger rows yet. Upload a CSV above.")
