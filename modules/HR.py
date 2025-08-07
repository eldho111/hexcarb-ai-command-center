import streamlit as st

def render():
    st.title("👥 HR Dashboard")
    st.write("Manage employees, roles, and leave tracking.")

    with st.form("hr_form"):
        name = st.text_input("Employee Name")
        role = st.selectbox("Role", ["Engineer", "Manager", "Intern"])
        joining_date = st.date_input("Joining Date")
        submitted = st.form_submit_button("Submit")
        if submitted:
            st.success("✅ Employee record saved (local only).")
