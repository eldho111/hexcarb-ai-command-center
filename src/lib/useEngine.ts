"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ── Types ─────────────────────────────────────────────────────── */
export interface EngineResult<T = Record<string, unknown>> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface EngineMutation<T = Record<string, unknown>> {
  mutate: (body?: unknown) => Promise<T | null>;
  data: T | null;
  loading: boolean;
  error: string | null;
}

/* ── Helpers ───────────────────────────────────────────────────── */
function engineUrl(path: string): string {
  const p = path.startsWith("/") ? path : "/" + path;
  return `/api/engine${p}`;
}

async function engineFetch<T>(
  path: string,
  opts?: RequestInit,
): Promise<T> {
  const res = await fetch(engineUrl(path), {
    ...opts,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(opts?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Engine ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (json && json.ok === false) {
    throw new Error(json.error || "Engine returned ok:false");
  }
  return json as T;
}

/* ── useEngineGet ──────────────────────────────────────────────── */
export function useEngineGet<T = Record<string, unknown>>(
  path: string | null,
  interval?: number,
): EngineResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const doFetch = useCallback(() => {
    if (!path) return;
    setLoading(true);
    setError(null);
    engineFetch<T>(path)
      .then((d) => { if (mountedRef.current) { setData(d); setLoading(false); } })
      .catch((e) => { if (mountedRef.current) { setError(e.message); setLoading(false); } });
  }, [path]);

  useEffect(() => {
    mountedRef.current = true;
    const kickoff = setTimeout(() => {
      doFetch();
    }, 0);
    const timer = interval && interval > 0 ? setInterval(doFetch, interval) : undefined;
    return () => {
      mountedRef.current = false;
      clearTimeout(kickoff);
      if (timer) clearInterval(timer);
    };
  }, [doFetch, interval]);

  return { data, loading, error, refetch: doFetch };
}

/* ── useEnginePost ─────────────────────────────────────────────── */
export function useEnginePost<T = Record<string, unknown>>(
  path: string,
): EngineMutation<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (body?: unknown): Promise<T | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await engineFetch<T>(path, {
          method: "POST",
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        setData(result);
        setLoading(false);
        return result;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setLoading(false);
        return null;
      }
    },
    [path],
  );

  return { mutate, data, loading, error };
}

/* ── Standalone fetch (no hook) ────────────────────────────────── */
export { engineFetch, engineUrl };
