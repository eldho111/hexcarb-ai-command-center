from __future__ import annotations
import pandas as pd
import streamlit as st
from modules import sdk

def render():
    # --- Admin gate ---
    role = sdk.current_role()
    if role not in {"admin", "superadmin"}:
        st.error("🔒 Admins only.")
        return

    st.subheader("Procurement")

    # ========== Vendor Directory ==========
    with st.expander("Vendor Directory", expanded=True):
        c1, c2, c3, c4 = st.columns([2,1,1,1])
        with c1:
            v_name = st.text_input("Vendor name", placeholder="Supplier XYZ")
        with c2:
            v_country = st.text_input("Country", value="IN")
        with c3:
            v_rating = st.number_input("Rating (1-5)", min_value=1, max_value=5, value=3, step=1)
        with c4:
            if st.button("➕ Add Vendor"):
                if not v_name.strip():
                    st.warning("Enter vendor name.")
                else:
                    res = sdk.api_post("/ops/vendors/create", data={"name": v_name, "country": v_country, "rating": int(v_rating)})
                    if res and res.get("ok"):
                        st.success(f"Added: {res['vendor']['name']}")
                    else:
                        st.error("Failed to add vendor.")
        # list vendors
        vendors = sdk.api_get("/ops/vendors") or []
        if vendors:
            st.dataframe(pd.DataFrame(vendors), use_container_width=True, hide_index=True)
        else:
            st.info("No vendors yet. Add one above.")

    st.divider()

    # ========== RFQ Builder ==========
    with st.expander("RFQ Builder", expanded=True):
        vendors = sdk.api_get("/ops/vendors") or []
        if not vendors:
            st.warning("Add a vendor first in Vendor Directory.")
        else:
            vmap = {f"{v['name']} ({v['country']})": v["id"] for v in vendors}
            c1, c2 = st.columns([2,3])
            with c1:
                v_choice = st.selectbox("Vendor", list(vmap.keys()))
                item = st.text_input("Item / Part", placeholder="Anhydrous NMP 99.5%")
            with c2:
                qty = st.number_input("Quantity", min_value=1, value=10, step=1)
                currency = st.text_input("Currency", value="INR")
            if st.button("📝 Create RFQ"):
                if not item.strip():
                    st.warning("Enter item name.")
                else:
                    res = sdk.api_post("/ops/rfq/create", data={"vendor_id": vmap[v_choice], "item": item, "qty": int(qty), "currency": currency})
                    if res and res.get("ok"):
                        st.success(f"RFQ created: {res['rfq']['id']}")
                    else:
                        st.error("Failed to create RFQ.")

    # ========== Quotes ==========
    st.markdown("### Quotes & Decisions")
    rfqs = sdk.api_get("/ops/rfq") or []
    if rfqs:
        df = pd.DataFrame(rfqs)
# Ensure optional columns exist even before quoting
for col in ["price","lead_time_days"]:
    if col not in df.columns:
        df[col] = None
st.dataframe(df[["id","vendor","item","qty","currency","status","price","lead_time_days"]], use_container_width=True, hide_index=True)
        c1, c2, c3 = st.columns([2,2,2])
        with c1:
            rfq_sel = st.selectbox("Select RFQ", [r["id"] for r in rfqs])
        with c2:
            price = st.number_input("Quote price", min_value=0.0, value=0.0, step=0.1)
            ltd = st.number_input("Lead time (days)", min_value=0, value=7, step=1)
        with c3:
            if st.button("💬 Submit Quote"):
                res = sdk.api_post("/ops/rfq/quote", data={"rfq_id": rfq_sel, "price": float(price), "lead_time_days": int(ltd)})
                if res and res.get("ok"):
                    st.success("Quote saved.")
                else:
                    st.error("Failed to save quote.")
        c4, c5 = st.columns(2)
        with c4:
            if st.button("✅ Approve RFQ"):
                res = sdk.api_post("/ops/rfq/choose", data={"rfq_id": rfq_sel, "approve": True})
                if res and res.get("ok"):
                    st.success("RFQ approved.")
        with c5:
            if st.button("❌ Reject RFQ"):
                res = sdk.api_post("/ops/rfq/choose", data={"rfq_id": rfq_sel, "approve": False})
                if res and res.get("ok"):
                    st.success("RFQ rejected.")
    else:
        st.info("No RFQs yet. Create one in RFQ Builder.")

    st.divider()

    # ========== Compliance Checklist (already in API) ==========
    with st.expander("Compliance Checklist", expanded=False):
        vc1, vc2, vc3 = st.columns([2,1,2])
        with vc1:
            vendor_name = st.text_input("Vendor name (free text)", placeholder="Supplier XYZ")
        with vc2:
            country_c = st.text_input("Country", value="IN")
        with vc3:
            use_case = st.text_input("Use case", value="solvents / electronics")
        if st.button("📋 Generate Checklist"):
            if not vendor_name.strip():
                st.warning("Enter vendor name.")
            else:
                res = sdk.api_post("/ops/vendor/checklist", data={"vendor": vendor_name, "country": country_c, "use_case": use_case})
                if res:
                    st.success("Checklist generated.")
                    items = res.get("checklist", [])
                    for i, it in enumerate(items, start=1):
                        st.checkbox(f"{i}. {it.get('item','')}", value=False, key=f"ck_{i}")
                else:
                    st.error("API call failed.")
