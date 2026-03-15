"use client";

import { useMemo, useRef, useState } from "react";

import type { HttpMethod, QuickCall } from "@/lib/panels";
import { streamNdjson, streamSse, type SseEvent } from "@/lib/stream";

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
  const [path, setPath] = useState<string>(initialPath);
  const [bodyText, setBodyText] = useState<string>(initialBody);

  const [running, setRunning] = useState(false);
  const [statusLine, setStatusLine] = useState<string>("");
  const [contentType, setContentType] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [jsonOut, setJsonOut] = useState<unknown>(null);
  const [textOut, setTextOut] = useState<string>("");
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

    if (reqMethod !== "GET" && reqMethod !== "DELETE") {
      if (call.body !== undefined) {
        body = JSON.stringify(call.body);
        headers.set("content-type", "application/json; charset=utf-8");
      }
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
          setStreamItems((prev) => [...prev, { kind: "sse", event: evt, parsed }]);
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
    if (reqMethod !== "GET" && reqMethod !== "DELETE") {
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

  return (
    <section className="hex-card overflow-hidden">
      <div className="border-b border-[var(--hex-border)] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{title || "API Runner"}</div>
            <div className="text-xs text-[var(--hex-ink-soft)]">
              Calls the engine through the server-side proxy at
              <span className="font-mono"> /api/engine/*</span>.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRunManual}
              disabled={running}
              className="hex-button"
            >
              Send
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={!running}
              className="hex-button-outline"
            >
              Cancel
            </button>
          </div>
        </div>

        {quickCalls.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {quickCalls.map((call) => (
              <button
                key={call.id}
                type="button"
                onClick={() => onQuickCall(call.id)}
                disabled={running}
                className="hex-pill hover:border-[var(--hex-border-strong)] disabled:opacity-50"
                title={call.hint || call.path}
              >
                {call.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <label className="hex-section-title">Method</label>
          <select
            className="hex-input mt-2 w-full"
            value={method}
            onChange={(e) => setMethod(e.target.value as HttpMethod)}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>

        <div className="lg:col-span-6">
          <label className="hex-section-title">Path</label>
          <input
            className="hex-input mt-2 w-full font-mono"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/status"
            spellCheck={false}
          />
        </div>

        {method !== "GET" && method !== "DELETE" ? (
          <div className="lg:col-span-12">
            <label className="hex-section-title">JSON Body</label>
            <textarea
              className="hex-input mt-2 min-h-[160px] w-full font-mono"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              spellCheck={false}
            />
          </div>
        ) : null}

        <div className="lg:col-span-12">
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--hex-ink-muted)]">
            <span className="hex-pill">Status: {statusLine || "-"}</span>
            <span className="hex-pill">Content-Type: {contentType || "-"}</span>
          </div>
        </div>

        {error ? (
          <div className="lg:col-span-12 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {error}
          </div>
        ) : null}

        {streamItems.length > 0 ? (
          <div className="lg:col-span-12">
            <div className="hex-section-title">Streaming Output</div>
            <div className="mt-2 max-h-[360px] overflow-auto rounded-xl border border-[var(--hex-border)] bg-white p-3 text-xs font-mono text-[var(--hex-ink-muted)]">
              {streamPreview.map((item, idx) => {
                if (item.kind === "bad_line") {
                  return (
                    <div key={idx} className="text-amber-700">
                      bad_line: {item.line}
                    </div>
                  );
                }
                if (item.kind === "sse") {
                  return (
                    <div key={idx}>
                      sse: {item.event.event || "message"} {item.event.data || ""}
                    </div>
                  );
                }
                return <div key={idx}>{prettyJson(item.item)}</div>;
              })}
            </div>
          </div>
        ) : null}

        {jsonOut !== null ? (
          <div className="lg:col-span-12">
            <div className="hex-section-title">JSON Response</div>
            <pre className="mt-2 max-h-[420px] overflow-auto rounded-xl border border-[var(--hex-border)] bg-white p-4 text-xs text-[var(--hex-ink-muted)]">
              {prettyJson(jsonOut)}
            </pre>
          </div>
        ) : null}

        {jsonOut === null && textOut ? (
          <div className="lg:col-span-12">
            <div className="hex-section-title">Response</div>
            <pre className="mt-2 max-h-[420px] overflow-auto rounded-xl border border-[var(--hex-border)] bg-white p-4 text-xs text-[var(--hex-ink-muted)]">
              {textOut}
            </pre>
          </div>
        ) : null}
      </div>
    </section>
  );
}
