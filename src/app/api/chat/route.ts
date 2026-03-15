import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatPayload = {
  message?: string;
  model_hint?: string;
  verify?: boolean;
  multistep?: boolean;
  reason?: boolean;
};

const CHAT_TIMEOUT_MS = Number(process.env.HEXCARB_CHAT_TIMEOUT_MS || 70000);

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
  try {
    const decoded = atob(encoded);
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    const user = decoded.slice(0, idx).trim();
    return user || null;
  } catch {
    return null;
  }
}

function resolveEngineConfig() {
  const upstreamBaseUrl = (process.env.HEXCARB_GATEWAY_URL || "").trim() || "http://127.0.0.1:8000";
  const apiKey = (
    process.env.HEXCARB_GATEWAY_API_KEY || process.env.HEXCARB_API_KEY || ""
  ).trim();
  const gatewayScopes = (process.env.HEXCARB_GATEWAY_SCOPES || "*").trim();
  return { upstreamBaseUrl: upstreamBaseUrl.replace(/\/+$/, ""), apiKey, gatewayScopes };
}

function upstreamHeaders(req: NextRequest, apiKey: string, gatewayScopes: string): Headers {
  const headers = new Headers();
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  if (apiKey) headers.set("x-api-key", apiKey);
  if (gatewayScopes) headers.set("x-api-scopes", gatewayScopes);
  const user = parseBasicUsername(req.headers.get("authorization"));
  if (user) headers.set("x-api-user", `web:${user}`);
  return headers;
}

function normalizePayload(payload: ChatPayload): ChatPayload {
  return {
    message: (payload.message || "").trim(),
    verify: payload.verify,
    multistep: payload.multistep,
    reason: payload.reason,
  };
}

async function callUpstream(
  req: NextRequest,
  payload: ChatPayload,
  modelHint: string,
): Promise<Response> {
  const { upstreamBaseUrl, apiKey, gatewayScopes } = resolveEngineConfig();
  return fetch(`${upstreamBaseUrl}/chat`, {
    method: "POST",
    headers: upstreamHeaders(req, apiKey, gatewayScopes),
    body: JSON.stringify({ ...payload, model_hint: modelHint }),
    redirect: "manual",
    signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
  });
}

function hasUsableFinal(payload: unknown): payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object") return false;
  const obj = payload as Record<string, unknown>;
  if (obj.ok === false) return false;
  return typeof obj.final === "string" && obj.final.trim().length > 0;
}

export async function POST(req: NextRequest) {
  const upstreamEnv = (process.env.HEXCARB_GATEWAY_URL || "").trim();
  if (process.env.NODE_ENV === "production" && !upstreamEnv) {
    return jsonError(500, "HEXCARB_GATEWAY_URL is not set");
  }

  const body = (await req.json().catch(() => null)) as ChatPayload | null;
  const payload = normalizePayload(body || {});
  if (!payload.message) {
    return jsonError(400, "message is required");
  }

  const requestedHint = (body?.model_hint || "").trim();
  const modelHints = Array.from(
    new Set(requestedHint ? [requestedHint, "fast"] : ["chat", "fast", "light"]),
  );

  let lastStatus = 502;
  let lastBody = "";

  for (const hint of modelHints) {
    let upstreamResp: Response;
    try {
      upstreamResp = await callUpstream(req, payload, hint);
    } catch (err) {
      lastStatus = 502;
      lastBody = JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    const text = await upstreamResp.text();
    lastStatus = upstreamResp.status;
    lastBody = text;

    if (!upstreamResp.ok) {
      continue;
    }

    try {
      const parsed = JSON.parse(text) as unknown;
      if (hasUsableFinal(parsed)) {
        const headers = new Headers({
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-hexcarb-chat-hint": hint,
        });
        return new Response(JSON.stringify(parsed), {
          status: upstreamResp.status,
          headers,
        });
      }
    } catch {
      // Keep trying the next hint if the payload was not valid JSON.
    }
  }

  return new Response(lastBody || JSON.stringify({ ok: false, error: "chat_failed" }), {
    status: lastStatus,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
