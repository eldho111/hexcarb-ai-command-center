"""
arxiv_fetcher.py

Simple arXiv watcher for SWCNT-related papers.
- Queries arXiv for keywords
- Stores metadata in local SQLite DB (data/arxiv_meta.db)
- Optionally downloads PDFs to data/raw/
- Optionally triggers ingest.py to update FAISS index

Usage:
  python arxiv_fetcher.py            # default run (auto-download off)
  python arxiv_fetcher.py --auto    # auto-download PDFs and ingest
  python arxiv_fetcher.py --days 7  # fetch last 7 days instead of default 30

Notes:
- arXiv API: http://export.arxiv.org/api/query
"""
import os
import sys
import sqlite3
import argparse
import time
from pathlib import Path
from datetime import datetime, timedelta
import hashlib
import requests
import feedparser
from tqdm import tqdm
import subprocess
import json

# -------- CONFIG --------
DATA_DIR = Path("data")
RAW_DIR = DATA_DIR / "raw"
DB_PATH = DATA_DIR / "arxiv_meta.db"
KEYWORDS = [
    '"single-walled carbon nanotube"',
    "SWCNT",
    '"single wall carbon nanotube"'
]
# Build search query (OR of keywords) and constrain categories if you want
ARXIV_QUERY_TEMPLATE = 'all:{kw}'  # we will join keywords with OR
ARXIV_API_BASE = "http://export.arxiv.org/api/query"

# How many results per query (arXiv pagination)
MAX_RESULTS = 50

# Where your ingest script lives (optional trigger)
INGEST_COMMAND = [sys.executable, "ingest.py", "ingest"]  # runs "python ingest.py ingest"

# -------- HELPERS --------
def ensure_dirs():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)

def get_db_conn():
    ensure_dirs()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS arxiv (
        id TEXT PRIMARY KEY,
        title TEXT,
        authors TEXT,
        summary TEXT,
        pdf_url TEXT,
        published TEXT,
        updated TEXT,
        doi TEXT,
        retrieved_at TEXT,
        local_path TEXT
    )
    """)
    conn.commit()
    return conn

def arxiv_query(search_query, start=0, max_results=50):
    q = {
        "search_query": search_query,
        "start": start,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending"
    }
    url = ARXIV_API_BASE + "?" + "&".join(f"{k}={requests.utils.quote(str(v))}" for k,v in q.items())
    feed = feedparser.parse(url)
    return feed

def build_search_string(days=30):
    # build OR query like: all:"keyword1" OR all:"keyword2"
    kws = []
    for kw in KEYWORDS:
        # wrap in parentheses if contains spaces
        kws.append(f'("{kw}")' if " " in kw else kw)
    # arXiv query language: use OR between terms; we use `OR` literal
    or_query = " OR ".join(kws)
    return or_query

def entry_id_from_feed(entry):
    # arXiv id is like 'http://arxiv.org/abs/2301.01234v1' -> take last part
    return entry.get("id", "").split("/")[-1]

def pdf_url_from_entry(entry):
    # feedparser gives links; choose link with type 'application/pdf' or fallback
    links = entry.get("links", [])
    for l in links:
        if l.get("type", "") == "application/pdf":
            return l.get("href")
    # fallback: construct pdf url from id
    eid = entry.get("id", "")
    if eid:
        return eid.replace("abs", "pdf") + ".pdf"
    return None

def hash_text(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def save_pdf(url, filename):
    """Download PDF (streaming) and return local path or None."""
    try:
        r = requests.get(url, stream=True, timeout=60)
        r.raise_for_status()
        total = int(r.headers.get("content-length", 0))
        with open(filename, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        return str(filename)
    except Exception as e:
        print("[pdf download error]", e, url)
        if os.path.exists(filename):
            try:
                os.remove(filename)
            except:
                pass
        return None

# -------- MAIN FETCHER --------
def fetch_new_arxiv(days=30, auto_download=False, auto_ingest=False):
    conn = get_db_conn()
    cur = conn.cursor()

    search_str = build_search_string(days=days)
    print("[search] query:", search_str)
    # We will fetch in pages (start at 0)
    start = 0
    new_count = 0
    while True:
        feed = arxiv_query(search_str, start=start, max_results=MAX_RESULTS)
        entries = feed.get("entries", [])
        if not entries:
            break
        for entry in entries:
            eid = entry_id_from_feed(entry)
            title = entry.get("title", "").replace("\n", " ").strip()
            summary = entry.get("summary", "").replace("\n", " ").strip()
            authors = ", ".join([a.get("name", "") for a in entry.get("authors", [])])
            pdf_url = pdf_url_from_entry(entry)
            published = entry.get("published", "")
            updated = entry.get("updated", "")
            doi = entry.get("arxiv_doi", "") or entry.get("doi", "")

            # skip if older than X days (optional)
            if days is not None and published:
                try:
                    pub_dt = datetime.strptime(published, "%Y-%m-%dT%H:%M:%SZ")
                    if pub_dt < datetime.utcnow() - timedelta(days=days):
                        continue
                except Exception:
                    pass

            # check if in DB
            cur.execute("SELECT id FROM arxiv WHERE id = ?", (eid,))
            if cur.fetchone():
                # existing, skip
                continue

            # new entry -> insert metadata row with local_path NULL for now
            cur.execute("""
                INSERT INTO arxiv (id, title, authors, summary, pdf_url, published, updated, doi, retrieved_at, local_path)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (eid, title, authors, summary, pdf_url, published, updated, doi, datetime.utcnow().isoformat(), None))
            conn.commit()
            new_count += 1
            print("[new] ", title)

            # optionally download the PDF
            if auto_download and pdf_url:
                fname = RAW_DIR / f"{eid}.pdf"
                p = save_pdf(pdf_url, fname)
                if p:
                    cur.execute("UPDATE arxiv SET local_path = ? WHERE id = ?", (str(p), eid))
                    conn.commit()
                    print("  -> saved pdf:", p)

        # arXiv: stop when fewer than page size returned
        if len(entries) < MAX_RESULTS:
            break
        start += MAX_RESULTS
        # be polite
        time.sleep(1)

    conn.close()
    print(f"[done] new items: {new_count}")
    # optionally trigger ingest
    if auto_ingest and new_count > 0:
        print("[ingest] calling ingest.py to update FAISS index...")
        try:
            subprocess.run(INGEST_COMMAND, check=True)
        except Exception as e:
            print("[ingest error]", e)

    return new_count

# -------- CLI --------
def main():
    parser = argparse.ArgumentParser(description="Fetch new arXiv SWCNT papers.")
    parser.add_argument("--auto", action="store_true", help="Auto-download PDFs and update DB.")
    parser.add_argument("--ingest", action="store_true", help="After download, run ingest.py to update FAISS.")
    parser.add_argument("--days", type=int, default=30, help="Look back X days (default 30).")
    args = parser.parse_args()

    ensure_dirs()
    auto_download = bool(args.auto)
    auto_ingest = bool(args.ingest)
    days = args.days

    print(f"[run] auto_download={auto_download} auto_ingest={auto_ingest} days={days}")
    new = fetch_new_arxiv(days=days, auto_download=auto_download, auto_ingest=auto_ingest)
    print("Finished. New papers added:", new)

if __name__ == "__main__":
    main()
