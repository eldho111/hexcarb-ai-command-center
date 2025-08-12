import requests
import streamlit as st
from datetime import datetime

API_URL = "http://localhost:8000/api/hr/employees"
HEADERS = {"X-Role": "Admin"}


def fetch_employees(query: str = ""):
    try:
        params = {"q": query} if query else {}
        resp = requests.get(API_URL, params=params, headers=HEADERS, timeout=5)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        st.error(f"Failed to load employees: {exc}")
        return []


def open_add_modal():
    with st.modal("Add Employee"):
        with st.form("add_employee"):
            emp_id = st.number_input("ID", step=1, format="%d")
            name = st.text_input("Name")
            email = st.text_input("Email")
            role = st.text_input("Role")
            status = st.selectbox("Status", ["Active", "On Leave", "Resigned"])
            joined_on = st.date_input("Joined On", value=datetime.today())
            leave_balance = st.number_input("Leave Balance", value=0.0)
            submitted = st.form_submit_button("Create")
        if submitted:
            payload = {
                "id": int(emp_id),
                "name": name,
                "email": email,
                "role": role,
                "status": status,
                "joined_on": str(joined_on),
                "leave_balance": leave_balance,
            }
            resp = requests.post(API_URL, json=payload, headers=HEADERS, timeout=5)
            if resp.ok:
                st.success("Employee added")
                st.rerun()
            else:
                st.error(resp.text)


def open_edit_modal(emp: dict):
    with st.modal("Edit Employee"):
        with st.form(f"edit_{emp['id']}"):
            name = st.text_input("Name", emp["name"])
            email = st.text_input("Email", emp["email"])
            role = st.text_input("Role", emp["role"])
            status = st.selectbox(
                "Status", ["Active", "On Leave", "Resigned"], index=["Active", "On Leave", "Resigned"].index(emp["status"])
            )
            joined_on = st.date_input("Joined On", value=datetime.fromisoformat(emp["joined_on"]))
            leave_balance = st.number_input("Leave Balance", value=float(emp["leave_balance"]))
            submitted = st.form_submit_button("Update")
        if submitted:
            payload = {
                "id": emp["id"],
                "name": name,
                "email": email,
                "role": role,
                "status": status,
                "joined_on": str(joined_on),
                "leave_balance": leave_balance,
            }
            resp = requests.put(f"{API_URL}/{emp['id']}", json=payload, headers=HEADERS, timeout=5)
            if resp.ok:
                st.success("Employee updated")
                st.rerun()
            else:
                st.error(resp.text)


def render():
    st.title("👥 HR Directory")

    query = st.text_input("Quick Search", placeholder="Search by name or email")
    employees = fetch_employees(query)

    if st.button("Add Employee"):
        open_add_modal()

    st.subheader("Employee Directory")
    if not employees:
        st.info("No employees found.")
        return

    for emp in employees:
        cols = st.columns([3, 2, 2, 2, 1])
        cols[0].markdown(f"**{emp['name']}**<br><small>{emp['email']}</small>", unsafe_allow_html=True)
        cols[1].write(emp["role"])
        cols[2].write(emp["status"])
        cols[3].write(emp["joined_on"])
        if cols[4].button("Edit", key=f"edit_{emp['id']}"):
            open_edit_modal(emp)
