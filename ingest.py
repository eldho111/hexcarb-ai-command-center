# ingest.py  -- minimal local PDF -> FAISS ingestion for Hexcarb R&D
import os
import sys
import pickle
from pathlib import Path
from tqdm import tqdm

# choose PyPDF2 or pymupdf (pymupdf faster if installed)
try:
    from PyPDF2 import PdfReader
    def extract_pdf_text(path):
        txt = []
        reader = PdfReader(path)
        for page in reader.pages:
            p = page.extract_text() or ""
            if p:
                txt.append(p)
        return "\n".join(txt)
except Exception:
    try:
        import fitz
        def extract_pdf_text(path):
            doc = fitz.open(path)
            txt = []
            for page in doc:
                t = page.get_text()
                if t:
                    txt.append(t)
            return "\n".join(txt)
    except Exception as e:
        raise RuntimeError("Install PyPDF2 or pymupdf (fitz). Error: " + str(e))

from sentence_transformers import SentenceTransformer
import numpy as np
import faiss

# CONFIG
DATA_DIR = Path("data")
RAW_DIR = DATA_DIR / "raw"
VECTOR_INDEX_PATH = DATA_DIR / "faiss.index"
CHUNKS_PATH = DATA_DIR / "chunks.pkl"
EMBED_MODEL_NAME = "all-MiniLM-L6-v2"
CHUNK_WORDS = 300    # ~300 words per chunk
DEVICE = "cpu"       # keep CPU by default

def chunk_text(text, words=CHUNK_WORDS):
    tokens = text.split()
    if not tokens:
        return []
    chunks = []
    for i in range(0, len(tokens), words):
        chunks.append(" ".join(tokens[i:i+words]))
    return chunks

def ingest_pdfs(pdf_paths):
    DATA_DIR.mkdir(exist_ok=True)
    RAW_DIR.mkdir(exist_ok=True)
    model = SentenceTransformer(EMBED_MODEL_NAME)

    all_chunks = []
    sources = []

    print(f"[ingest] processing {len(pdf_paths)} pdf(s)...")
    for p in tqdm(pdf_paths):
        p = Path(p)
        if not p.exists():
            print("[warn] missing:", p)
            continue
        text = extract_pdf_text(str(p))
        if not text.strip():
            print("[warn] no text extracted:", p.name)
            continue
        chunks = chunk_text(text)
        for i, c in enumerate(chunks):
            all_chunks.append(c)
            sources.append(f"{p.name}:chunk{i}")

    if not all_chunks:
        print("[ingest] no chunks found. Exiting.")
        return False

    print("[ingest] computing embeddings (this may take a minute)...")
    embeddings = model.encode(all_chunks, show_progress_bar=True, convert_to_numpy=True)

    dim = embeddings.shape[1]
    index = faiss.IndexFlatL2(dim)
    index.add(embeddings)

    # persist
    faiss.write_index(index, str(VECTOR_INDEX_PATH))
    with open(CHUNKS_PATH, "wb") as fh:
        pickle.dump({"chunks": all_chunks, "sources": sources}, fh)

    print(f"[ingest] saved index ({len(all_chunks)} chunks) -> {VECTOR_INDEX_PATH}")
    return True

def load_index():
    if not VECTOR_INDEX_PATH.exists() or not CHUNKS_PATH.exists():
        return None, None
    index = faiss.read_index(str(VECTOR_INDEX_PATH))
    with open(CHUNKS_PATH, "rb") as fh:
        d = pickle.load(fh)
    return index, d

def search(query, top_k=3, model=None, index=None, data=None):
    if model is None:
        model = SentenceTransformer(EMBED_MODEL_NAME)
    if index is None or data is None:
        index, data = load_index()
    if index is None:
        raise RuntimeError("Index not found. Run ingest first.")
    qv = model.encode([query], convert_to_numpy=True)
    D, I = index.search(qv, top_k)
    results = []
    for idx in I[0]:
        results.append({"source": data["sources"][idx], "text": data["chunks"][idx], "score": float(D[0][list(I[0]).index(idx)])})
    return results

if __name__ == "__main__":
    # Basic CLI usage:
    # python ingest.py ingest path/to/pdf1.pdf path/to/pdf2.pdf
    # python ingest.py search "my query"
    if len(sys.argv) < 2:
        print("Usage:\n  python ingest.py ingest <pdf1> <pdf2> ...\n  python ingest.py search \"your question\"")
        sys.exit(1)

    cmd = sys.argv[1].lower()
    if cmd == "ingest":
        pdfs = sys.argv[2:]
        if not pdfs:
            # auto-find PDFs in data/raw
            pdfs = [str(p) for p in (RAW_DIR.glob("*.pdf"))]
            if not pdfs:
                print("No PDFs provided and none found in data/raw/ . Place PDFs in data/raw or pass paths.")
                sys.exit(1)
        ok = ingest_pdfs(pdfs)
        sys.exit(0 if ok else 2)
    elif cmd == "search":
        q = " ".join(sys.argv[2:])
        idx, data = load_index()
        if idx is None:
            print("Index not found. Run ingest first.")
            sys.exit(2)
        res = search(q, top_k=3, model=SentenceTransformer(EMBED_MODEL_NAME), index=idx, data=data)
        for r in res:
            print("SOURCE:", r["source"])
            print(r["text"][:800].strip().replace("\n", " "))
            print("----")
        sys.exit(0)
    else:
        print("Unknown command:", cmd)
        sys.exit(1)
