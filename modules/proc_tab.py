# modules/proc_tab.py
import streamlit as st
import pandas as pd
from datetime import date
try:
    from modules import db as coredb
except Exception:
    coredb = None

def render():
    st.markdown('<div class="tile"><div class="tile-header">📦 Procurement — Vendors & Purchases</div><div>', unsafe_allow_html=True)

    st.subheader("Add / Manage Suppliers")
    with st.form("proc_supplier_form"):
        s_name = st.text_input("Supplier name")
        s_contact = st.text_input("Contact")
        s_category = st.text_input("Category")
        s_notes = st.text_area("Notes", height=80)
        save_s = st.form_submit_button("Save supplier")
        if save_s and s_name.strip():
            if coredb:
                sid = coredb.save_supplier(name=s_name.strip(), product="", contact=s_contact.strip(), category=s_category.strip(), notes=s_notes.strip())
                st.success(f"Supplier saved #{sid}")
            else:
                st.info("Saved (DB unavailable in this environment).")

    st.markdown("---")
    st.subheader("Log purchase")
    with st.form("proc_purchase_form"):
        p_date = st.date_input("Purchase date", value=date.today())
        p_material = st.text_input("Material name")
        p_vendor = st.text_input("Vendor")
        p_qty = st.text_input("Quantity")
        p_price = st.text_input("Price")
        p_invoice = st.text_input("Invoice no.")
        p_notes = st.text_area("Notes", height=80)
        save_p = st.form_submit_button("Log purchase")
        if save_p and p_material.strip() and p_vendor.strip():
            if coredb:
                pid = coredb.log_purchase(p_date.strftime("%Y-%m-%d"), p_material.strip(), p_vendor.strip(), p_qty.strip(), p_price.strip(), p_invoice.strip(), p_notes.strip())
                st.success(f"Purchase logged #{pid}")
            else:
                st.info("Logged (DB unavailable).")

    st.markdown("---")
    st.subheader("Quick lists & search")
    c1, c2 = st.columns(2)
    with c1:
        if st.button("List suppliers"):
            if coredb:
                df = pd.DataFrame(coredb.list_suppliers(500))
                st.dataframe(df, use_container_width=True)
            else:
                st.warning("DB not available.")
    with c2:
        if st.button("List purchases"):
            if coredb:
                df = pd.DataFrame(coredb.list_purchases(500))
                st.dataframe(df, use_container_width=True)
            else:
                st.warning("DB not available.")

    st.markdown('</div></div>', unsafe_allow_html=True)
