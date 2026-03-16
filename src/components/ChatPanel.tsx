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
  resolved_model?: string;
  base_model?: string;
  adapter_version?: string;
  trainable?: boolean;
  resolved_handler?: string;
  fallback_chain?: string[];
  policy_version?: string;
  adapted_model_active?: boolean;
  uses_base_fallback?: boolean;
  selected_provider?: string;
  latency_ms?: number;
  retrieval_used?: boolean;
  retrieval_count?: number;
  citation_count?: number;
  warning?: string | null;
};

type EngineDependencyIssue = {
  name: string;
  status: string;
  detail: string | null;
};

type EngineRuntimeStatus = {
  mode: "ready" | "degraded" | "down" | "booting" | "unknown";
  recovery_hint: string | null;
  dependency_issues: EngineDependencyIssue[];
};

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeMode(value: unknown): EngineRuntimeStatus["mode"] {
  switch (value) {
    case "ready":
    case "degraded":
    case "down":
    case "booting":
      return value;
    default:
      return "unknown";
  }
}

function combineWarnings(...values: Array<string | null | undefined>): string | null {
  const parts = values.filter((value): value is string => Boolean(value && value.trim()));
  if (!parts.length) return null;
  return Array.from(new Set(parts)).join(" ");
}

function modeLabel(mode: EngineRuntimeStatus["mode"]): string {
  switch (mode) {
    case "ready":
      return "Ready";
    case "degraded":
      return "Degraded";
    case "down":
      return "Down";
    case "booting":
      return "Booting";
    default:
      return "Checking";
  }
}

function modeTheme(mode: EngineRuntimeStatus["mode"]): {
  color: string;
  border: string;
  background: string;
} {
  switch (mode) {
    case "ready":
      return {
        color: "var(--hc-green)",
        border: "rgba(78,124,116,0.24)",
        background: "rgba(78,124,116,0.12)",
      };
    case "degraded":
      return {
        color: "var(--hc-accent)",
        border: "rgba(142,106,53,0.24)",
        background: "rgba(142,106,53,0.12)",
      };
    case "down":
      return {
        color: "var(--hc-active)",
        border: "rgba(245,100,84,0.24)",
        background: "rgba(245,100,84,0.08)",
      };
    case "booting":
      return {
        color: "#52659a",
        border: "rgba(82,101,154,0.24)",
        background: "rgba(82,101,154,0.12)",
      };
    default:
      return {
        color: "var(--hc-text-muted)",
        border: "var(--hc-border)",
        background: "var(--hc-surface-chip)",
      };
  }
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<ChatMeta | null>(null);
  const [citations, setCitations] = useState<string[]>([]);
  const [citationsOpen, setCitationsOpen] = useState(false);
  const [streamingEnabled, setStreamingEnabled] = useState(false);
  const [engineStatus, setEngineStatus] = useState<EngineRuntimeStatus>({
    mode: "unknown",
    recovery_hint: null,
    dependency_issues: [],
  });

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    let mounted = true;

    async function loadStatus() {
      try {
        const resp = await fetch("/api/engine/status", {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!mounted || !resp.ok) {
          if (mounted) {
            setEngineStatus({
              mode: resp.ok ? "unknown" : "down",
              recovery_hint: resp.ok ? null : "Engine status endpoint is not responding.",
              dependency_issues: [],
            });
          }
          return;
        }

        const payload = (await resp.json().catch(() => null)) as unknown;
        const obj = asObject(payload);
        const startup = asObject(obj?.startup);
        const dependencies = asObject(obj?.dependencies);
        const dependencyIssues: EngineDependencyIssue[] = [];

        if (dependencies) {
          for (const [name, raw] of Object.entries(dependencies)) {
            const dep = asObject(raw);
            if (!dep) continue;
            const desired = dep.desired !== false;
            const status = String(dep.status || "unknown");
            if (!desired || ["up", "unmanaged_up", "optional_down"].includes(status)) {
              continue;
            }
            dependencyIssues.push({
              name,
              status,
              detail: asString(dep.detail),
            });
          }
        }

        if (!mounted) return;
        setEngineStatus({
          mode: normalizeMode(obj?.mode),
          recovery_hint: asString(startup?.recovery_hint) || asString(obj?.startup_hint),
          dependency_issues: dependencyIssues,
        });
      } catch {
        if (mounted) {
          setEngineStatus({
            mode: "down",
            recovery_hint: "Engine status endpoint is unreachable.",
            dependency_issues: [],
          });
        }
      }
    }

    void loadStatus();
    const interval = setInterval(() => {
      void loadStatus();
    }, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  function updateAssistantContent(assistantId: string, content: string) {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === assistantId ? { ...message, content } : message,
      ),
    );
  }

  function buildMeta(payload: Record<string, unknown>, extraWarning?: string | null): ChatMeta {
    const citationsValue = Array.isArray(payload.citations)
      ? payload.citations.map((item) => String(item))
      : [];
    const elapsedSec = typeof payload.elapsed_sec === "number" ? payload.elapsed_sec : null;
    return {
      model:
        typeof payload.routed_model === "string"
          ? payload.routed_model
          : typeof payload.model === "string"
            ? payload.model
            : undefined,
      resolved_model:
        typeof payload.resolved_model === "string"
          ? payload.resolved_model
          : typeof payload.routed_model === "string"
            ? payload.routed_model
            : typeof payload.model === "string"
              ? payload.model
              : undefined,
      base_model: typeof payload.base_model === "string" ? payload.base_model : undefined,
      adapter_version: typeof payload.adapter_version === "string" ? payload.adapter_version : undefined,
      trainable: typeof payload.trainable === "boolean" ? payload.trainable : undefined,
      resolved_handler:
        typeof payload.resolved_handler === "string" ? payload.resolved_handler : undefined,
      fallback_chain: Array.isArray(payload.fallback_chain)
        ? payload.fallback_chain.map((item) => String(item))
        : undefined,
      policy_version:
        typeof payload.policy_version === "string" ? payload.policy_version : undefined,
      adapted_model_active:
        typeof payload.adapted_model_active === "boolean"
          ? payload.adapted_model_active
          : undefined,
      uses_base_fallback:
        typeof payload.uses_base_fallback === "boolean"
          ? payload.uses_base_fallback
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
          : typeof elapsedSec === "number"
            ? Math.round(elapsedSec * 1000)
            : undefined,
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
          : citationsValue.length,
      warning: combineWarnings(asString(payload.warning), extraWarning),
    };
  }

  function applyFinalPayload(
    assistantId: string,
    payload: Record<string, unknown>,
    extraWarning?: string | null,
  ) {
    const finalText = String(payload.final ?? payload.answer ?? "");
    const cites = Array.isArray(payload.citations)
      ? payload.citations.map((item) => String(item))
      : [];
    updateAssistantContent(assistantId, finalText);
    setCitations(cites);
    setMeta(buildMeta(payload, extraWarning));
  }

  async function sendJsonConversation(
    text: string,
    assistantId: string,
    signal: AbortSignal,
    extraWarning?: string | null,
  ): Promise<void> {
    let resp: Response;
    try {
      resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ message: text, model_hint: "chat" }),
        signal,
        cache: "no-store",
      });
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : String(err));
    }

    if (!resp.ok) {
      try {
        const payload = (await resp.json()) as unknown;
        const obj = asObject(payload);
        throw new Error(String(obj?.error || obj?.message || `HTTP ${resp.status}`));
      } catch (err) {
        if (err instanceof Error) throw err;
        throw new Error(`HTTP ${resp.status}`);
      }
    }

    const payload = (await resp.json().catch(() => null)) as unknown;
    const obj = asObject(payload);
    if (!obj) {
      throw new Error("Unexpected response format.");
    }

    applyFinalPayload(assistantId, obj, extraWarning);
  }

  async function sendStreamingConversation(
    text: string,
    assistantId: string,
    signal: AbortSignal,
  ): Promise<string | null> {
    let resp: Response;
    try {
      resp = await fetch("/api/engine/chat_stream", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ message: text }),
        signal,
        cache: "no-store",
      });
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }

    if (!resp.ok) {
      try {
        const payload = (await resp.json()) as unknown;
        const obj = asObject(payload);
        return String(obj?.error || obj?.message || `HTTP ${resp.status}`);
      } catch {
        return `HTTP ${resp.status}`;
      }
    }

    if (!resp.body) {
      return "stream body unavailable";
    }

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("application/x-ndjson")) {
      return "stream returned a non-NDJSON response";
    }

    let finalSeen = false;
    let streamFailure: string | null = null;

    await streamNdjson(
      resp.body,
      (item) => {
        const obj = asObject(item);
        const type = String(obj?.type || "");

        if (type === "delta") {
          const delta = String(obj?.delta ?? obj?.content ?? "");
          if (!delta) return;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: (message.content || "") + delta }
                : message,
            ),
          );
          return;
        }

        if (type === "final") {
          finalSeen = true;
          const finalText = String(obj?.final ?? obj?.content ?? "");
          const cites = Array.isArray(obj?.citations)
            ? obj.citations.map((item) => String(item))
            : [];
          updateAssistantContent(assistantId, finalText);
          setCitations(cites);
          return;
        }

        if (type === "meta") {
          setMeta({
            model: typeof obj?.model === "string" ? obj.model : undefined,
            resolved_model:
              typeof obj?.resolved_model === "string" ? obj.resolved_model : undefined,
            base_model: typeof obj?.base_model === "string" ? obj.base_model : undefined,
            adapter_version:
              typeof obj?.adapter_version === "string" ? obj.adapter_version : undefined,
            trainable: typeof obj?.trainable === "boolean" ? obj.trainable : undefined,
            resolved_handler:
              typeof obj?.resolved_handler === "string" ? obj.resolved_handler : undefined,
            fallback_chain: Array.isArray(obj?.fallback_chain)
              ? obj.fallback_chain.map((item) => String(item))
              : undefined,
            policy_version:
              typeof obj?.policy_version === "string" ? obj.policy_version : undefined,
            adapted_model_active:
              typeof obj?.adapted_model_active === "boolean"
                ? obj.adapted_model_active
                : undefined,
            uses_base_fallback:
              typeof obj?.uses_base_fallback === "boolean"
                ? obj.uses_base_fallback
                : undefined,
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
          streamFailure = String(obj?.message || obj?.error || "stream_error");
        }
      },
      () => {
        streamFailure = streamFailure || "stream_parse_error";
      },
      signal,
    );

    if (signal.aborted) {
      return null;
    }
    if (streamFailure) {
      return streamFailure;
    }
    if (!finalSeen) {
      return "stream ended before a final answer arrived";
    }
    return null;
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

    try {
      if (streamingEnabled) {
        const fallbackReason = await sendStreamingConversation(text, assistantId, abort.signal);
        if (!abort.signal.aborted && fallbackReason) {
          await sendJsonConversation(
            text,
            assistantId,
            abort.signal,
            `Streaming transport fell back to /api/chat. ${fallbackReason}`,
          );
        }
      } else {
        await sendJsonConversation(text, assistantId, abort.signal);
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    } finally {
      if (abortRef.current === abort) {
        abortRef.current = null;
      }
      setRunning(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const hasMessages = messages.length > 0;
  const theme = modeTheme(engineStatus.mode);
  const shouldShowRuntimeBanner =
    engineStatus.mode !== "ready" ||
    Boolean(engineStatus.recovery_hint) ||
    engineStatus.dependency_issues.length > 0;

  return (
    <section
      className="hc-card flex flex-col overflow-hidden"
      style={{ minHeight: 520 }}
    >
      <div
        className="flex flex-wrap items-start justify-between gap-3 px-5 py-3"
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
            Uses the stable <span className="font-mono">/api/chat</span> route
            for normal conversation and can opt into the compatibility
            <span className="font-mono"> /api/engine/chat_stream</span> transport.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStreamingEnabled((value) => !value)}
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              border: `1px solid ${streamingEnabled ? theme.border : "var(--hc-border)"}`,
              background: streamingEnabled ? theme.background : "var(--hc-surface-chip)",
              color: streamingEnabled ? theme.color : "var(--hc-text-muted)",
            }}
          >
            {streamingEnabled ? "Streaming on" : "Streaming off"}
          </button>

          {running ? (
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 animate-pulse rounded-full"
                style={{ background: "var(--hc-active)" }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: "var(--hc-active)" }}
              >
                {streamingEnabled ? "Streaming" : "Thinking"}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {shouldShowRuntimeBanner ? (
        <div
          className="space-y-3 px-5 py-3"
          style={{
            borderBottom: "1px solid var(--hc-border)",
            background: "var(--hc-surface-elevated)",
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{
                background: theme.background,
                border: `1px solid ${theme.border}`,
                color: theme.color,
              }}
            >
              Engine {modeLabel(engineStatus.mode)}
            </span>
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                background: "var(--hc-bg-soft)",
                color: "var(--hc-text-muted)",
              }}
            >
              {streamingEnabled ? "Stream first, then fallback" : "Stable JSON primary"}
            </span>
            {engineStatus.dependency_issues.slice(0, 3).map((issue) => (
              <span
                key={`${issue.name}_${issue.status}`}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{
                  background: theme.background,
                  color: theme.color,
                }}
              >
                {issue.name}: {issue.status}
              </span>
            ))}
          </div>

          {engineStatus.recovery_hint ? (
            <p className="text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
              {engineStatus.recovery_hint}
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-5"
        style={{ maxHeight: 480 }}
      >
        {!hasMessages && (
          <div className="flex h-full flex-col items-center justify-center py-16">
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
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[75%]"
                  : "mr-auto max-w-[75%]"
              }
            >
              <div
                className="rounded-2xl px-4 py-3 text-sm"
                style={
                  message.role === "user"
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
                      message.role === "user"
                        ? "var(--hc-text-inverse-muted)"
                        : "var(--hc-accent)",
                  }}
                >
                  {message.role === "user" ? "You" : "HexCarb AI"}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">
                  {message.content}
                  {message.role === "assistant" && running && message.content === "" && (
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
              Model: <span className="font-mono" style={{ color: "var(--hc-text)" }}>{meta.model}</span>
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
              Provider: <span className="font-mono" style={{ color: "var(--hc-text)" }}>{meta.selected_provider}</span>
            </span>
          )}
          {meta.resolved_model && meta.resolved_model !== meta.model && (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                background: "var(--hc-bg-soft)",
                color: "var(--hc-text-muted)",
              }}
            >
              Resolved: <span className="font-mono" style={{ color: "var(--hc-text)" }}>{meta.resolved_model}</span>
            </span>
          )}
          {meta.base_model && meta.base_model !== meta.resolved_model && (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                background: "var(--hc-bg-soft)",
                color: "var(--hc-text-muted)",
              }}
            >
              Base: <span className="font-mono" style={{ color: "var(--hc-text)" }}>{meta.base_model}</span>
            </span>
          )}
          {(meta.adapter_version || meta.adapted_model_active) && (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                background: "var(--hc-bg-soft)",
                color: meta.adapted_model_active ? "var(--hc-green)" : "var(--hc-text-muted)",
              }}
            >
              Adapter: <span className="font-mono">{meta.adapter_version || (meta.adapted_model_active ? "active" : "base")}</span>
            </span>
          )}
          {meta.resolved_handler && (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                background: "var(--hc-bg-soft)",
                color: "var(--hc-accent)",
              }}
            >
              Handler: <span className="font-mono">{meta.resolved_handler}</span>
            </span>
          )}
          {(meta.uses_base_fallback || (meta.fallback_chain && meta.fallback_chain.length > 1)) && (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                background: "rgba(245,100,84,0.1)",
                color: "var(--hc-active)",
              }}
            >
              Fallback: <span className="font-mono">{meta.uses_base_fallback ? "base model" : meta.fallback_chain?.slice(1, 3).join(" -> ")}</span>
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
              Latency: <span className="font-mono" style={{ color: "var(--hc-text)" }}>{meta.latency_ms}ms</span>
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
              Retrieval: <span className="font-mono">{meta.retrieval_count}</span>
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
              Citations: <span className="font-mono">{meta.citation_count}</span>
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
                {citations.map((citation, idx) => (
                  <li
                    key={`${citation}_${idx}`}
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
                    {citation}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

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
