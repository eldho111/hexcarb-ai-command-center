"""
modules/rd.py

R&D Module with:
 - add/list/search/searchsem/searchai
 - embedding-assisted topic suggestion and tagging
 - export csv / markdown

Public entrypoint: run(args, cfg)
"""

import os
import json
from datetime import datetime
from typing import List

# Attempt to import sentence-transformers and numpy
try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    _EMBED_AVAILABLE = True
except Exception:
    _EMBED_AVAILABLE = False

meta = {
    "name": "rd",
    "description": "Manage research notes (add, list, search, semantic search, tagging, export)"
}

# ---------------- paths ----------------
def data_dir(cfg):
    return cfg.get("paths", {}).get("data", "data")

def notes_file_path(cfg):
    p = os.path.join(data_dir(cfg), "rd_notes.json")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p

def embeddings_path(cfg):
    return os.path.join(data_dir(cfg), "rd_embeddings.npy")

def index_map_path(cfg):
    return os.path.join(data_dir(cfg), "rd_embeddings_index.json")

# --------------- persistence ---------------
def load_notes(cfg):
    path = notes_file_path(cfg)
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        try:
            bad_path = path + ".corrupt." + datetime.now().strftime("%Y%m%d_%H%M%S")
            os.rename(path, bad_path)
        except Exception:
            pass
        return []

def save_notes(cfg, notes: List[dict]):
    path = notes_file_path(cfg)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(notes, f, indent=2)

# --------------- embeddings helpers ---------------
def load_embeddings(cfg):
    if not _EMBED_AVAILABLE:
        return None, {}
    ep = embeddings_path(cfg)
    im = index_map_path(cfg)
    if not os.path.exists(ep) or not os.path.exists(im):
        return None, {}
    try:
        arr = np.load(ep)
        with open(im, "r", encoding="utf-8") as f:
            idx_map = json.load(f)
        return arr, idx_map
    except Exception:
        return None, {}

def save_embeddings(cfg, emb_array, index_map):
    if not _EMBED_AVAILABLE:
        return
    np.save(embeddings_path(cfg), emb_array)
    with open(index_map_path(cfg), "w", encoding="utf-8") as f:
        json.dump(index_map, f, indent=2)

def compute_embeddings(cfg, texts: List[str]):
    if not _EMBED_AVAILABLE:
        raise RuntimeError("sentence-transformers not available")
    model = SentenceTransformer(cfg.get("embed_model", "all-MiniLM-L6-v2"))
    emb = model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
    return emb

# --------------- predefined topics (editable) ---------------
# You can expand this list later. Keep concise descriptive topic strings.
_PREDEFINED_TOPICS = [
    "Mechanical properties",
    "Electrical conductivity",
    "Thermal stability",
    "Dispersion & processing",
    "CNT functionalization",
    "Sensor performance",
    "Composite integration",
    "Manufacturing / scale-up",
    "Electrochemical performance",
    "Material characterization"
]

# compute topic embeddings once (lazy)
_topic_embeddings_cached = None
def _get_topic_embeddings(cfg):
    global _topic_embeddings_cached
    if _topic_embeddings_cached is not None:
        return _topic_embeddings_cached
    if not _EMBED_AVAILABLE:
        return None
    try:
        model = SentenceTransformer(cfg.get("embed_model", "all-MiniLM-L6-v2"))
        emb = model.encode(_PREDEFINED_TOPICS, show_progress_bar=False, convert_to_numpy=True)
        _topic_embeddings_cached = emb
        return emb
    except Exception:
        return None

# --------------- core operations ---------------
def add_note(cfg, text: str, user_tags: List[str] = None):
    notes = load_notes(cfg)
    entry = {
        "timestamp": datetime.now().isoformat(),
        "text": text,
        "tags": user_tags or [],
        "topics": [],            # auto-filled suggestions
        "embedding_index": None  # pointer into embeddings array if any
    }
    notes.append(entry)
    save_notes(cfg, notes)

    # update embeddings if available
    if _EMBED_AVAILABLE:
        try:
            emb_arr, idx_map = load_embeddings(cfg)
            new_emb = compute_embeddings(cfg, [text])  # shape (1, dim)
            if emb_arr is None:
                emb_arr = new_emb
                idx_map = {"0": len(notes)-1}
                entry["embedding_index"] = 0
            else:
                emb_arr = np.vstack([emb_arr, new_emb])
                new_idx = int(emb_arr.shape[0]) - 1
                idx_map[str(new_idx)] = len(notes)-1
                entry["embedding_index"] = new_idx
            # save updated embedding and updated notes (with embedding index)
            save_embeddings(cfg, emb_arr, idx_map)
            # update the saved note embedding_index
            notes[-1]["embedding_index"] = entry["embedding_index"]
            # suggest topics (embedding-assisted)
            topic_embs = _get_topic_embeddings(cfg)
            if topic_embs is not None:
                # cosine similarity
                q = new_emb / (np.linalg.norm(new_emb, axis=1, keepdims=True) + 1e-10)
                tnorm = topic_embs / (np.linalg.norm(topic_embs, axis=1, keepdims=True) + 1e-10)
                sims = (q @ tnorm.T).reshape(-1)  # shape (num_topics,)
                # pick top 3 above threshold
                order = sims.argsort()[::-1]
                suggestions = []
                for idx in order[:3]:
                    if sims[idx] >= 0.45:  # threshold; tweak as needed
                        suggestions.append(_PREDEFINED_TOPICS[int(idx)])
                notes[-1]["topics"] = suggestions
                save_notes(cfg, notes)
        except Exception:
            # never block add - fall back gracefully
            pass

    return f"[R&D] Note saved: {text}"

def list_notes(cfg, show_tags=True):
    notes = load_notes(cfg)
    if not notes:
        return "[R&D] No notes found."
    out_lines = []
    for i, n in enumerate(notes, start=1):
        tags = ", ".join(n.get("tags", [])) if n.get("tags") else "—"
        topics = ", ".join(n.get("topics", [])) if n.get("topics") else "—"
        out_lines.append(f"{i}. [{n.get('timestamp')}] {n.get('text')}\n     tags: {tags} | topics: {topics}")
    return "\n".join(out_lines)

def search_notes(cfg, keyword: str):
    notes = load_notes(cfg)
    matches = [n for n in notes if keyword.lower() in n.get("text", "").lower() or keyword.lower() in " ".join(n.get("tags", [])).lower()]
    if not matches:
        return f"[R&D] No matches for '{keyword}'."
    out_lines = []
    for i, n in enumerate(matches, start=1):
        tags = ", ".join(n.get("tags", [])) if n.get("tags") else "—"
        topics = ", ".join(n.get("topics", [])) if n.get("topics") else "—"
        out_lines.append(f"{i}. [{n.get('timestamp')}] {n.get('text')}\n     tags: {tags} | topics: {topics}")
    return "\n".join(out_lines)

# semantic search (same as earlier)
def _cosine_similarity(a, b):
    an = a / (np.linalg.norm(a, axis=1, keepdims=True) + 1e-10)
    bn = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-10)
    return np.dot(an, bn.T)

def search_semantic(cfg, query: str, top_k: int = 5):
    if not _EMBED_AVAILABLE:
        return "[R&D] Semantic search not available. Install sentence-transformers."
    notes = load_notes(cfg)
    if not notes:
        return "[R&D] No notes available for semantic search."

    emb_arr, idx_map = load_embeddings(cfg)
    if emb_arr is None:
        # build embeddings for all notes
        texts = [n.get("text","") for n in notes]
        try:
            emb_arr = compute_embeddings(cfg, texts)
            idx_map = {str(i): i for i in range(len(texts))}
            save_embeddings(cfg, emb_arr, idx_map)
        except Exception as e:
            return f"[R&D] Failed to compute embeddings: {e}"

    try:
        model = SentenceTransformer(cfg.get("embed_model", "all-MiniLM-L6-v2"))
        q_emb = model.encode([query], convert_to_numpy=True)
    except Exception as e:
        return f"[R&D] Query embedding failed: {e}"

    sims = _cosine_similarity(emb_arr, q_emb).reshape(-1)
    ranked_idx = sims.argsort()[::-1]
    results = []
    for arr_idx in ranked_idx[:top_k]:
        note_idx = int(idx_map.get(str(int(arr_idx)), arr_idx))
        note = notes[note_idx]
        results.append({
            "score": float(sims[int(arr_idx)]),
            "note_index": note_idx,
            "timestamp": note.get("timestamp"),
            "text": note.get("text"),
            "tags": note.get("tags", []),
            "topics": note.get("topics", [])
        })
    out = [f"{i+1}. [score={r['score']:.3f}] [{r['timestamp']}] {r['text']} | tags: {', '.join(r['tags']) or '—'} | topics: {', '.join(r['topics']) or '—'}" for i, r in enumerate(results)]
    return "\n".join(out)

# offline summarizer (unchanged behavior)
def _offline_summary(matches: List[str], keyword: str):
    summary = f"[R&D AI] Found {len(matches)} notes containing '{keyword}':\n"
    for m in matches[:8]:
        snippet = m if len(m) <= 220 else m[:217] + "..."
        summary += f"- {snippet}\n"
    suggestions = "\nSuggested next steps:\n"
    suggestions += f"- Repeat key tests and capture exact parameters for '{keyword}'.\n"
    suggestions += "- Create summary statistics (mean, std) for repeat experiments.\n"
    suggestions += "- Cross-validate with procurement batch specs for material consistency.\n"
    return summary + suggestions

def ai_search_notes(cfg, keyword: str):
    notes = load_notes(cfg)
    sem_texts = []
    if _EMBED_AVAILABLE:
        sem = search_semantic(cfg, keyword, top_k=8)
        if isinstance(sem, str) and sem.startswith("[R&D]"):
            sem_texts = [n["text"] for n in notes if keyword.lower() in n.get("text","").lower()]
        else:
            # parse semantic lines to extract text portion
            for line in sem.splitlines():
                try:
                    text_part = line.split("] ", 2)[-1]
                    # remove tags part if present
                    text_part = text_part.split(" | tags:", 1)[0]
                    sem_texts.append(text_part)
                except Exception:
                    pass
    else:
        sem_texts = [n["text"] for n in notes if keyword.lower() in n.get("text","").lower()]

    if not sem_texts:
        return f"[R&D AI] No matches for '{keyword}'."

    summary = _offline_summary(sem_texts, keyword)
    note = ""
    if not bool(cfg.get("rd_ai_enabled", False)):
        note = "\n\n[NOTE] rd_ai_enabled is false in config. Enable with: config set rd_ai_enabled true"
    return summary + note

# -------------- export helpers --------------
def export_csv(cfg, outpath=None):
    notes = load_notes(cfg)
    if not notes:
        return "[R&D] No notes to export."
    import csv
    outpath = outpath or os.path.join(data_dir(cfg), "rd_notes_export.csv")
    with open(outpath, "w", newline='', encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["timestamp", "text", "tags", "topics"])
        for n in notes:
            writer.writerow([n.get("timestamp"), n.get("text"), "|".join(n.get("tags", [])), "|".join(n.get("topics", []))])
    return f"[R&D] Exported CSV to {outpath}"

def export_md(cfg, outpath=None):
    notes = load_notes(cfg)
    if not notes:
        return "[R&D] No notes to export."
    outpath = outpath or os.path.join(data_dir(cfg), "rd_notes_export.md")
    with open(outpath, "w", encoding="utf-8") as fh:
        for n in notes:
            fh.write(f"### {n.get('timestamp')}\n\n")
            fh.write(n.get("text") + "\n\n")
            tags = ", ".join(n.get("tags", [])) if n.get("tags") else "—"
            topics = ", ".join(n.get("topics", [])) if n.get("topics") else "—"
            fh.write(f"- tags: {tags}\n")
            fh.write(f"- topics: {topics}\n\n---\n\n")
    return f"[R&D] Exported Markdown to {outpath}"

# -------------- public run entrypoint --------------
def run(args, cfg):
    """
    Supported subcommands:
      add <text> [--tags tag1,tag2]     (note: UI will pass separate tag list instead)
      list
      search <keyword>
      searchsem <query>
      searchai <keyword>
      export csv [outpath]
      export md [outpath]
    """
    if not args:
        return "[R&D] Commands: add <text> [--tags], list, search <kw>, searchsem <q>, searchai <kw>, export csv, export md"

    cmd = args[0].lower()

    if cmd == "add":
        if len(args) < 2:
            return "[R&D] Usage: add <note text>"
        # Allow tags optionally passed like: add "<text>" "tag1,tag2"
        text = args[1]
        tags = []
        if len(args) >= 3:
            # if third arg is a comma-separated tag list
            tags = [t.strip() for t in args[2].split(",")] if args[2] else []
        return add_note(cfg, text, tags)

    elif cmd == "list":
        return list_notes(cfg)

    elif cmd == "search":
        if len(args) != 2:
            return "[R&D] Usage: search <keyword>"
        return search_notes(cfg, args[1])

    elif cmd == "searchsem":
        if len(args) < 2:
            return "[R&D] Usage: searchsem <query>"
        return search_semantic(cfg, " ".join(args[1:]), top_k=5)

    elif cmd == "searchai":
        if len(args) != 2:
            return "[R&D] Usage: searchai <keyword>"
        return ai_search_notes(cfg, args[1])

    elif cmd == "export":
        if len(args) >= 2 and args[1] == "csv":
            out = args[2] if len(args) >= 3 else None
            return export_csv(cfg, out)
        if len(args) >= 2 and args[1] == "md":
            out = args[2] if len(args) >= 3 else None
            return export_md(cfg, out)
        return "[R&D] Usage: export csv [outpath] | export md [outpath]"

    else:
        return "[R&D] Unknown command."
