from __future__ import annotations
import json, pandas as pd, streamlit as st
from modules import sdk

def render():
    st.subheader("R&D – Experiments & Results")

    with st.expander("Create Experiment", expanded=True):
        with st.form("exp_form"):
            title = st.text_input("Title", placeholder="SWCNT fiber tensile test – batch 07")
            objective = st.text_area("Objective", placeholder="Compare dispersion A vs B; measure Raman ID/IG; target conductivity > X.")
            params_str = st.text_area("Key Parameters (JSON)", value=json.dumps({"solvent":"NMP","surfactant":"SDS","sonication":"30min"}, indent=2))
            submit_exp = st.form_submit_button("Create")
        if submit_exp:
            try:
                params = json.loads(params_str)
                payload = {"title": title or "Untitled", "objective": objective, "params": params}
                res = sdk.api_post("/rnd/experiments/create", data={"payload": json.dumps(payload)})
                if res and res.get("ok"):
                    st.success(f"✅ Created experiment: {res['experiment']['id']}")
                else:
                    st.error("Failed to create experiment")
            except json.JSONDecodeError:
                st.error("Parameters must be valid JSON.")

    st.divider()
    st.markdown("### Experiments")

    # List experiments
    exps = sdk.api_get("/rnd/experiments") or []
    if exps:
        df = pd.DataFrame(exps)
        st.dataframe(df[["id","title","status","ts"]], use_container_width=True)
    else:
        st.info("No experiments yet. Create one above.")

    st.markdown("### Update Status")
    if exps:
        exp_ids = [e["id"] for e in exps]
        col1, col2, col3 = st.columns([2,2,1])
        with col1:
            sel = st.selectbox("Experiment", exp_ids)
        with col2:
            status = st.selectbox("Status", ["planned","running","paused","completed","failed"], index=0)
        with col3:
            if st.button("Update"):
                res = sdk.api_post("/rnd/experiments/status", data={"exp_id": sel, "status": status})
                if res and res.get("ok"):
                    st.success("Status updated.")
                else:
                    st.error("Failed to update status.")

    st.divider()
    st.markdown("### Upload Results")
    if exps:
        exp_ids = [e["id"] for e in exps]
        c1, c2 = st.columns([2,3])
        with c1:
            exp_sel = st.selectbox("Experiment for results", exp_ids, key="res_exp_sel")
            file = st.file_uploader("Upload a result file (CSV/TXT/JSON/etc.)")
        with c2:
            if st.button("Upload Result"):
                if file is None:
                    st.warning("Choose a file first.")
                else:
                    res = sdk.api_post("/rnd/results/upload", data={"exp_id": exp_sel}, files={"file": (file.name, file.read())})
                    if res and res.get("ok"):
                        st.success(f"Uploaded: {res['result']['name']}")
                    else:
                        st.error("Upload failed.")

    st.divider()
    st.markdown("### Results Browser")
    if exps:
        exp_ids = ["(all)"] + [e["id"] for e in exps]
        choice = st.selectbox("Show results for", exp_ids, key="list_exp_sel")
        params = None if choice == "(all)" else {"exp_id": choice}
        data = sdk.api_get("/rnd/results", params=params) or []
        if isinstance(data, list) and data:
            st.dataframe(pd.DataFrame(data), use_container_width=True)
        else:
            st.info("No results yet. Upload above.")
