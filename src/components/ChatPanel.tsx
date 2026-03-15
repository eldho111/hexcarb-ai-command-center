"use client";

import { useEffect, useRef, useState } from "react";

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
  model_hint?: string | null;
};

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

async function readError(resp: Response): Promise<string> {
  try {
    const payload = (await resp.json()) as unknown;
    const obj = asObject(payload);
    return String(obj?.error || obj?.message || `HTTP ${resp.status}`);
  } catch {
    return `HTTP ${resp.status}`;
  }
}

function buildMeta(
  payload: Record<string, unknown>,
  modelHint: string | null,
): ChatMeta {
  const elapsed = typeof payload.elapsed_sec === "number"
    ? Math.round(payload.elapsed_sec * 1000)
    : undefined;
  return {
    model:
      typeof payload.model === "string"
        ? payload.model
        : typeof payload.routed_model === "string"
          ? payload.routed_model
          : undefined,
    selected_provider:
      typeof payload.selected_provider === "string"
        ? payload.selected_provider
        : typeof payload.provider === "string"
          ? payload.provider
          : undefined,
    latency_ms:
      typeof payload.latency_ms === "number"
        ? payload.latency_ms
        : elapsed,
    retrieval_used:
      typeof payload.retrieval_used === "boolean"
        ? payload.retrieval_used
        : undefined,
    retrieval_count:
      typeof payload.retrieval_count === "number"
        ? payload.retrieval_count
        : undefined,
    citation_count:
      typeof payload.citation_count === "number"
        ? payload.citation_count
        : undefined,
    warning: typeof payload.warning === "string" ? payload.warning : null,
    model_hint: modelHint,
  };
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>("");
  const [meta, setMeta] = useState<ChatMeta | null>(null);
  const [citations, setCitations] = useState<string[]>([]);
  const [pendingSince, setPendingSince] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!running || pendingSince === null) {
      setElapsedSec(0);
      return;
    }

    const updateElapsed = () => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - pendingSince) / 1000)));
    };

    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(intervalId);
  }, [pendingSince, running]);

  function stop() {
    abortRef.current?.abort();
    setPendingSince(null);
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
      content: "Thinking...",
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setPendingSince(Date.now());

    let resp: Response;
    try {
      resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ message: text, model_hint: "chat" }),
        signal: abort.signal,
        cache: "no-store",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPendingSince(null);
      setRunning(false);
      return;
    }

    if (!resp.ok) {
      setError(await readError(resp));
      setPendingSince(null);
      setRunning(false);
      return;
    }

    const payload = asObject((await resp.json()) as unknown);
    if (!payload) {
      setError("Unexpected response format.");
      setPendingSince(null);
      setRunning(false);
      return;
    }

    if (payload.ok === false) {
      setError(String(payload.error || payload.message || "chat_error"));
      setPendingSince(null);
      setRunning(false);
      return;
    }

    const finalText = String(payload.final || payload.answer || "");
    const cites = Array.isArray(payload.citations)
      ? payload.citations.map((item) => String(item))
      : [];
    const modelHint = resp.headers.get("x-hexcarb-chat-hint");

    setMessages((prev) =>
      prev.map((message) =>
        message.id === assistantId ? { ...message, content: finalText } : message,
      ),
    );
    setMeta(buildMeta(payload, modelHint));
    setCitations(cites);
    setPendingSince(null);
    setRunning(false);
  }

  return (
    <section className="hex-card overflow-hidden">
      <div className="border-b border-[var(--hex-border)] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Cited Chat</div>
            <div className="text-xs text-[var(--hex-ink-soft)]">
              Uses the stable <span className="font-mono">/api/chat</span> route
              and defaults to the legacy chat model path before falling back to
              lighter roles if needed.
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
            {meta.model_hint ? (
              <span className="hex-pill">hint: {meta.model_hint}</span>
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

        {running ? (
          <div className="mt-3 rounded-lg border border-[var(--hex-border)] bg-[var(--hex-surface)] px-3 py-2 text-xs text-[var(--hex-ink-soft)]">
            Working on the chat model... {elapsedSec}s
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
        <div className="hex-section-title">Conversation</div>
        <div className="mt-3 space-y-3">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--hex-border)] px-4 py-6 text-sm text-[var(--hex-ink-soft)]">
              Ask anything about the indexed corpus, active experiments, or model state.
            </div>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className={`rounded-2xl px-4 py-3 text-sm ${
                  message.role === "user"
                    ? "ml-auto max-w-[80%] bg-[var(--hex-panel-2)]"
                    : "max-w-[85%] border border-[var(--hex-border)] bg-white"
                }`}
              >
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--hex-ink-soft)]">
                  {message.role}
                </div>
                <div className="whitespace-pre-wrap text-[var(--hex-ink)]">
                  {message.content || (running && message.role === "assistant" ? "Thinking..." : "")}
                </div>
              </article>
            ))
          )}
        </div>

        {citations.length > 0 ? (
          <div className="mt-5">
            <div className="hex-section-title">Citations</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {citations.map((citation) => (
                <span key={citation} className="hex-pill font-mono text-[11px]">
                  {citation}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
