# modules/theme.py — final simple & visible dark theme
import streamlit as st

def apply():
    colors = {
        "primary": "#10A37F",
        "secondary": "#0E7A63",
        "bg": "#0B0B0C",
        "panel": "#111214",
        "text": "#FFFFFF",
        "muted": "#B0B0B0",
        "bubble_user": "#005b47",
        "bubble_bot": "#1B1F23"
    }

    st.markdown(f"""
    <style>
    /* App background & base text */
    .stApp {{
        background-color: {colors['bg']} !important;
        color: {colors['text']} !important;
        font-family: "Inter", "Segoe UI", system-ui, -apple-system, Arial;
    }}

    /* Headers */
    h1, h2, h3, h4, h5, h6 {{
        color: {colors['primary']} !important;
    }}

    /* Ensure labels are visible and slightly larger */
    label, .stTextInput label, .stNumberInput label,
    .stSelectbox label, .stTextArea label {{
        color: {colors['text']} !important;
        font-weight: 600 !important;
        font-size: 1.1rem !important;
    }}

    /* Sidebar */
    [data-testid="stSidebar"] {{
        background-color: {colors['panel']} !important;
        color: {colors['text']} !important;
        border-right: 1px solid rgba(255,255,255,0.06) !important;
    }}

    /* Sidebar radio items look */
    .stSidebar .stRadio > label {{ color: {colors['text']} !important; font-weight: 500 !important; }}
    .stSidebar .stRadio div[role="radiogroup"] label p {{ color: {colors['text']} !important; }}

    /* Tiles/cards */
    .tile {{
        background: {colors['panel']} !important;
        border-radius: 12px !important;
        padding: 14px !important;
        border: 1px solid rgba(255,255,255,0.02) !important;
        color: {colors['text']} !important;
    }}
    .tile-header {{ font-weight:700; color:{colors['text']} !important; }}

    /* Inputs (baseweb selector for streamlit) */
    div[data-baseweb="input"] > input,
    textarea,
    select {{
        background-color: rgba(255,255,255,0.02) !important;
        color: {colors['text']} !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        border-radius: 8px !important;
        padding: 8px 10px !important;
    }}
    div[data-baseweb="input"] > input:focus,
    textarea:focus, select:focus {{
        border: 1px solid {colors['primary']} !important;
        box-shadow: 0 6px 18px rgba(16,163,127,0.12) !important;
        outline: none !important;
    }}

    /* Buttons */
    .stButton > button {{
        background-color: {colors['primary']} !important;
        color: #fff !important;
        border-radius: 8px !important;
        padding: 8px 12px !important;
        font-weight:600 !important;
    }}
    .stButton > button:hover {{
        background-color: {colors['secondary']} !important;
    }}

    /* Chat bubbles */
    .chat-container {{ display:flex; flex-direction:column; gap:10px; padding:8px; }}
    .msg-row {{ display:flex; gap:10px; align-items:flex-end; }}
    .msg-row.user {{ justify-content:flex-end; }}
    .bubble {{ max-width:78%; padding:10px 12px; border-radius:12px; font-size:14px; line-height:1.35; }}
    .bubble.user {{ background: {colors['bubble_user']}; color: #fff; border-bottom-right-radius:6px; }}
    .bubble.bot  {{ background: {colors['bubble_bot']}; color: {colors['text']}; border-bottom-left-radius:6px; }}

    /* Tables */
    table {{ color: {colors['text']} !important; }}
    th, td {{ border: 1px solid rgba(255,255,255,0.06) !important; padding: 6px !important; }}

    </style>
    """, unsafe_allow_html=True)
