"use client";

import { useRef, useState } from "react";

import { streamNdjson } from "@/lib/stream";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatMeta = {
  model?: string;
  selected_provider?: string;
  latency_ms?: number;
  retrieval_used?: boolean;
  retrieval_count?: number;
  citation_count?: number;
  warning?: string | null;
};

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>("");
  const [meta, setMeta] = useState<ChatMeta | null>(null);
  const [citations, setCitations] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  async function send(): Promise<void> {
    const text = input.trim();
    if (!text || running) return;

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setRunning(true);
    setError("");
    setMeta(null);
    setCitations([]);

    const userMsg: ChatMessage = { id: uid("u"), role: "user", content: text };
    const assistantId = uid("a");
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");

    let resp: Response;
    try {
      resp = await fetch("/api/engine/chat_stream", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ message: text }),
        signal: abort.signal,
        cache: "no-store",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setRunning(false);
      return;
    }

    const ct = resp.headers.get("content-type") || "";
    if (!resp.ok) {
      try {
        const payload = (await resp.json()) as unknown;
        const obj = asObject(payload);
        setError(String(obj?.error || obj?.message || `HTTP ${resp.status}`));
      } catch {
        setError(`HTTP ${resp.status}`);
      }
      setRunning(false);
      return;
    }

    if (!resp.body) {
      setRunning(false);
      return;
    }

    if (!ct.includes("application/x-ndjson")) {
      try {
        const textBody = await resp.text();
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: textBody } : m)),
        );
      } catch {
        setError("Unexpected response format.");
      }
      setRunning(false);
      return;
    }

    await streamNdjson(
      resp.body,
      (item) => {
        const obj = asObject(item);
        const type = String(obj?.type || "");
        if (type === "delta") {
          const delta = String(obj?.delta || "");
          if (!delta) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: (m.content || "") + delta }
                : m,
            ),
          );
          return;
        }
        if (type === "final") {
          const finalText = String(obj?.final || "");
          const cites = Array.isArray(obj?.citations)
            ? (obj?.citations as unknown[]).map((c) => String(c))
            : [];
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: finalText } : m,
            ),
          );
          setCitations(cites);
          return;
        }
        if (type === "meta") {
          setMeta({
            model: typeof obj?.model === "string" ? obj.model : undefined,
            selected_provider:
              typeof obj?.selected_provider === "string"
                ? obj.selected_provider
                : undefined,
            latency_ms:
              typeof obj?.latency_ms === "number" ? obj.latency_ms : undefined,
            retrieval_used:
              typeof obj?.retrieval_used === "boolean"
                ? obj.retrieval_used
                : undefined,
            retrieval_count:
              typeof obj?.retrieval_count === "number"
                ? obj.retrieval_count
                : undefined,
            citation_count:
              typeof obj?.citation_count === "number"
                ? obj.citation_count
                : undefined,
            warning: typeof obj?.warning === "string" ? obj.warning : null,
          });
          return;
        }
        if (type === "error") {
          setError(String(obj?.message || obj?.error || "stream_error"));
          stop();
        }
      },
      () => {
        // Ignore non-JSON lines.
      },
      abort.signal,
    );

    setRunning(false);
  }

  return (
    <section className="hex-card overflow-hidden">
      <div className="border-b border-[var(--hex-border)] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Cited Chat</div>
            <div className="text-xs text-[var(--hex-ink-soft)]">
              Streams NDJSON from <span className="font-mono">/chat_stream</span>.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={send}
              disabled={running || !input.trim()}
              className="hex-button"
            >
              Send
            </button>
            <button
              type="button"
              onClick={stop}
              disabled={!running}
              className="hex-button-outline"
            >
              Stop
            </button>
          </div>
        </div>

        {meta ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--hex-ink-soft)]">
            {meta.model ? (
              <span className="hex-pill">model: {meta.model}</span>
            ) : null}
            {meta.selected_provider ? (
              <span className="hex-pill">provider: {meta.selected_provider}</span>
            ) : null}
            {typeof meta.latency_ms === "number" ? (
              <span className="hex-pill">latency: {meta.latency_ms}ms</span>
            ) : null}
            {typeof meta.retrieval_count === "number" ? (
              <span className="hex-pill">retrieval: {meta.retrieval_count}</span>
            ) : null}
            {typeof meta.citation_count === "number" ? (
              <span className="hex-pill">citations: {meta.citation_count}</span>
            ) : null}
            {meta.warning ? (
              <span className="hex-pill border-amber-200 bg-amber-50 text-amber-900">
                warning: {meta.warning}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4">
          <label className="hex-section-title">Message</label>
          <textarea
            className="hex-input mt-2 min-h-[88px] w-full"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about CNT experiments, literature, or status."
            spellCheck={false}
          />
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {error}
          </div>
        ) : null}
      </div>

      <div className="p-5">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="rounded-xl border border-[var(--hex-border)] bg-[var(--hex-panel-2)] p-4 text-sm text-[var(--hex-ink-muted)]">
              Send a message to begin.
            </div>
          ) : null}

          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[860px] rounded-2xl bg-[var(--hex-ink)] px-4 py-3 text-sm text-white"
                  : "mr-auto max-w-[860px] rounded-2xl border border-[var(--hex-border)] bg-white px-4 py-3 text-sm text-[var(--hex-ink)]"
              }
            >
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                {m.role}
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ))}
        </div>

        {citations.length > 0 ? (
          <div className="mt-5 rounded-2xl border border-[var(--hex-border)] bg-[var(--hex-panel-2)] p-4">
            <div className="text-xs font-semibold">Citations</div>
            <ul className="mt-2 list-disc pl-5 text-xs text-[var(--hex-ink-muted)]">
              {citations.slice(0, 12).map((c, idx) => (
                <li key={`${c}_${idx}`} className="break-all">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
