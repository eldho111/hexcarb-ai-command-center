# modules/chat_tab.py
import streamlit as st
from datetime import datetime
from modules import utils
try:
    from modules import db as coredb
except Exception:
    coredb = None

def _format_time(ts=None):
    ts = ts or datetime.utcnow()
    return ts.strftime("%H:%M")

def render():
    # main tile
    st.markdown('<div class="tile">', unsafe_allow_html=True)

    # Title (keeps header visible)
    st.markdown('<div class="tile-header">💬 Chat — Hexcarb AI</div>', unsafe_allow_html=True)

    # Initialize history
    if "hc_chat_history" not in st.session_state:
        st.session_state.hc_chat_history = []  # list of dicts: {"who":"user"/"bot", "text":..., "ts":...}

    # Chat display area
    st.markdown('<div class="chat-container" id="chat_container">', unsafe_allow_html=True)
    # show recent messages (limit to last 200)
    for m in st.session_state.hc_chat_history[-200:]:
        who = m.get("who")
        text = m.get("text")
        ts = m.get("ts")
        row_class = "msg-row user" if who == "user" else "msg-row bot"
        bubble_class = "bubble user" if who == "user" else "bubble bot"
        # render row
        if who == "user":
            st.markdown(f'''
            <div class="{row_class}">
              <div class="{bubble_class}">{text}</div>
            </div>
            ''', unsafe_allow_html=True)
        else:
            st.markdown(f'''
            <div class="{row_class}">
              <div class="{bubble_class}">{text}</div>
            </div>
            ''', unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)  # close chat-container

    st.markdown('<div style="height:10px"></div>', unsafe_allow_html=True)

    # Input area at bottom
    with st.form("chat_input_form", clear_on_submit=False):
        cols = st.columns([1, 0.16])
        with cols[0]:
            user_input = st.text_area("Type a message", key="hc_user_input", height=90, placeholder="Ask about experiments, suppliers, or the latest notes...")
        with cols[1]:
            send = st.form_submit_button("Send")
        if send and user_input and user_input.strip():
            user_text = user_input.strip()
            # append user message
            entry_u = {"who":"user", "text": user_text.replace('\n','<br/>'), "ts": datetime.utcnow()}
            st.session_state.hc_chat_history.append(entry_u)
            if coredb:
                try:
                    coredb.log_interaction("user", user_text, context={"source":"chat_ui"})
                except Exception:
                    pass

            # build a concise prompt
            prompt = f"You are Hexcarb AI. Answer concisely. User: {user_text}\nAssistant:"
            resp = utils.run_ollama(prompt)
            if resp is None:
                resp = "[Error] Model not available."
            entry_b = {"who":"bot", "text": resp.replace('\n','<br/>'), "ts": datetime.utcnow()}
            st.session_state.hc_chat_history.append(entry_b)
            if coredb:
                try:
                    coredb.log_interaction("assistant", resp, context={"source":"chat_ui"})
                except Exception:
                    pass

            # clear the input box
            st.session_state.hc_user_input = ""

            # refresh (Streamlit will re-run and show new messages)

    st.markdown('</div>', unsafe_allow_html=True)  # close tile

    # optional: show small footer / credits
    st.markdown('<div style="margin-top:10px;color:rgba(255,255,255,0.35);font-size:12px">Hexcarb AI — chat powered by local model</div>', unsafe_allow_html=True)
