"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import {
  PANELS,
  SECTION_LABELS,
  SECTION_ORDER,
  type PanelDef,
  type PanelSection,
} from "@/lib/panels";

function matchPanel(panel: PanelDef, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const hay = `${panel.id} ${panel.label} ${panel.description}`.toLowerCase();
  return hay.includes(query);
}

export function Sidebar() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
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

  return (
    <aside className="hidden h-dvh w-[280px] shrink-0 border-r border-[var(--hex-border)] bg-[var(--hex-panel)]/80 px-5 py-6 backdrop-blur xl:block">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--hex-border-strong)] bg-white text-sm font-semibold tracking-tight">
          HC
        </div>
        <div>
          <div className="text-sm font-semibold">HexCarb</div>
          <div className="text-xs text-[var(--hex-ink-soft)]">Command Center</div>
        </div>
      </div>

      <div className="mt-6">
        <div className="hex-section-title">Search</div>
        <input
          className="hex-input mt-2 w-full"
          placeholder="Jump to a panel"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
        />
      </div>

      <nav className="mt-6 space-y-6 text-sm">
        <div>
          <div className="hex-section-title">Overview</div>
          <Link
            href="/"
            className={`mt-2 block rounded-xl px-3 py-2 text-sm font-medium transition ${
              pathname === "/"
                ? "bg-[var(--hex-panel-2)] text-[var(--hex-ink)]"
                : "text-[var(--hex-ink-muted)] hover:bg-[var(--hex-panel-2)]"
            }`}
          >
            Dashboard
          </Link>
        </div>

        {SECTION_ORDER.map((section) => {
          const panels = grouped[section];
          if (panels.length === 0) return null;
          return (
            <div key={section}>
              <div className="hex-section-title">{SECTION_LABELS[section]}</div>
              <div className="mt-2 space-y-1">
                {panels.map((panel) => {
                  const href = `/panel/${panel.id}`;
                  const active = pathname === href;
                  return (
                    <Link
                      key={panel.id}
                      href={href}
                      className={`block rounded-xl px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-[var(--hex-panel-2)] text-[var(--hex-ink)]"
                          : "text-[var(--hex-ink-muted)] hover:bg-[var(--hex-panel-2)]"
                      }`}
                    >
                      {panel.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
