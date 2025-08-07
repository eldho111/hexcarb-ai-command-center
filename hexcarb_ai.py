#!/usr/bin/env python
"""
hexcarb_ai.py — Minimal Hexcarb Brain (Ollama Gamma) CLI + Interactive + SQLite memory
Place this file in your HexCarb project folder and run from your Anaconda Prompt.
"""

import argparse
import requests
import sqlite3
from datetime import datetime
import os
import sys
import time
import json

# ---------- CONFIG ----------
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
MODEL_NAME = os.environ.get("HEXCARB_MODEL", "gamma")   # 'gamma' by default (Ollama Gamma)
DB_PATH = os.environ.get("HEXCARB_DB", "hexcarb_memory.db")
TIMEOUT = 120  # seconds for HTTP calls

# ---------- DB helpers ----------
def ensure_db(path=DB_PATH):
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT,
            role TEXT,
            text TEXT
        )
    """)
    conn.commit()
    return conn

def save_message(conn, role, text):
    ts = datetime.utcnow().isoformat()
    cur = conn.cursor()
    cur.execute("INSERT INTO conversations (ts, role, text) VALUES (?, ?, ?)", (ts, role, text))
    conn.commit()

# ---------- Ollama / Gamma call ----------
def ask_ollama(prompt, model=MODEL_NAME, host=OLLAMA_HOST):
    url = f"{host}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False
    }
    try:
        r = requests.post(url, json=payload, timeout=TIMEOUT)
    except requests.exceptions.ConnectionError:
        return {"error": "ConnectionError", "message": f"Could not connect to {host}. Is Ollama running?"}
    except Exception as e:
        return {"error": "RequestException", "message": str(e)}

    if r.status_code != 200:
        return {"error": "HTTP", "status_code": r.status_code, "text": r.text}
    try:
        data = r.json()
    except Exception as e:
        return {"error": "JSON", "message": "Invalid JSON from Ollama: " + str(e), "raw": r.text}

    # Different Ollama versions may return slightly different shapes.
    # Try common patterns:
    if isinstance(data, dict) and "response" in data:
        resp_text = data.get("response", "")
    elif isinstance(data, dict) and "results" in data and isinstance(data["results"], list):
        # Example shape: {"results":[{"content":"..."}]}
        resp_text = "\n".join(str(x.get("content","")) for x in data["results"])
    else:
        # fallback: dump entire JSON
        resp_text = json.dumps(data, ensure_ascii=False)
    return {"ok": True, "text": resp_text}

# ---------- Utilities ----------
def warmup(model=MODEL_NAME, host=OLLAMA_HOST):
    prompt = "Warm-up: Say OK."
    return ask_ollama(prompt, model=model, host=host)

def print_and_save(conn, role, text):
    print(f"\n[{role}] {text}\n")
    save_message(conn, role, text)

# ---------- CLI / Interactive ----------
def run_interactive():
    conn = ensure_db()
    print("Hexcarb AI — interactive (type 'exit' or Ctrl+C to quit).")
    print("Tip: use short prompts first. If Ollama is cold, first run --warmup from another shell.")
    while True:
        try:
            q = input("\nYou: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nExiting interactive. Bye.")
            break
        if not q:
            continue
        if q.lower() in ("exit", "quit"):
            print("Exiting interactive. Bye.")
            break

        save_message(conn, "user", q)
        print("Thinking... (this may take a second if Gamma was idle)")
        res = ask_ollama(q)
        if res.get("ok"):
            ans = res["text"].strip()
            print_and_save(conn, "assistant", ans)
        else:
            print(f"[Error] {res}")
            save_message(conn, "assistant", f"[Error] {res}")

def run_once(question):
    conn = ensure_db()
    save_message(conn, "user", question)
    print("Sending to Ollama...")
    res = ask_ollama(question)
    if res.get("ok"):
        ans = res["text"].strip()
        print_and_save(conn, "assistant", ans)
    else:
        print("[Error]", res)
        save_message(conn, "assistant", f"[Error] {res}")

# ---------- Simple search helper ----------
def search_history(term, limit=10):
    conn = ensure_db()
    cur = conn.cursor()
    cur.execute("SELECT ts, role, text FROM conversations WHERE text LIKE ? ORDER BY ts DESC LIMIT ?", (f"%{term}%", limit))
    rows = cur.fetchall()
    if not rows:
        print("No matches found.")
        return
    for ts, role, text in rows:
        print(f"{ts} | {role}: {text[:200]}{'...' if len(text)>200 else ''}")

# ---------- main ----------
def main():
    p = argparse.ArgumentParser(description="Hexcarb AI — lightweight brain (Ollama Gamma)")
    p.add_argument("--ask", "-a", type=str, help="One-shot question to send, e.g. --ask \"How to improve SWCNT?\"")
    p.add_argument("--interactive", "-i", action="store_true", help="Start interactive chat")
    p.add_argument("--warmup", "-w", action="store_true", help="Warm up the model (small ping).")
    p.add_argument("--search", "-s", type=str, help="Search local memory for a term")
    args = p.parse_args()

    if args.warmup:
        print("Warming up Ollama model...")
        res = warmup()
        print("Warmup result:", res)
        return

    if args.search:
        search_history(args.search)
        return

    if args.ask:
        run_once(args.ask)
        return

    if args.interactive:
        run_interactive()
        return

    p.print_help()

if __name__ == "__main__":
    main()
