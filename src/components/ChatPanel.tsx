"use client";

import React, { useEffect, useRef, useState } from "react";

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
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<ChatMeta | null>(null);
  const [citations, setCitations] = useState<string[]>([]);
  const [citationsOpen, setCitationsOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
    setCitationsOpen(false);

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

    const ct = resp.headers.get("content-type") || "";
    if (!ct.includes("application/x-ndjson")) {
      try {
        const textBody = await resp.text();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: textBody } : m,
          ),
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
          const delta = String(obj?.delta ?? obj?.content ?? "");
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
          const finalText = String(obj?.final ?? obj?.content ?? "");
          const cites = Array.isArray(obj?.citations)
            ? (obj.citations as unknown[]).map((c) => String(c))
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
      () => {},
      abort.signal,
    );

    setRunning(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <section
      className="hc-card flex flex-col overflow-hidden"
      style={{ minHeight: 520 }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid var(--hc-border)" }}
      >
        <div>
          <div
            className="text-sm font-semibold"
            style={{ color: "var(--hc-heading)" }}
          >
            Cited Chat
          </div>
          <div className="text-xs" style={{ color: "var(--hc-text-muted)" }}>
            Streams NDJSON from{" "}
            <span className="font-mono">/chat_stream</span>
          </div>
        </div>
        {running && (
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full"
              style={{ background: "var(--hc-active)" }}
            />
            <span
              className="text-xs font-medium"
              style={{ color: "var(--hc-active)" }}
            >
              Streaming
            </span>
          </div>
        )}
      </div>

      {/* ── Messages ────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-5"
        style={{ maxHeight: 480 }}
      >
        {!hasMessages && (
          <div className="flex h-full flex-col items-center justify-center py-16">
            {/* Hex pattern background hint */}
            <div className="relative mb-6">
              <svg
                width="64"
                height="64"
                viewBox="0 0 64 64"
                fill="none"
                style={{ opacity: 0.15 }}
              >
                <path
                  d="M32 2L58 17V47L32 62L6 47V17L32 2Z"
                  stroke="var(--hc-accent)"
                  strokeWidth="2"
                />
                <path
                  d="M32 14L46 22V38L32 46L18 38V22L32 14Z"
                  stroke="var(--hc-accent)"
                  strokeWidth="1.5"
                />
                <path
                  d="M32 24L38 28V36L32 40L26 36V28L32 24Z"
                  stroke="var(--hc-accent)"
                  strokeWidth="1"
                />
              </svg>
            </div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--hc-text-muted)" }}
            >
              Start a conversation with HexCarb AI
            </p>
            <p
              className="mt-1 text-xs"
              style={{ color: "var(--hc-text-muted)", opacity: 0.6 }}
            >
              Ask grounded questions with citations from indexed sources
            </p>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[75%]"
                  : "mr-auto max-w-[75%]"
              }
            >
              <div
                className="rounded-2xl px-4 py-3 text-sm"
                style={
                  m.role === "user"
                    ? {
                        background: "var(--hc-primary)",
                        color: "#fff",
                      }
                    : {
                        background: "var(--hc-card-bg)",
                        border: "1px solid var(--hc-border)",
                        borderLeft: "3px solid var(--hc-accent)",
                        color: "var(--hc-text)",
                      }
                }
              >
                <div
                  className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
                  style={{
                    color:
                      m.role === "user"
                        ? "var(--hc-text-inverse-muted)"
                        : "var(--hc-accent)",
                  }}
                >
                  {m.role === "user" ? "You" : "HexCarb AI"}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">
                  {m.content}
                  {m.role === "assistant" && running && m.content === "" && (
                    <span
                      className="inline-block h-4 w-1 animate-pulse"
                      style={{
                        background: "var(--hc-accent)",
                        borderRadius: 1,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Meta Badges ─────────────────────────────────────────── */}
      {meta && (
        <div
          className="flex flex-wrap gap-2 px-5 py-2"
          style={{ borderTop: "1px solid var(--hc-border)" }}
        >
          {meta.model && (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                background: "var(--hc-bg-soft)",
                color: "var(--hc-text-muted)",
              }}
            >
              Model:{" "}
              <span className="font-mono" style={{ color: "var(--hc-text)" }}>
                {meta.model}
              </span>
            </span>
          )}
          {meta.selected_provider && (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                background: "var(--hc-bg-soft)",
                color: "var(--hc-text-muted)",
              }}
            >
              Provider:{" "}
              <span className="font-mono" style={{ color: "var(--hc-text)" }}>
                {meta.selected_provider}
              </span>
            </span>
          )}
          {typeof meta.latency_ms === "number" && (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                background: "var(--hc-bg-soft)",
                color: "var(--hc-text-muted)",
              }}
            >
              Latency:{" "}
              <span className="font-mono" style={{ color: "var(--hc-text)" }}>
                {meta.latency_ms}ms
              </span>
            </span>
          )}
          {typeof meta.retrieval_count === "number" && (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                background: "var(--hc-bg-soft)",
                color: "var(--hc-green)",
              }}
            >
              Retrieval:{" "}
              <span className="font-mono">{meta.retrieval_count}</span>
            </span>
          )}
          {typeof meta.citation_count === "number" && (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                background: "var(--hc-bg-soft)",
                color: "var(--hc-accent)",
              }}
            >
              Citations:{" "}
              <span className="font-mono">{meta.citation_count}</span>
            </span>
          )}
          {meta.warning && (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                background: "rgba(245,100,84,0.1)",
                color: "var(--hc-active)",
              }}
            >
              {meta.warning}
            </span>
          )}
        </div>
      )}

      {/* ── Citations (collapsible) ─────────────────────────────── */}
      {citations.length > 0 && (
        <div className="px-5 pb-2">
          <button
            type="button"
            onClick={() => setCitationsOpen(!citationsOpen)}
            className="flex items-center gap-2 text-xs font-semibold"
            style={{ color: "var(--hc-accent)" }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{
                transform: citationsOpen ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform var(--dur-fast) var(--ease)",
              }}
            >
              <path
                d="M4 2L8 6L4 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {citations.length} Citation{citations.length !== 1 ? "s" : ""}
          </button>
          {citationsOpen && (
            <div
              className="mt-2 rounded-lg p-3"
              style={{
                background: "var(--hc-bg-soft)",
                borderLeft: "3px solid var(--hc-accent)",
              }}
            >
              <ul className="space-y-1">
                {citations.map((c, idx) => (
                  <li
                    key={`${c}_${idx}`}
                    className="break-all text-xs"
                    style={{ color: "var(--hc-text-muted)" }}
                  >
                    <span
                      className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                      style={{
                        background: "var(--hc-accent)",
                        color: "#fff",
                      }}
                    >
                      {idx + 1}
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────── */}
      {error && (
        <div className="px-5 pb-2">
          <div
            className="rounded-lg p-3 text-sm"
            style={{
              background: "rgba(245,100,84,0.08)",
              border: "1px solid var(--hc-active)",
              color: "var(--hc-active)",
            }}
          >
            {error}
          </div>
        </div>
      )}

      {/* ── Input ───────────────────────────────────────────────── */}
      <div
        className="flex items-end gap-3 px-5 py-4"
        style={{ borderTop: "1px solid var(--hc-border)" }}
      >
        <textarea
          ref={inputRef}
          className="flex-1 resize-none rounded-lg px-3 py-2.5 text-sm"
          style={{
            background: "var(--hc-bg)",
            border: "1px solid var(--hc-border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--hc-text)",
            minHeight: 44,
            maxHeight: 120,
            outline: "none",
            transition: "border-color var(--dur-fast) var(--ease)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--hc-accent-bright)";
            e.currentTarget.style.boxShadow =
              "0 0 0 2px rgba(142,106,53,0.25)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--hc-border)";
            e.currentTarget.style.boxShadow = "none";
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          spellCheck={false}
          rows={1}
        />
        {running ? (
          <button
            type="button"
            onClick={stop}
            className="hc-btn"
            style={{
              background: "var(--hc-active)",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="currentColor"
            >
              <rect x="2" y="2" width="10" height="10" rx="2" />
            </svg>
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void send()}
            disabled={!input.trim()}
            className="hc-btn hc-btn-primary"
            style={{
              flexShrink: 0,
              opacity: input.trim() ? 1 : 0.45,
              cursor: input.trim() ? "pointer" : "not-allowed",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L6 8" />
              <path d="M12 2L8 12L6 8L2 6L12 2Z" />
            </svg>
            Send
          </button>
        )}
      </div>
    </section>
  );
}
