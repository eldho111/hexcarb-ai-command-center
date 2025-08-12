# modules/rd_tab.py
import streamlit as st
import pandas as pd
from datetime import date
from modules import utils
try:
    from modules import db as coredb
except Exception:
    coredb = None

def render():
    st.markdown('<div class="tile"><div class="tile-header">🔬 R&D — Projects & Notes</div><div>', unsafe_allow_html=True)

    # --- Projects & tasks ---
    st.subheader("Projects")
    selected_pid = None
    if coredb:
        with st.form("rd_proj_create", clear_on_submit=True):
            c1, c2, c3 = st.columns([2,2,1])
            name = c1.text_input("Name")
            owner = c2.text_input("Owner")
            submit = c3.form_submit_button("Create")
            if submit and name.strip():
                coredb.create_project(name.strip(), owner.strip())
                st.success("Project created")
        projects = coredb.list_projects()
        if projects:
            opts = {f"{p['name']} (#{p['id']})": p['id'] for p in projects}
            choice = st.selectbox("Select project", list(opts.keys()))
            selected_pid = opts.get(choice)
        else:
            st.info("No projects yet.")
    else:
        st.warning("DB not available.")

    if selected_pid and coredb:
        tasks = coredb.list_tasks(selected_pid)
        cols = st.columns(3)
        states = ["todo", "doing", "done"]
        for st_name, col in zip(states, cols):
            with col:
                st.markdown(f"**{st_name.capitalize()}**")
                for t in [t for t in tasks if t['state'] == st_name]:
                    assignee = f" ({t['assignee']})" if t.get('assignee') else ""
                    st.markdown(f"- {t['title']}{assignee}")
        with st.form("rd_task_create", clear_on_submit=True):
            tcol1, tcol2, tcol3 = st.columns([3,2,1])
            title = tcol1.text_input("Task title")
            assignee = tcol2.text_input("Assignee")
            due = tcol3.date_input("Due", value=date.today())
            add = st.form_submit_button("Add task")
            if add and title.strip():
                dd = due.isoformat() if due else None
                coredb.create_task(selected_pid, title.strip(), assignee.strip(), due_date=dd)
                st.success("Task added")

    st.markdown("---")

    # --- Add note form (two-column layout for meta) ---
    with st.form("rd_add_form"):
        st.subheader("Add research note")
        col1, col2 = st.columns([3,1])
        with col1:
            note_body = st.text_area("Note body (use first line as title)", height=160)
        with col2:
            tags = st.text_input("Tags (comma-separated)")
            category = st.selectbox("Category", ["R&D", "Experiment", "Report", "Meeting"], index=0)
            save_btn = st.form_submit_button("Save Note")
        if save_btn and note_body.strip():
            title = note_body.strip().splitlines()[0][:120]
            tags_list = [t.strip() for t in tags.split(",")] if tags else []
            if coredb:
                nid = coredb.save_note(title=title, body=note_body.strip(), tags=tags_list, category=category)
                st.success(f"Saved note #{nid}")
            else:
                # fallback: simple message
                st.info("Note captured (DB not available in this environment).")

    st.markdown("---")

    # --- Quick list / search ---
    st.subheader("Browse & Search")
    c1, c2, c3 = st.columns([2,2,2])
    with c1:
        if st.button("List notes"):
            if coredb:
                rows = coredb.list_notes(500)
                st.dataframe(pd.DataFrame(rows), use_container_width=True)
            else:
                st.warning("DB not available.")
    with c2:
        kw = st.text_input("Keyword search", key="rd_kw")
        if st.button("Search"):
            if kw.strip():
                if coredb:
                    rows = coredb.search_notes(kw.strip(), limit=200)
                    st.dataframe(pd.DataFrame(rows), use_container_width=True)
                else:
                    st.warning("DB not available.")
    with c3:
        sem_q = st.text_input("Semantic query (vector)", key="rd_sem_q")
        sem_k = st.number_input("Top k", min_value=1, max_value=6, value=3, key="rd_sem_k")
        if st.button("Semantic search"):
            idx, data = utils.load_faiss_and_data()
            if idx and data:
                results = utils.retrieve_from_index(sem_q, idx, data, k=sem_k)
                for r in results:
                    st.markdown(f"**{r['source']}** — {r['text'][:350]}...")
            else:
                st.warning("No vector index found. Build the index first.")

    st.markdown("---")

    # --- AI-assisted summary ---
    st.subheader("AI-assisted summary")
    ai_q = st.text_input("Summarize notes for keyword:", key="rd_ai_q")
    if st.button("Get summary"):
        if not ai_q.strip():
            st.warning("Enter a keyword to summarize.")
        else:
            if coredb:
                rows = coredb.search_notes(ai_q.strip(), limit=10)
                ctx = "\n".join([f"{r['title']}: {r.get('tags','')}" for r in rows])
                prompt = f"Summarize the following notes for '{ai_q}':\n\n{ctx}\n\nGive a concise 4-6 sentence summary."
                ans = utils.run_ollama(prompt)
                st.info(ans)
            else:
                st.warning("DB not available to collect notes (can't summarize).")

    st.markdown('</div></div>', unsafe_allow_html=True)
