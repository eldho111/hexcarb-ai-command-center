"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type EngineState = {
  status: "unknown" | "ok" | "down";
  detail?: string;
};

export function EngineOffline() {
  const [engine, setEngine] = useState<EngineState>({ status: "unknown" });

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      try {
        const resp = await fetch("/api/engine/ready", { cache: "no-store" });
        if (cancelled) return;
        if (!resp.ok) {
          setEngine({ status: "down", detail: `HTTP ${resp.status}` });
          return;
        }
        const data = (await resp.json()) as { ok?: boolean };
        setEngine({ status: data.ok ? "ok" : "down" });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setEngine({ status: "down", detail: msg });
      }
    }

    void probe();
    const t = setInterval(probe, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (engine.status !== "down") return null;

  return (
    <div className="mx-6 mt-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900 sm:mx-8 lg:mx-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Engine connection lost</div>
          <div className="text-xs text-red-700">
            The gateway did not respond. {engine.detail ? engine.detail : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="hex-button-outline"
            type="button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
          <Link className="hex-button" href="/panel/system_status">
            View Status
          </Link>
        </div>
      </div>
    </div>
  );
}
