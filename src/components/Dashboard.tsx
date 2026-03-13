"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  PANELS,
  SECTION_LABELS,
  SECTION_ORDER,
  type PanelDef,
  type PanelSection,
} from "@/lib/panels";

type EngineState = {
  status: "unknown" | "ok" | "down";
  detail?: string;
};

function matchPanel(panel: PanelDef, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const hay = `${panel.id} ${panel.label} ${panel.description}`.toLowerCase();
  return hay.includes(query);
}

export function Dashboard() {
  const [query, setQuery] = useState("");
  const [engine, setEngine] = useState<EngineState>({ status: "unknown" });

  useEffect(() => {
    let cancelled = false;
    async function probe() {
      try {
        const resp = await fetch("/api/engine/ready", { cache: "no-store" });
        const data = (await resp.json()) as unknown;
        if (cancelled) return;
        if (!resp.ok) {
          setEngine({ status: "down", detail: `HTTP ${resp.status}` });
          return;
        }
        const obj = data as Record<string, unknown>;
        const ok = Boolean(obj.ok);
        setEngine({ status: ok ? "ok" : "down" });
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

  const bySection = useMemo(() => {
    const out: Record<PanelSection, PanelDef[]> = {
      sources: [],
      chat: [],
      diagnostics: [],
      experiments: [],
      dataset_training: [],
      admin: [],
    };

    for (const panel of PANELS) {
      if (!matchPanel(panel, query)) continue;
      out[panel.section].push(panel);
    }

    return out;
  }, [query]);

  const visibleCount = useMemo(() => {
    let n = 0;
    for (const section of SECTION_ORDER) n += bySection[section].length;
    return n;
  }, [bySection]);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10">
      <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-amber-200 via-sky-200 to-emerald-200 blur-2xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-gradient-to-tr from-fuchsia-200 via-rose-200 to-orange-200 blur-2xl" />

        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
                HexCarb Console
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-zinc-600">
                A lightweight web front-end for the HexCarb FastAPI gateway. Tiles
                map to panels; each panel includes Quick Calls and a generic API
                runner.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={
                  engine.status === "ok"
                    ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900"
                    : engine.status === "down"
                      ? "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-900"
                      : "rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700"
                }
                title={engine.detail || ""}
              >
                Engine: {engine.status}
              </span>
              <Link
                href="/panel/system_status"
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                System Status
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-12">
            <div className="md:col-span-9">
              <label className="block text-xs font-medium text-zinc-700">
                Search
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm"
                placeholder="Search panels (examples: training, ingest, ops, drafts)…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-zinc-700">
                Visible
              </label>
              <div className="mt-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-sm">
                {visibleCount} / {PANELS.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 space-y-10">
        {SECTION_ORDER.map((section) => {
          const panels = bySection[section];
          if (panels.length === 0) return null;
          return (
            <section key={section}>
              <div className="flex items-end justify-between gap-3">
                <h2 className="text-base font-semibold text-zinc-900">
                  {SECTION_LABELS[section]}
                </h2>
                <div className="text-xs text-zinc-500">{panels.length}</div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {panels.map((panel) => (
                  <Link
                    key={panel.id}
                    href={`/panel/${panel.id}`}
                    className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-zinc-950 group-hover:underline">
                          {panel.label}
                        </div>
                        <div className="mt-1 text-xs text-zinc-600">
                          {panel.description}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-[11px] font-mono text-zinc-500">
                      {panel.id}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-12 text-xs text-zinc-500">
        Tip: if you deploy on Vercel, keep the engine behind a Cloudflare tunnel
        and set <span className="font-mono">HEXCARB_GATEWAY_URL</span>{" "}
        and <span className="font-mono">HEXCARB_GATEWAY_API_KEY</span> in Vercel
        env vars.
      </div>
    </div>
  );
}
