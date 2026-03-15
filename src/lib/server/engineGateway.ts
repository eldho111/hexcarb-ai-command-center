const DEFAULT_GATEWAY_URL = "http://127.0.0.1:8000";

type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | number | boolean | null | undefined>;

export type EngineRequestOptions = {
  req?: Request | null;
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  headers?: HeadersInit;
  searchParams?: SearchParamsInput;
};

export function resolveEngineConfig(): {
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
    upstreamBaseUrl: upstreamBaseUrl || DEFAULT_GATEWAY_URL,
    apiKey,
    gatewayScopes,
  };
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function parseBasicUsername(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const [scheme, encoded] = headerValue.split(" ");
  if (scheme !== "Basic" || !encoded) return null;
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    const user = decoded.slice(0, idx).trim();
    return user || null;
  } catch {
    return null;
  }
}

function applySearchParams(url: URL, searchParams?: SearchParamsInput): void {
  if (!searchParams) return;
  if (searchParams instanceof URLSearchParams) {
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.set(key, value);
    }
    return;
  }
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }
}

export function buildGatewayHeaders(
  req?: Request | null,
  extraHeaders?: HeadersInit,
): Headers {
  const { apiKey, gatewayScopes } = resolveEngineConfig();
  const headers = new Headers(extraHeaders);

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  headers.set("cache-control", "no-store");

  if (apiKey) headers.set("x-api-key", apiKey);
  if (gatewayScopes) headers.set("x-api-scopes", gatewayScopes);

  if (!headers.has("x-api-user")) {
    const user = parseBasicUsername(req?.headers.get("authorization") ?? null);
    if (user) headers.set("x-api-user", `web:${user}`);
  }

  return headers;
}

export function buildGatewayUrl(
  path: string,
  searchParams?: SearchParamsInput,
): string {
  const { upstreamBaseUrl } = resolveEngineConfig();
  const base = upstreamBaseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}${normalizePath(path)}`);
  applySearchParams(url, searchParams);
  return url.toString();
}

export function maskGatewayHostLabel(upstreamBaseUrl?: string): string {
  const source = (upstreamBaseUrl || resolveEngineConfig().upstreamBaseUrl || DEFAULT_GATEWAY_URL).trim();
  try {
    const hostname = new URL(source).hostname.replace(/^www\./, "");
    if (!hostname || hostname === "127.0.0.1" || hostname === "localhost") {
      return hostname || "local-gateway";
    }
    const parts = hostname.split(".");
    if (parts.length <= 2) return hostname;
    return `${parts[0]}.***.${parts[parts.length - 1]}`;
  } catch {
    return "configured-gateway";
  }
}

export async function engineFetchJson<T>(
  path: string,
  options: EngineRequestOptions = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = buildGatewayHeaders(options.req, options.headers);
  const hasBody = options.body !== undefined && method !== "GET" && method !== "HEAD";

  const response = await fetch(buildGatewayUrl(path, options.searchParams), {
    method,
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(options.timeoutMs ?? 15000),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Engine ${response.status}: ${text || response.statusText}`);
  }
  if (!text.trim()) {
    return {} as T;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Engine returned non-JSON from ${normalizePath(path)}`);
  }

  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    (payload as Record<string, unknown>).ok === false
  ) {
    const error = (payload as Record<string, unknown>).error;
    throw new Error(typeof error === "string" ? error : `Engine returned ok:false for ${normalizePath(path)}`);
  }

  return payload as T;
}
