from __future__ import annotations
import json
import pandas as pd
import streamlit as st

from modules import sdk

def render():
    st.subheader("R&D Toolkit")

    # ---- Experiment Planner ----
    st.markdown("### Experiment Planner")
    with st.form("exp_form"):
        title = st.text_input("Title", placeholder="SWCNT fiber tensile test – batch 07")
        objective = st.text_area("Objective", placeholder="Compare dispersion A vs B; measure Raman ID/IG; target conductivity > X.")
        params_str = st.text_area("Key Parameters (JSON)", value=json.dumps({"solvent": "NMP", "surfactant": "SDS", "sonication": "30min"}, indent=2))
        submit_exp = st.form_submit_button("Create Plan")

    if submit_exp:
        try:
            params = json.loads(params_str)
        except json.JSONDecodeError:
            st.error("Parameters must be valid JSON.")
            params = None
        if params:
            payload = {"title": title, "objective": objective, "params": params}
            res = sdk.api_post("/rnd/plan", data={"payload": json.dumps(payload)})
            if res:
                st.success("✅ Experiment plan created.")
                st.json(res)

    st.divider()

    # ---- Recipe Vault ----
    st.markdown("### Recipe Vault")
    upcol, listcol = st.columns([1, 2])

    with upcol:
        recipe_file = st.file_uploader("Upload recipe (.json/.csv/.txt)", type=["json", "csv", "txt"])
        if recipe_file is not None and st.button("Upload Recipe"):
            files = {"file": (recipe_file.name, recipe_file.read())}
            res = sdk.api_post("/rnd/recipes", files=files)
            if res:
                st.success(f"✅ Uploaded {recipe_file.name}")

    with listcol:
        data = sdk.api_get("/rnd/recipes") or []
        if isinstance(data, list) and data:
            df = pd.DataFrame(data)
            st.dataframe(df, use_container_width=True)
        else:
            st.info("No recipes yet. Upload one on the left.")
