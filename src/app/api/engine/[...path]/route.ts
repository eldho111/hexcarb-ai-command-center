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
} {
  const upstreamBaseUrl = (process.env.HEXCARB_GATEWAY_URL || "").trim();
  const apiKey = (
    process.env.HEXCARB_GATEWAY_API_KEY || process.env.HEXCARB_API_KEY || ""
  ).trim();
  return {
    upstreamBaseUrl: upstreamBaseUrl || "http://127.0.0.1:8000",
    apiKey,
  };
}

function buildUpstreamUrl(req: Request, pathSegments: string[]): string {
  const { upstreamBaseUrl } = resolveEngineConfig();
  const url = new URL(req.url);
  const base = upstreamBaseUrl.replace(/\/+$/, "");
  const path = "/" + pathSegments.map((seg) => encodeURIComponent(seg)).join("/");
  return base + path + url.search;
}

function filterRequestHeaders(req: Request, apiKey: string): Headers {
  const incoming = new Headers(req.headers);

  for (const key of incoming.keys()) {
    if (HOP_BY_HOP_REQ_HEADERS.has(key.toLowerCase())) {
      incoming.delete(key);
    }
  }

  // Never forward UI Basic Auth credentials or cookies to the engine.
  incoming.delete("authorization");
  incoming.delete("cookie");

  // Client must never be allowed to set the upstream API key.
  incoming.delete("x-api-key");

  if (apiKey) {
    incoming.set("x-api-key", apiKey);
  }

  // Optional: tag requests with the Basic username for audit/debug.
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

async function handle(req: NextRequest, ctx: RouteContext) {
  const { apiKey, upstreamBaseUrl } = resolveEngineConfig();

  const upstreamEnv = (process.env.HEXCARB_GATEWAY_URL || "").trim();
  if (process.env.NODE_ENV === "production" && !upstreamEnv) {
    return jsonError(500, "HEXCARB_GATEWAY_URL is not set");
  }

  // Fail closed in prod if API key is missing; allow local dev without it.
  if (!apiKey && process.env.NODE_ENV === "production") {
    return jsonError(500, "HEXCARB_GATEWAY_API_KEY is not set");
  }

  const { path: pathSegments } = await ctx.params;
  const upstreamUrl = buildUpstreamUrl(req, pathSegments || []);

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstreamResp: Response;
  try {
    upstreamResp = await fetch(upstreamUrl, {
      method,
      headers: filterRequestHeaders(req, apiKey),
      body,
      redirect: "manual",
    });
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
