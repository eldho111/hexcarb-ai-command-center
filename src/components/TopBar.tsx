"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import {
  getPanelById,
  PANELS,
  SECTION_LABELS,
  SECTION_ORDER,
  isPanelLive,
  type PanelSection,
} from "@/lib/panels";

function resolvePageMeta(pathname: string) {
  if (pathname.startsWith("/panel/")) {
    const panelId = pathname.replace("/panel/", "").split("/")[0];
    const panel = getPanelById(panelId);
    if (panel) {
      return {
        title: panel.label,
        description: panel.description,
      };
    }
  }
  return {
    title: "HexCarb Command Center",
    description: "Live control surface for research, ops, and experimentation.",
  };
}

export function TopBar() {
  const pathname = usePathname();
  const meta = resolvePageMeta(pathname);
  const grouped = useMemo(() => {
    const out: Record<PanelSection, typeof PANELS> = {
      sources: [],
      chat: [],
      diagnostics: [],
      experiments: [],
      dataset_training: [],
      admin: [],
    };
    for (const panel of PANELS) {
      if (isPanelLive(panel)) out[panel.section].push(panel);
    }
    return out;
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--hex-border)] bg-[var(--hex-panel)]/85 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 sm:px-8 lg:px-10">
        <div>
          <div className="text-lg font-semibold tracking-tight">
            {meta.title}
          </div>
          <div className="text-xs text-[var(--hex-ink-soft)]">
            {meta.description}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="xl:hidden">
            <select
              className="hex-input"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) window.location.assign(e.target.value);
              }}
            >
              <option value="">Jump to live panel</option>
              {SECTION_ORDER.map((section) => (
                <optgroup key={section} label={SECTION_LABELS[section]}>
                  {grouped[section].map((panel) => (
                    <option key={panel.id} value={`/panel/${panel.id}`}>
                      {panel.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <Link className="hex-button-outline" href="/panel/system_status">
            System Status
          </Link>
          <Link className="hex-button" href="/panel/chat">
            Open Chat
          </Link>
        </div>
      </div>
    </header>
  );
}
