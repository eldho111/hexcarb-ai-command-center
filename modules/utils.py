# modules/utils.py
import os
import pickle
import subprocess
import time
from pathlib import Path

DATA_DIR = str(Path(__file__).parent.parent / "data")

# Ollama runner (safe)
def run_ollama(prompt, model="mistral", timeout=120):
    try:
        cmd = ["ollama", "run", model, prompt]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if proc.returncode != 0:
            return f"[Error] Ollama failed: {proc.stderr.strip()}"
        return proc.stdout.strip()
    except FileNotFoundError:
        return "[Error] 'ollama' not found. Make sure Ollama is installed and in PATH."
    except subprocess.TimeoutExpired:
        return "[Error] Ollama call timed out."

# FAISS & embeddings helpers (lazy; require sentence-transformers + faiss)
def load_faiss_and_data(index_path=os.path.join(DATA_DIR, "faiss.index"),
                        chunks_path=os.path.join(DATA_DIR, "vector_chunks.pkl")):
    try:
        import faiss
        if not os.path.exists(index_path) or not os.path.exists(chunks_path):
            return None, None
        index = faiss.read_index(index_path)
        with open(chunks_path, "rb") as fh:
            data = pickle.load(fh)
        return index, data
    except Exception:
        return None, None

def get_embedder(embed_model_name="all-MiniLM-L6-v2"):
    try:
        from sentence_transformers import SentenceTransformer
        return SentenceTransformer(embed_model_name)
    except Exception:
        return None

def retrieve_from_index(query, index, data, k=3, embed_model_name="all-MiniLM-L6-v2"):
    if index is None or data is None:
        return []
    embedder = get_embedder(embed_model_name)
    if embedder is None:
        return []
    qv = embedder.encode([query], convert_to_numpy=True)
    try:
        D, I = index.search(qv, k)
    except Exception:
        return []
    results = []
    for idx in I[0]:
        results.append({"source": data["sources"][idx], "text": data["chunks"][idx]})
    return results

def assemble_rag_prompt(question, retrieved, memory_text=""):
    parts = []
    if memory_text:
        parts.append("Recent conversation:\n" + memory_text + "\n---\n")
    ctx = ""
    for r in retrieved:
        ctx += f"Source: {r['source']}\n{r['text']}\n---\n"
    parts.append("Context:\n" + ctx)
    parts.append("Question:\n" + question + "\nAnswer concisely and cite sources when appropriate.")
    prompt = "\n\n".join(parts)
    # keep prompt size bounded
    if len(prompt) > 12000:
        prompt = prompt[-12000:]
    return prompt
