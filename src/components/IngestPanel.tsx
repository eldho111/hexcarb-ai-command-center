"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FileEntry = {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  result?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

async function readError(resp: Response): Promise<string> {
  try {
    const p = (await resp.json()) as unknown;
    if (isRecord(p)) return String(p.error || p.message || `HTTP ${resp.status}`);
  } catch { /* ignore */ }
  return `HTTP ${resp.status}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function IngestPanel() {
  const [sources, setSources] = useState<string[]>([]);
  const [indexCount, setIndexCount] = useState<number | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [serverPath, setServerPath] = useState("/workspace/hexcarb_runtime/docs");
  const [loading, setLoading] = useState(false);
  const [pathLoading, setPathLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      try {
        const [srcResp, idxResp] = await Promise.all([
          fetch("/api/engine/sources", { cache: "no-store", signal: abort.signal }),
          fetch("/api/engine/experiments/index_status", { cache: "no-store", signal: abort.signal }),
        ]);
        if (srcResp.ok) {
          const data = (await srcResp.json()) as unknown;
          if (isRecord(data) && Array.isArray(data.sources)) {
            setSources(data.sources as string[]);
          } else if (Array.isArray(data)) {
            setSources(data.map(String));
          }
        }
        if (idxResp.ok) {
          const idx = (await idxResp.json()) as unknown;
          if (isRecord(idx) && typeof idx.active_collection_count === "number") {
            setIndexCount(idx.active_collection_count);
          }
        }
      } catch (e) {
        if (!abort.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    return () => abort.abort();
  }, [success]);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const entries: FileEntry[] = Array.from(newFiles).map((f) => ({
      file: f,
      status: "pending" as const,
    }));
    setFiles((prev) => [...prev, ...entries]);
    setError("");
    setSuccess("");
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setError("");
    setSuccess("");
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] || "");
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  async function uploadFiles() {
    const pending = files.filter((f) => f.status === "pending");
    if (pending.length === 0) return;

    setLoading(true);
    setError("");
    setSuccess("");
    setFiles((prev) =>
      prev.map((f) => (f.status === "pending" ? { ...f, status: "uploading" as const } : f))
    );

    try {
      const items: { name: string; content_b64: string }[] = [];
      for (const entry of pending) {
        const b64 = await fileToBase64(entry.file);
        items.push({ name: entry.file.name, content_b64: b64 });
      }

      const resp = await fetch("/api/engine/ingest_files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
        cache: "no-store",
      });

      if (!resp.ok) {
        const errMsg = await readError(resp);
        setError(errMsg);
        setFiles((prev) =>
          prev.map((f) => f.status === "uploading" ? { ...f, status: "error" as const, result: errMsg } : f)
        );
        setLoading(false);
        return;
      }

      const result = (await resp.json()) as Record<string, unknown>;
      const results = Array.isArray(result.results) ? result.results : [];
      const totalChunks = (results as Record<string, unknown>[]).reduce(
        (sum: number, r: Record<string, unknown>) => sum + (typeof r.ingested_chunks === "number" ? r.ingested_chunks : 0), 0
      );

      setFiles((prev) =>
        prev.map((f) => f.status === "uploading" ? { ...f, status: "done" as const, result: "Indexed" } : f)
      );
      setSuccess(`Successfully ingested ${pending.length} file(s) into ${totalChunks} chunks.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setFiles((prev) =>
        prev.map((f) => f.status === "uploading" ? { ...f, status: "error" as const, result: msg } : f)
      );
    }
    setLoading(false);
  }

  async function ingestPath() {
    if (!serverPath.trim()) return;
    setPathLoading(true);
    setError("");
    setSuccess("");
    try {
      const resp = await fetch("/api/engine/ingest_path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: serverPath.trim() }),
        cache: "no-store",
      });
      if (!resp.ok) {
        setError(await readError(resp));
        setPathLoading(false);
        return;
      }
      const result = (await resp.json()) as Record<string, unknown>;
      const count = typeof result.ingested === "number" ? result.ingested : 0;
      const skipped = typeof result.skipped === "number" ? result.skipped : 0;
      setSuccess(`Server path ingest complete. ${count} file(s) ingested, ${skipped} skipped.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setPathLoading(false);
  }

  const pendingCount = files.filter((f) => f.status === "pending").length;

  return (
    <section className="space-y-5">
      {/* Status bar */}
      <div className="hc-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>Document Ingestion</div>
            <div className="text-xs" style={{ color: "var(--hc-text-muted)" }}>
              Upload documents to index them into the knowledge base for RAG-powered chat. Supports PDF, TXT, and MD files.
            </div>
          </div>
          {indexCount !== null ? (
            <span className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: "rgba(16,185,129,0.1)", color: "rgb(5,150,105)", border: "1px solid rgba(16,185,129,0.2)" }}>
              {indexCount.toLocaleString()} chunks indexed
            </span>
          ) : null}
        </div>
      </div>

      {/* Error / Success */}
      {error ? (
        <div className="rounded-lg px-4 py-3 text-sm"
          style={{ background: "rgba(245,100,84,0.08)", border: "1px solid rgba(245,100,84,0.3)", color: "rgb(220,60,50)" }}>
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg px-4 py-3 text-sm"
          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)", color: "rgb(5,150,105)" }}>
          {success}
        </div>
      ) : null}

      {/* File Upload Area */}
      <div className="hc-card p-5">
        <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--hc-text-muted)" }}>
          Upload from Browser
        </div>

        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-lg p-8 text-center transition-all"
          style={{
            border: `2px dashed ${dragOver ? "var(--hc-accent)" : "var(--hc-border)"}`,
            background: dragOver ? "rgba(99,102,241,0.05)" : "var(--hc-bg-soft)",
          }}
        >
          <svg className="mx-auto mb-3" width="40" height="40" viewBox="0 0 24 24" fill="none"
            style={{ color: dragOver ? "var(--hc-accent)" : "var(--hc-text-muted)" }}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="text-sm font-medium" style={{ color: "var(--hc-text)" }}>
            {dragOver ? "Drop files here" : "Drag & drop files here"}
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
            or click to browse &mdash; PDF, TXT, MD supported (max 50 MB each)
          </div>
        </div>

        <input ref={fileInputRef} type="file" multiple accept=".pdf,.txt,.md,.csv,.json,.tex"
          className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />

        {/* File list */}
        {files.length > 0 ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: "var(--hc-text-muted)" }}>
                {files.length} file(s) selected
              </span>
              <button onClick={clearFiles} className="text-xs transition-colors hover:underline"
                style={{ color: "var(--hc-text-muted)" }}>Clear all</button>
            </div>

            {files.map((entry, i) => (
              <div key={`${entry.file.name}-${i}`} className="flex items-center gap-3 rounded-lg px-3 py-2"
                style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: "var(--hc-text-muted)", flexShrink: 0 }}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm" style={{ color: "var(--hc-text)" }}>{entry.file.name}</div>
                  <div className="text-[10px]" style={{ color: "var(--hc-text-muted)" }}>{formatBytes(entry.file.size)}</div>
                </div>
                {entry.status === "pending" ? (
                  <span className="text-[10px] font-medium" style={{ color: "var(--hc-text-muted)" }}>Ready</span>
                ) : entry.status === "uploading" ? (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: "var(--hc-accent)" }} />
                ) : entry.status === "done" ? (
                  <span className="text-[10px] font-medium" style={{ color: "rgb(5,150,105)" }}>Indexed</span>
                ) : (
                  <span className="text-[10px] font-medium" style={{ color: "rgb(220,60,50)" }}>Failed</span>
                )}
                {entry.status === "pending" ? (
                  <button onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                    className="text-xs" style={{ color: "var(--hc-text-muted)" }} title="Remove">&#10005;</button>
                ) : null}
              </div>
            ))}

            {pendingCount > 0 ? (
              <button onClick={uploadFiles} disabled={loading} className="hc-btn hc-btn-primary mt-3 w-full text-sm">
                {loading ? (
                  <><span className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />Uploading &amp; indexing...</>
                ) : (
                  `Upload & Index ${pendingCount} file(s)`
                )}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Server Path Ingest */}
      <div className="hc-card p-5">
        <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--hc-text-muted)" }}>
          Ingest from Server Path
        </div>
        <div className="text-xs mb-3" style={{ color: "var(--hc-text-muted)" }}>
          Point to a folder on the RunPod engine host. All PDF, TXT, and MD files will be indexed.
        </div>
        <div className="flex gap-2">
          <input type="text"
            className="flex-1 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
            style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}
            value={serverPath} onChange={(e) => setServerPath(e.target.value)}
            placeholder="/workspace/hexcarb_runtime/docs" />
          <button onClick={ingestPath} disabled={pathLoading || !serverPath.trim()}
            className="hc-btn hc-btn-primary text-sm whitespace-nowrap">
            {pathLoading ? (
              <><span className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />Ingesting...</>
            ) : "Ingest Path"}
          </button>
        </div>
      </div>

      {/* Sources list */}
      {sources.length > 0 ? (
        <div className="hc-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--hc-text-muted)" }}>
            Indexed Sources ({sources.length})
          </div>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {sources.map((src, i) => (
              <div key={`${src}-${i}`} className="flex items-center gap-2 rounded px-3 py-1.5 text-xs font-mono"
                style={{ background: "var(--hc-bg-soft)", color: "var(--hc-text-muted)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color: "rgb(5,150,105)", flexShrink: 0 }}>
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="22,4 12,14.01 9,11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="truncate">{src}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
