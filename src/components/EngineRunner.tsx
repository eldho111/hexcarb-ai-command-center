"use client";

import React, { useMemo, useRef, useState } from "react";

import type { HttpMethod, QuickCall } from "@/lib/panels";
import { streamNdjson, streamSse, type SseEvent } from "@/lib/stream";

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const METHODS_WITH_BODY: HttpMethod[] = ["POST", "PUT", "PATCH"];

type StreamItem =
  | { kind: "ndjson"; item: unknown }
  | { kind: "sse"; event: SseEvent; parsed?: unknown }
  | { kind: "bad_line"; line: string };

function normalizeEnginePath(raw: string): string {
  let path = (raw || "").trim();
  if (!path) return "/health";
  if (path.startsWith("/api/engine")) {
    path = path.slice("/api/engine".length);
  }
  if (!path.startsWith("/")) path = "/" + path;
  return path;
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/* ── Simple JSON syntax coloring ──────────────────────────────── */
function colorizeJson(json: string): React.ReactNode[] {
  return json.split("\n").map((line, i) => (
    <span key={i}>
      {line}
      {i < json.split("\n").length - 1 ? "\n" : ""}
    </span>
  ));
}

export function EngineRunner(props: {
  title?: string;
  initialMethod?: HttpMethod;
  initialPath?: string;
  initialBody?: string;
  quickCalls?: QuickCall[];
}) {
  const {
    title,
    initialMethod = "GET",
    initialPath = "/health",
    initialBody = "{}",
    quickCalls = [],
  } = props;

  const [method, setMethod] = useState<HttpMethod>(initialMethod);
  const [path, setPath] = useState(initialPath);
  const [bodyText, setBodyText] = useState(initialBody);

  const [running, setRunning] = useState(false);
  const [statusLine, setStatusLine] = useState("");
  const [contentType, setContentType] = useState("");
  const [error, setError] = useState("");

  const [jsonOut, setJsonOut] = useState<unknown>(null);
  const [textOut, setTextOut] = useState("");
  const [streamItems, setStreamItems] = useState<StreamItem[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  const quickCallsById = useMemo(() => {
    const out = new Map<string, QuickCall>();
    for (const call of quickCalls) out.set(call.id, call);
    return out;
  }, [quickCalls]);

  async function runCall(call: {
    method: HttpMethod;
    path: string;
    body?: unknown;
  }): Promise<void> {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setRunning(true);
    setStatusLine("");
    setContentType("");
    setError("");
    setJsonOut(null);
    setTextOut("");
    setStreamItems([]);

    const normalized = normalizeEnginePath(call.path);
    const url = `/api/engine${normalized}`;
    const reqMethod = call.method.toUpperCase() as HttpMethod;

    let body: string | undefined;
    const headers = new Headers();

    if (METHODS_WITH_BODY.includes(reqMethod) && call.body !== undefined) {
      body = JSON.stringify(call.body);
      headers.set("content-type", "application/json; charset=utf-8");
    }

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: reqMethod,
        headers,
        body,
        signal: abort.signal,
        cache: "no-store",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setRunning(false);
      return;
    }

    setStatusLine(`${resp.status} ${resp.ok ? "OK" : "ERROR"}`);
    const ct = resp.headers.get("content-type") || "";
    setContentType(ct);

    const bodyStream = resp.body;
    if (!bodyStream) {
      setRunning(false);
      return;
    }

    if (ct.includes("application/x-ndjson")) {
      await streamNdjson(
        bodyStream,
        (item) => {
          setStreamItems((prev) => [...prev, { kind: "ndjson", item }]);
        },
        (bad) => {
          setStreamItems((prev) => [...prev, { kind: "bad_line", line: bad }]);
        },
        abort.signal,
      );
      setRunning(false);
      return;
    }

    if (ct.includes("text/event-stream")) {
      await streamSse(
        bodyStream,
        (evt) => {
          let parsed: unknown | undefined;
          const data = (evt.data || "").trim();
          if (data) {
            try {
              parsed = JSON.parse(data) as unknown;
            } catch {
              parsed = undefined;
            }
          }
          setStreamItems((prev) => [
            ...prev,
            { kind: "sse", event: evt, parsed },
          ]);
        },
        abort.signal,
      );
      setRunning(false);
      return;
    }

    if (ct.includes("application/json")) {
      try {
        const data = (await resp.json()) as unknown;
        setJsonOut(data);
        setRunning(false);
        return;
      } catch {
        // fall through to text
      }
    }

    try {
      const text = await resp.text();
      setTextOut(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }

    setRunning(false);
  }

  function cancel() {
    abortRef.current?.abort();
    setRunning(false);
  }

  function onRunManual() {
    setError("");
    const reqMethod = method;
    const normalized = normalizeEnginePath(path);

    let parsedBody: unknown | undefined;
    if (METHODS_WITH_BODY.includes(reqMethod)) {
      const trimmed = bodyText.trim();
      if (trimmed) {
        try {
          parsedBody = JSON.parse(trimmed) as unknown;
        } catch {
          setError("Body is not valid JSON.");
          return;
        }
      }
    }

    void runCall({ method: reqMethod, path: normalized, body: parsedBody });
  }

  function onQuickCall(id: string) {
    const call = quickCallsById.get(id);
    if (!call) return;
    setMethod(call.method);
    setPath(call.path);
    if (call.body !== undefined) setBodyText(prettyJson(call.body));
    void runCall({ method: call.method, path: call.path, body: call.body });
  }

  const streamPreview = streamItems.slice(-200);
  const showBody = METHODS_WITH_BODY.includes(method);
  const hasOutput =
    jsonOut !== null || textOut !== "" || streamItems.length > 0 || error !== "";

  return (
    <section>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div
        className="px-5 py-4"
        style={{ borderBottom: "1px solid var(--hc-border)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div
              className="text-sm font-semibold"
              style={{ color: "var(--hc-heading)" }}
            >
              {title || "API Runner"}
            </div>
            <div className="text-xs" style={{ color: "var(--hc-text-muted)" }}>
              Calls the engine through the server-side proxy at /api/engine/*.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRunManual}
              disabled={running}
              className="hc-btn hc-btn-primary"
              style={{ opacity: running ? 0.5 : 1 }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="currentColor"
              >
                <path d="M2 1L11 6L2 11V1Z" />
              </svg>
              Run
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={!running}
              className="hc-btn hc-btn-ghost"
              style={{ opacity: !running ? 0.4 : 1 }}
            >
              Cancel
            </button>
          </div>
        </div>

        {/* ── Quick Calls ───────────────────────────────────────── */}
        {quickCalls.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {quickCalls.map((call) => (
              <button
                key={call.id}
                type="button"
                onClick={() => onQuickCall(call.id)}
                disabled={running}
                className="hc-btn hc-btn-ghost"
                style={{
                  fontSize: "0.72rem",
                  padding: "0.4rem 0.75rem",
                  borderRadius: 999,
                  opacity: running ? 0.5 : 1,
                }}
                title={call.hint || call.path}
              >
                <span
                  className="mr-1 text-[9px] font-bold"
                  style={{
                    color:
                      call.method === "GET"
                        ? "var(--hc-green)"
                        : call.method === "POST"
                          ? "var(--hc-accent)"
                          : "var(--hc-active)",
                  }}
                >
                  {call.method}
                </span>
                {call.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Form ────────────────────────────────────────────────── */}
      <div className="grid gap-4 p-5 md:grid-cols-12">
        {/* Method pill group */}
        <div className="md:col-span-4">
          <label
            className="mb-1.5 block text-xs font-medium"
            style={{ color: "var(--hc-text-muted)" }}
          >
            Method
          </label>
          <div
            className="inline-flex overflow-hidden"
            style={{
              border: "1px solid var(--hc-border)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className="px-3 py-2 text-xs font-semibold transition-colors"
                style={{
                  background:
                    m === method ? "var(--hc-primary)" : "var(--hc-bg)",
                  color: m === method ? "#fff" : "var(--hc-text-muted)",
                  borderRight:
                    m !== "DELETE"
                      ? "1px solid var(--hc-border)"
                      : "none",
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Path */}
        <div className="md:col-span-8">
          <label
            className="mb-1.5 block text-xs font-medium"
            style={{ color: "var(--hc-text-muted)" }}
          >
            Path
          </label>
          <input
            className="w-full font-mono text-sm"
            style={{
              background: "var(--hc-bg)",
              border: "1px solid var(--hc-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--hc-text)",
              padding: "0.5rem 0.75rem",
            }}
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/status"
            spellCheck={false}
          />
        </div>

        {/* Body */}
        {showBody && (
          <div className="md:col-span-12">
            <label
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--hc-text-muted)" }}
            >
              JSON Body
            </label>
            <textarea
              className="w-full font-mono text-sm"
              style={{
                background: "var(--hc-bg)",
                border: "1px solid var(--hc-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--hc-text)",
                padding: "0.5rem 0.75rem",
                minHeight: 140,
                resize: "vertical",
              }}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              spellCheck={false}
            />
          </div>
        )}

        {/* ── Response Area ─────────────────────────────────────── */}
        <div className="md:col-span-12">
          {/* Status bar */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-xs" style={{ color: "var(--hc-text-muted)" }}>
              <span
                className="font-medium"
                style={{ color: "var(--hc-text)" }}
              >
                Status:
              </span>{" "}
              {statusLine || "\u2014"}
            </div>
            <div className="text-xs" style={{ color: "var(--hc-text-muted)" }}>
              <span
                className="font-medium"
                style={{ color: "var(--hc-text)" }}
              >
                Content-Type:
              </span>{" "}
              <span className="font-mono">{contentType || "\u2014"}</span>
            </div>
            {running && (
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                  style={{ background: "var(--hc-green)" }}
                />
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--hc-green)" }}
                >
                  Running
                </span>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div
              className="mt-3 rounded-lg p-3 text-sm"
              style={{
                background: "rgba(245,100,84,0.08)",
                border: "1px solid var(--hc-active)",
                color: "var(--hc-active)",
              }}
            >
              {error}
            </div>
          )}

          {/* JSON output */}
          {jsonOut !== null && (
            <pre
              className="mt-3 overflow-auto p-4 text-xs"
              style={{
                background: "var(--hc-primary)",
                color: "#d4dce6",
                borderRadius: "var(--radius-sm)",
                maxHeight: 560,
              }}
            >
              {colorizeJson(prettyJson(jsonOut))}
            </pre>
          )}

          {/* Text output */}
          {textOut && (
            <pre
              className="mt-3 overflow-auto p-4 text-xs"
              style={{
                background: "var(--hc-primary)",
                color: "#d4dce6",
                borderRadius: "var(--radius-sm)",
                maxHeight: 560,
              }}
            >
              {textOut}
            </pre>
          )}

          {/* Stream output */}
          {streamItems.length > 0 && (
            <div className="mt-3">
              <div className="text-xs" style={{ color: "var(--hc-text-muted)" }}>
                Streaming items: {streamItems.length} (showing last{" "}
                {streamPreview.length})
              </div>
              <pre
                className="mt-2 overflow-auto p-4 text-xs"
                style={{
                  background: "var(--hc-primary)",
                  color: "#d4dce6",
                  borderRadius: "var(--radius-sm)",
                  maxHeight: 560,
                }}
              >
                {streamPreview
                  .map((entry, idx) => {
                    if (entry.kind === "bad_line") {
                      return `bad_line: ${entry.line}`;
                    }
                    if (entry.kind === "sse") {
                      const payload = entry.parsed ?? entry.event.data;
                      return `sse${entry.event.event ? `(${entry.event.event})` : ""}: ${prettyJson(payload)}`;
                    }
                    return `ndjson: ${prettyJson(entry.item)}`;
                  })
                  .join("\n")}
              </pre>
            </div>
          )}

          {/* Empty state */}
          {!hasOutput && (
            <div
              className="mt-3 p-4 text-center text-sm"
              style={{
                background: "var(--hc-bg-soft)",
                border: "1px solid var(--hc-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--hc-text-muted)",
              }}
            >
              Use Quick Calls, or enter a method/path/body and click Run.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
