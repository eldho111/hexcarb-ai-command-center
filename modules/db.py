# modules/db.py
import sqlite3
from pathlib import Path
from datetime import datetime
import json

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "hexcarb_core.db"

def get_conn():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    cur = conn.cursor()
    # Notes (R&D)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        body TEXT,
        tags TEXT,            -- comma-separated tags
        category TEXT,        -- e.g., "R&D"
        created_at TEXT,
        updated_at TEXT
    )""")
    # Suppliers, materials, purchases (procurement)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        contact TEXT,
        category TEXT,
        notes TEXT,
        created_at TEXT
    )""")
    cur.execute("""
    CREATE TABLE IF NOT EXISTS materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        spec TEXT,
        vendor_link TEXT,
        notes TEXT,
        created_at TEXT
    )""")
    cur.execute("""
    CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        material_id INTEGER,
        material_name TEXT,
        vendor TEXT,
        qty TEXT,
        price TEXT,
        invoice TEXT,
        notes TEXT,
        created_at TEXT
    )""")
    # Files / ingested docs
    cur.execute("""
    CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT,
        filepath TEXT,
        source_url TEXT,
        metadata TEXT,
        created_at TEXT
    )""")
    # User interactions / chat history (light)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor TEXT,         -- 'user' or 'assistant' or 'system'
        text TEXT,
        context TEXT,       -- optional JSON
        created_at TEXT
    )""")
    # R&D projects
    cur.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        owner TEXT,
        status TEXT,
        created_at TEXT
    )""")
    # R&D tasks
    cur.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        title TEXT,
        state TEXT,
        assignee TEXT,
        due_date TEXT,
        created_at TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )""")
    conn.commit()
    conn.close()

# ---------- Notes helpers ----------
def save_note(title, body, tags=None, category="R&D"):
    now = datetime.utcnow().isoformat()
    tags_s = ",".join([t.strip() for t in tags]) if isinstance(tags, (list,tuple)) else (tags or "")
    conn = get_conn(); cur = conn.cursor()
    cur.execute("INSERT INTO notes (title, body, tags, category, created_at, updated_at) VALUES (?,?,?,?,?,?)",
                (title, body, tags_s, category, now, now))
    conn.commit(); nid = cur.lastrowid; conn.close()
    return nid

def list_notes(limit=100):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT id,title,tags,category,created_at FROM notes ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

def get_note(note_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
    r = cur.fetchone(); conn.close()
    return dict(r) if r else None

def search_notes(q, limit=50):
    # simple LIKE search on title and body; can be replaced with FTS later
    like = f"%{q}%"
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT id,title,tags,category,created_at FROM notes WHERE title LIKE ? OR body LIKE ? ORDER BY created_at DESC LIMIT ?",
                (like, like, limit))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

# ---------- Procurement helpers ----------
def save_supplier(name, product="", contact="", category="", notes=""):
    now = datetime.utcnow().isoformat()
    conn = get_conn(); cur = conn.cursor()
    cur.execute("INSERT INTO suppliers (name, contact, category, notes, created_at) VALUES (?,?,?,?,?)",
                (name, contact, category, notes, now))
    conn.commit(); sid = cur.lastrowid; conn.close()
    return sid

def list_suppliers(limit=200):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT * FROM suppliers ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

def save_material(name, spec="", vendor_link="", notes=""):
    now = datetime.utcnow().isoformat()
    conn = get_conn(); cur = conn.cursor()
    cur.execute("INSERT INTO materials (name,spec,vendor_link,notes,created_at) VALUES (?,?,?,?,?)",
                (name,spec,vendor_link,notes,now))
    conn.commit(); mid = cur.lastrowid; conn.close()
    return mid

def list_materials(limit=200):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT * FROM materials ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

def log_purchase(date, material_name, vendor, qty, price, invoice="", notes=""):
    now = datetime.utcnow().isoformat()
    conn = get_conn(); cur = conn.cursor()
    cur.execute("INSERT INTO purchases (date,material_name,vendor,qty,price,invoice,notes,created_at) VALUES (?,?,?,?,?,?,?,?)",
                (date, material_name, vendor, qty, price, invoice, notes, now))
    conn.commit(); pid = cur.lastrowid; conn.close()
    return pid

def list_purchases(limit=200):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT * FROM purchases ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

# ---------- Files & interactions ----------
def save_file(filename, filepath, source_url=None, metadata=None):
    now = datetime.utcnow().isoformat()
    meta_json = json.dumps(metadata) if metadata else None
    conn = get_conn(); cur = conn.cursor()
    cur.execute("INSERT INTO files (filename, filepath, source_url, metadata, created_at) VALUES (?,?,?,?,?)",
                (filename, filepath, source_url, meta_json, now))
    conn.commit(); fid = cur.lastrowid; conn.close()
    return fid

def log_interaction(actor, text, context=None):
    now = datetime.utcnow().isoformat()
    ctx_json = json.dumps(context) if context else None
    conn = get_conn(); cur = conn.cursor()
    cur.execute("INSERT INTO interactions (actor,text,context,created_at) VALUES (?,?,?,?)",
                (actor, text, ctx_json, now))
    conn.commit(); iid = cur.lastrowid; conn.close()
    return iid

# ---------- R&D projects & tasks ----------
def create_project(name, owner="", status="active"):
    now = datetime.utcnow().isoformat()
    conn = get_conn(); cur = conn.cursor()
    cur.execute("INSERT INTO projects (name, owner, status, created_at) VALUES (?,?,?,?)",
                (name, owner, status, now))
    conn.commit(); pid = cur.lastrowid; conn.close()
    return pid

def list_projects(limit=200):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT * FROM projects ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close();
    return rows

def get_project(pid):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT * FROM projects WHERE id=?", (pid,))
    r = cur.fetchone(); conn.close()
    return dict(r) if r else None

def update_project(pid, name=None, owner=None, status=None):
    fields = []
    vals = []
    if name is not None:
        fields.append("name=?"); vals.append(name)
    if owner is not None:
        fields.append("owner=?"); vals.append(owner)
    if status is not None:
        fields.append("status=?"); vals.append(status)
    if not fields:
        return False
    vals.append(pid)
    conn = get_conn(); cur = conn.cursor()
    cur.execute(f"UPDATE projects SET {', '.join(fields)} WHERE id=?", vals)
    conn.commit(); conn.close()
    return True

def delete_project(pid):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("DELETE FROM tasks WHERE project_id=?", (pid,))
    cur.execute("DELETE FROM projects WHERE id=?", (pid,))
    conn.commit(); conn.close()
    return True

def create_task(project_id, title, assignee="", state="todo", due_date=None):
    now = datetime.utcnow().isoformat()
    conn = get_conn(); cur = conn.cursor()
    cur.execute("INSERT INTO tasks (project_id,title,state,assignee,due_date,created_at) VALUES (?,?,?,?,?,?)",
                (project_id, title, state, assignee, due_date, now))
    conn.commit(); tid = cur.lastrowid; conn.close()
    return tid

def list_tasks(project_id, limit=200):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT * FROM tasks WHERE project_id=? ORDER BY id LIMIT ?", (project_id, limit))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close();
    return rows

def update_task(tid, title=None, state=None, assignee=None, due_date=None):
    fields = []
    vals = []
    if title is not None:
        fields.append("title=?"); vals.append(title)
    if state is not None:
        fields.append("state=?"); vals.append(state)
    if assignee is not None:
        fields.append("assignee=?"); vals.append(assignee)
    if due_date is not None:
        fields.append("due_date=?"); vals.append(due_date)
    if not fields:
        return False
    vals.append(tid)
    conn = get_conn(); cur = conn.cursor()
    cur.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id=?", vals)
    conn.commit(); conn.close()
    return True

def delete_task(tid):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("DELETE FROM tasks WHERE id=?", (tid,))
    conn.commit(); conn.close()
    return True
