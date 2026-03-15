"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  PANELS,
  SECTION_LABELS,
  SECTION_ORDER,
  isPanelLive,
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
  const hay = `${panel.id} ${panel.label} ${panel.description} ${panel.availabilityNote || ""}`.toLowerCase();
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
    <div className="space-y-10">
      <section className="hex-card hex-grid relative overflow-hidden px-8 py-10">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-[var(--hex-accent)]/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-[var(--hex-accent-3)]/10 blur-3xl" />

        <div className="relative flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="hex-section-title">HexCarb AI Engine</div>
              <h1 className="mt-2 text-3xl font-semibold">
                Material intelligence for carbon systems
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--hex-ink-muted)]">
                Live panels below are wired to the current FastAPI gateway.
                Planned panels stay visible for roadmap continuity, but they are
                disabled until this engine build exposes the matching routes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`hex-pill ${
                  engine.status === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : engine.status === "down"
                      ? "border-red-200 bg-red-50 text-red-900"
                      : "border-[var(--hex-border)] text-[var(--hex-ink-muted)]"
                }`}
                title={engine.detail || ""}
              >
                Engine: {engine.status}
              </span>
              <Link className="hex-button-outline" href="/panel/system_status">
                System Status
              </Link>
              <Link className="hex-button" href="/panel/chat">
                Open Chat
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="hex-card-muted p-4">
              <div className="text-xs text-[var(--hex-ink-soft)]">Focus</div>
              <div className="mt-1 text-sm font-semibold">Quantum Conductivity</div>
              <p className="mt-2 text-xs text-[var(--hex-ink-muted)]">
                Map electron flow and structural integrity across CNT networks.
              </p>
            </div>
            <div className="hex-card-muted p-4">
              <div className="text-xs text-[var(--hex-ink-soft)]">Focus</div>
              <div className="mt-1 text-sm font-semibold">Thermal Superhighways</div>
              <p className="mt-2 text-xs text-[var(--hex-ink-muted)]">
                Trace heat transport, phonon coherence, and thermal optimization.
              </p>
            </div>
            <div className="hex-card-muted p-4">
              <div className="text-xs text-[var(--hex-ink-soft)]">Focus</div>
              <div className="mt-1 text-sm font-semibold">Atomic Strength</div>
              <p className="mt-2 text-xs text-[var(--hex-ink-muted)]">
                Benchmark tensile resilience and failure modes at the nanoscale.
              </p>
            </div>
            <div className="hex-card-muted p-4">
              <div className="text-xs text-[var(--hex-ink-soft)]">Focus</div>
              <div className="mt-1 text-sm font-semibold">Ultra-Low Density</div>
              <p className="mt-2 text-xs text-[var(--hex-ink-muted)]">
                Track lightweight architectures without performance compromise.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="hex-card px-8 py-6">
        <div className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-8">
            <div className="hex-section-title">Panel search</div>
            <input
              className="hex-input mt-2 w-full"
              placeholder="Search panels (training, ingest, drafts, planned)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="md:col-span-4">
            <div className="hex-section-title">Visible</div>
            <div className="mt-2 rounded-2xl border border-[var(--hex-border)] bg-[var(--hex-panel-2)] px-4 py-4 text-sm font-semibold">
              {visibleCount} / {PANELS.length} panels
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-10">
        {SECTION_ORDER.map((section) => {
          const panels = bySection[section];
          if (panels.length === 0) return null;
          return (
            <section key={section}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="hex-section-title">{SECTION_LABELS[section]}</div>
                  <div className="text-lg font-semibold">
                    {SECTION_LABELS[section]}
                  </div>
                </div>
                <div className="text-xs text-[var(--hex-ink-soft)]">
                  {panels.length} panels
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {panels.map((panel) => {
                  const live = isPanelLive(panel);
                  const className = `group hex-card relative overflow-hidden px-5 py-4 transition ${
                    live
                      ? "hover:-translate-y-0.5"
                      : "cursor-not-allowed border-dashed opacity-80"
                  }`;
                  const content = (
                    <>
                      <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[var(--hex-accent)]/10 blur-2xl" />
                      <div className="relative">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className={`text-sm font-semibold ${live ? "group-hover:underline" : ""}`}>
                              {panel.label}
                            </div>
                            <div className="mt-1 text-xs text-[var(--hex-ink-muted)]">
                              {panel.description}
                            </div>
                          </div>
                          <span
                            className={`hex-pill ${
                              live
                                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                : "border-amber-200 bg-amber-50 text-amber-900"
                            }`}
                          >
                            {panel.availability}
                          </span>
                        </div>
                        {panel.availabilityNote ? (
                          <div className="mt-3 text-xs text-[var(--hex-ink-soft)]">
                            {panel.availabilityNote}
                          </div>
                        ) : null}
                        <div className="mt-3 text-[11px] font-mono text-[var(--hex-ink-soft)]">
                          {panel.id}
                        </div>
                      </div>
                    </>
                  );

                  if (!live) {
                    return (
                      <div key={panel.id} className={className} aria-disabled="true">
                        {content}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={panel.id}
                      href={`/panel/${panel.id}`}
                      className={className}
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
