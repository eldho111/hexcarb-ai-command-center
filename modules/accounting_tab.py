import streamlit as st
from datetime import datetime

def render():
    st.title("📊 Accounting Dashboard")
    st.markdown("Track your company's income, expenses, and financial reports.")

    st.subheader("🧾 New Transaction Entry")
    with st.form("accounting_form"):
        col1, col2 = st.columns(2)
        with col1:
            date = st.date_input("Transaction Date", value=datetime.today())
            txn_type = st.selectbox("Type", ["Income", "Expense"])
        with col2:
            amount = st.number_input("Amount (₹)", step=0.01)
            category = st.selectbox("Category", ["Sales", "Purchase", "Salary", "Operations", "Misc"])
        
        description = st.text_area("Description")
        submitted = st.form_submit_button("Add Transaction")
        if submitted:
            st.success("✅ Transaction saved (currently in-memory only)")

    st.markdown("---")

    st.subheader("📈 Summary (placeholder)")
    st.info("Balance Sheet and reports will be integrated in future versions.")
