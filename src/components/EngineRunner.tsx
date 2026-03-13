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

  // If the user pastes our proxy prefix, strip it.
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
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">
              {title || "API Runner"}
            </div>
            <div className="text-xs text-zinc-500">
              Calls the engine through the server-side proxy at /api/engine/*.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRunManual}
              disabled={running}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Send
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={!running}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
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
                className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50"
                title={call.hint || call.path}
              >
                {call.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-12">
        <div className="md:col-span-6">
          <label className="block text-xs font-medium text-zinc-700">
            Method
          </label>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
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

        <div className="md:col-span-6">
          <label className="block text-xs font-medium text-zinc-700">Path</label>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/status"
            spellCheck={false}
          />
        </div>

        {method !== "GET" && method !== "DELETE" ? (
          <div className="md:col-span-12">
            <label className="block text-xs font-medium text-zinc-700">
              JSON Body
            </label>
            <textarea
              className="mt-1 min-h-[140px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              spellCheck={false}
            />
          </div>
        ) : null}

        <div className="md:col-span-12">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs text-zinc-600">
              <span className="font-medium text-zinc-800">Status:</span>{" "}
              {statusLine || "-"}
            </div>
            <div className="text-xs text-zinc-600">
              <span className="font-medium text-zinc-800">Content-Type:</span>{" "}
              {contentType || "-"}
            </div>
            {running ? (
              <div className="text-xs font-medium text-zinc-900">Running…</div>
            ) : null}
          </div>

          {error ? (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {error}
            </div>
          ) : null}

          {jsonOut !== null ? (
            <pre className="mt-3 max-h-[560px] overflow-auto rounded-xl bg-zinc-950 p-4 text-xs text-zinc-100">
              {prettyJson(jsonOut)}
            </pre>
          ) : null}

          {textOut ? (
            <pre className="mt-3 max-h-[560px] overflow-auto rounded-xl bg-zinc-950 p-4 text-xs text-zinc-100">
              {textOut}
            </pre>
          ) : null}

          {streamItems.length > 0 ? (
            <div className="mt-3">
              <div className="text-xs text-zinc-600">
                Streaming items: {streamItems.length} (showing last {streamPreview.length})
              </div>
              <pre className="mt-2 max-h-[560px] overflow-auto rounded-xl bg-zinc-950 p-4 text-xs text-zinc-100">
                {streamPreview
                  .map((entry) => {
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
          ) : null}

          {!jsonOut && !textOut && streamItems.length === 0 && !error ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              Use Quick Calls, or enter a method/path/body and click Send.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
