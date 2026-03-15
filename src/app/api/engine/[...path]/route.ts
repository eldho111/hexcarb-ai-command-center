import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOP_BY_HOP_REQ_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

const HOP_BY_HOP_RES_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "content-encoding",
]);

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function parseBasicUsername(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const [scheme, encoded] = headerValue.split(" ");
  if (scheme !== "Basic" || !encoded) return null;
  let decoded = "";
  try {
    decoded = atob(encoded);
  } catch {
    return null;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return null;
  const user = decoded.slice(0, idx).trim();
  return user || null;
}

function resolveEngineConfig(): {
  upstreamBaseUrl: string;
  apiKey: string;
  gatewayScopes: string;
} {
  const upstreamBaseUrl = (process.env.HEXCARB_GATEWAY_URL || "").trim();
  const apiKey = (
    process.env.HEXCARB_GATEWAY_API_KEY || process.env.HEXCARB_API_KEY || ""
  ).trim();
  const gatewayScopes = (process.env.HEXCARB_GATEWAY_SCOPES || "*").trim();
  return {
    upstreamBaseUrl: upstreamBaseUrl || "http://127.0.0.1:8000",
    apiKey,
    gatewayScopes,
  };
}

function buildUpstreamUrl(req: Request, pathSegments: string[]): string {
  const { upstreamBaseUrl } = resolveEngineConfig();
  const url = new URL(req.url);
  const base = upstreamBaseUrl.replace(/\/+$/, "");
  const path = "/" + pathSegments.map((seg) => encodeURIComponent(seg)).join("/");
  return base + path + url.search;
}

function buildFixedUpstreamUrl(req: Request, path: string): string {
  const { upstreamBaseUrl } = resolveEngineConfig();
  const url = new URL(req.url);
  const base = upstreamBaseUrl.replace(/\/+$/, "");
  return `${base}${path}${url.search}`;
}

function filterRequestHeaders(
  req: Request,
  apiKey: string,
  gatewayScopes: string,
): Headers {
  const incoming = new Headers(req.headers);

  for (const key of incoming.keys()) {
    if (HOP_BY_HOP_REQ_HEADERS.has(key.toLowerCase())) {
      incoming.delete(key);
    }
  }

  incoming.delete("authorization");
  incoming.delete("cookie");
  incoming.delete("x-api-key");
  incoming.delete("x-api-scopes");

  if (apiKey) {
    incoming.set("x-api-key", apiKey);
  }

  if (gatewayScopes) {
    incoming.set("x-api-scopes", gatewayScopes);
  }

  if (!incoming.get("x-api-user")) {
    const user = parseBasicUsername(req.headers.get("authorization"));
    if (user) incoming.set("x-api-user", `web:${user}`);
  }

  incoming.set("cache-control", "no-store");
  return incoming;
}

function filterResponseHeaders(upstream: Headers): Headers {
  const out = new Headers();
  for (const [key, value] of upstream.entries()) {
    if (HOP_BY_HOP_RES_HEADERS.has(key.toLowerCase())) continue;
    out.set(key, value);
  }
  out.set("cache-control", "no-store");
  return out;
}

async function fetchUpstream(
  upstreamUrl: string,
  method: string,
  headers: Headers,
  body?: ArrayBuffer,
): Promise<Response> {
  return fetch(upstreamUrl, {
    method,
    headers,
    body,
    redirect: "manual",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function ndjsonLine(payload: Record<string, unknown>): string {
  return JSON.stringify(payload) + "\n";
}

function wrapChatJsonAsNdjson(payload: Record<string, unknown>): string {
  const citations = Array.isArray(payload.citations)
    ? payload.citations.map((item) => String(item))
    : [];
  const latencyMs = typeof payload.elapsed_sec === "number"
    ? Math.round(payload.elapsed_sec * 1000)
    : typeof payload.latency_ms === "number"
      ? payload.latency_ms
      : 0;

  const meta = {
    type: "meta",
    model:
      typeof payload.routed_model === "string"
        ? payload.routed_model
        : typeof payload.model === "string"
          ? payload.model
          : undefined,
    selected_provider:
      typeof payload.selected_provider === "string"
        ? payload.selected_provider
        : typeof payload.provider === "string"
          ? payload.provider
          : "ollama",
    latency_ms: latencyMs,
    retrieval_used: Boolean(payload.retrieval_used),
    retrieval_count: typeof payload.retrieval_count === "number" ? payload.retrieval_count : 0,
    citation_count:
      typeof payload.citation_count === "number" ? payload.citation_count : citations.length,
    warning: typeof payload.warning === "string" ? payload.warning : null,
  };

  if (payload.ok === false) {
    return (
      ndjsonLine(meta) +
      ndjsonLine({
        type: "error",
        error: String(payload.error || "chat_error"),
        message: String(payload.error || payload.message || "chat_error"),
        trace_id: typeof payload.trace_id === "string" ? payload.trace_id : undefined,
      })
    );
  }

  return (
    ndjsonLine(meta) +
    ndjsonLine({
      type: "final",
      final: String(payload.final || payload.answer || ""),
      citations,
    })
  );
}

async function handleChatStreamFallback(
  req: NextRequest,
  method: string,
  headers: Headers,
  body: ArrayBuffer | undefined,
): Promise<Response | null> {
  if (method !== "POST") return null;
  const url = new URL(req.url);
  if (!url.pathname.endsWith("/api/engine/chat_stream")) return null;

  let upstreamResp: Response;
  try {
    upstreamResp = await fetchUpstream(buildFixedUpstreamUrl(req, "/chat_stream"), method, headers, body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(502, `upstream_unreachable: ${msg}`);
  }

  const contentType = upstreamResp.headers.get("content-type") || "";
  if (upstreamResp.ok && contentType.includes("application/x-ndjson")) {
    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      headers: filterResponseHeaders(upstreamResp.headers),
    });
  }

  let fallbackResp: Response;
  try {
    fallbackResp = await fetchUpstream(buildFixedUpstreamUrl(req, "/chat"), method, headers, body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(502, `upstream_unreachable: ${msg}`);
  }

  const fallbackText = await fallbackResp.text();
  if (!fallbackResp.ok) {
    return new Response(fallbackText || await upstreamResp.text(), {
      status: fallbackResp.status,
      headers: filterResponseHeaders(fallbackResp.headers),
    });
  }

  try {
    const parsed = JSON.parse(fallbackText) as unknown;
    if (isRecord(parsed)) {
      return new Response(wrapChatJsonAsNdjson(parsed), {
        status: 200,
        headers: {
          "content-type": "application/x-ndjson; charset=utf-8",
          "cache-control": "no-store",
          "x-hexcarb-chat-fallback": "chat_json_wrapped",
        },
      });
    }
  } catch {
    // Fall through to raw text response.
  }

  return new Response(fallbackText, {
    status: fallbackResp.status,
    headers: filterResponseHeaders(fallbackResp.headers),
  });
}

async function handle(req: NextRequest, ctx: RouteContext) {
  const { apiKey, gatewayScopes } = resolveEngineConfig();

  const upstreamEnv = (process.env.HEXCARB_GATEWAY_URL || "").trim();
  if (process.env.NODE_ENV === "production" && !upstreamEnv) {
    return jsonError(500, "HEXCARB_GATEWAY_URL is not set");
  }

  if (!apiKey && process.env.NODE_ENV === "production") {
    return jsonError(500, "HEXCARB_GATEWAY_API_KEY is not set");
  }

  const { path: pathSegments } = await ctx.params;
  const upstreamUrl = buildUpstreamUrl(req, pathSegments || []);

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;
  const headers = filterRequestHeaders(req, apiKey, gatewayScopes);

  const chatFallback = await handleChatStreamFallback(req, method, headers, body);
  if (chatFallback) {
    return chatFallback;
  }

  let upstreamResp: Response;
  try {
    upstreamResp = await fetchUpstream(upstreamUrl, method, headers, body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(502, `upstream_unreachable: ${msg}`);
  }

  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: filterResponseHeaders(upstreamResp.headers),
  });
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  return handle(req, ctx);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  return handle(req, ctx);
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  return handle(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return handle(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return handle(req, ctx);
}

export async function OPTIONS(req: NextRequest, ctx: RouteContext) {
  return handle(req, ctx);
}
