import streamlit as st
from datetime import datetime

def render():
    st.title("👥 HR Dashboard")
    st.markdown("Manage employee records and HR activities.")

    st.subheader("➕ Add New Employee")
    with st.form("hr_form"):
        col1, col2 = st.columns(2)
        with col1:
            name = st.text_input("Full Name")
            emp_id = st.text_input("Employee ID")
            joining_date = st.date_input("Joining Date", value=datetime.today())
        with col2:
            role = st.selectbox("Role", ["Engineer", "Manager", "Technician", "Intern", "Other"])
            status = st.selectbox("Employment Status", ["Active", "On Leave", "Resigned"])
        
        remarks = st.text_area("Remarks")
        submitted = st.form_submit_button("Add Employee")
        if submitted:
            st.success("✅ Employee record added (currently in-memory only)")

    st.markdown("---")

    st.subheader("📋 Employee Directory (placeholder)")
    st.info("Employee table and search will be available soon.")
