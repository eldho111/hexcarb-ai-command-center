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
    const t = setInterval(probe, 15_000);
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

  const statusColor =
    engine.status === "ok"
      ? "bg-[var(--hc-green)]/15 text-[var(--hc-green)]"
      : engine.status === "down"
        ? "bg-[var(--hc-active)]/15 text-[var(--hc-active)]"
        : "bg-[var(--hc-bg-soft)] text-[var(--hc-text-muted)]";

  const statusDot =
    engine.status === "ok"
      ? "bg-[var(--hc-green)]"
      : engine.status === "down"
        ? "bg-[var(--hc-active)]"
        : "bg-[var(--hc-text-muted)]";

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--hc-border)] bg-[var(--hc-card-bg)] px-8 pb-8 pt-10 backdrop-blur-md">
        {/* Ambient decorative gradients */}
        <div
          className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full opacity-30 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--hc-accent) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full opacity-25 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--hc-green) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute right-1/4 top-0 h-56 w-56 rounded-full opacity-15 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--hc-accent) 30%, var(--hc-green) 100%)",
          }}
        />

        <div className="relative flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--hc-heading)] sm:text-4xl">
                HexCarb AI Console
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--hc-text-muted)]">
                Command center for AI-powered carbon materials R&amp;D
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold ${statusColor}`}
                title={engine.detail || ""}
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full ${statusDot} ${engine.status === "ok" ? "animate-pulse" : ""}`}
                />
                Engine: {engine.status}
              </span>
              <Link
                href="/panel/system_status"
                className="hc-btn hc-btn-ghost text-xs"
              >
                System Status
              </Link>
              <Link className="hex-button" href="/panel/chat">
                Open Chat
              </Link>
            </div>
          </div>

          {/* ── Search Bar ──────────────────────────────────── */}
          <div className="mt-8 flex items-center gap-4">
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--hc-text-muted)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <input
                className="w-full rounded-xl border border-[var(--hc-border)] bg-[var(--hc-bg)] py-3 pl-11 pr-4 text-sm text-[var(--hc-text)] shadow-sm placeholder:text-[var(--hc-text-muted)] focus:border-[var(--hc-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]/30"
                placeholder="Search panels... (ingest, training, drafts, compliance)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="hidden shrink-0 rounded-xl border border-[var(--hc-border)] bg-[var(--hc-bg)] px-4 py-3 text-sm font-semibold text-[var(--hc-text)] shadow-sm sm:block">
              {visibleCount} / {PANELS.length}
            </div>
          </div>
        </div>
      </section>

      {/* ── Panel Grid by Section ─────────────────────────────── */}
      <div className="mt-12 space-y-12">
        {SECTION_ORDER.map((section) => {
          const panels = bySection[section];
          if (panels.length === 0) return null;
          return (
            <section key={section}>
              <div className="mb-4 flex items-end justify-between gap-3">
                <span className="hc-kicker">
                  {SECTION_LABELS[section]}
                </span>
                <span className="text-xs tabular-nums text-[var(--hc-text-muted)]">
                  {panels.length} panel{panels.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {panels.map((panel) => (
                  <Link
                    key={panel.id}
                    href={`/panel/${panel.id}`}
                    className="hc-card group block px-5 py-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-[var(--hc-heading)] group-hover:text-[var(--hc-accent)]">
                          {panel.label}
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-[var(--hc-text-muted)]">
                          {panel.description}
                        </p>
                      </div>
                      {panel.quickCalls.length > 0 && (
                        <span className="shrink-0 rounded-full bg-[var(--hc-accent)]/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--hc-accent)]">
                          {panel.quickCalls.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 font-mono text-[11px] text-[var(--hc-text-muted)]/60">
                      {panel.id}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* ── Footer Tip ────────────────────────────────────────── */}
      <div className="mt-14 border-t border-[var(--hc-border)] pt-6 text-xs leading-relaxed text-[var(--hc-text-muted)]">
        Tip: set{" "}
        <code className="rounded bg-[var(--hc-bg-soft)] px-1.5 py-0.5 font-mono text-[var(--hc-text)]">
          HEXCARB_GATEWAY_URL
        </code>{" "}
        and{" "}
        <code className="rounded bg-[var(--hc-bg-soft)] px-1.5 py-0.5 font-mono text-[var(--hc-text)]">
          HEXCARB_GATEWAY_API_KEY
        </code>{" "}
        in your environment to connect to the HexCarb engine.
      </div>
    </div>
  );
}
