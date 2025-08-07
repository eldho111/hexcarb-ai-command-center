import streamlit as st

def render():
    st.title("📊 Accounting Dashboard")
    st.write("Track finances, expenses, and revenue.")

    with st.form("accounting_form"):
        date = st.date_input("Date")
        description = st.text_input("Description")
        amount = st.number_input("Amount", step=0.01)
        submitted = st.form_submit_button("Submit")
        if submitted:
            st.success("✅ Entry saved (local only).")
