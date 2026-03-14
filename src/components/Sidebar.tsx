"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PANELS,
  SECTION_ORDER,
  SECTION_LABELS,
  type PanelSection,
  type PanelDef,
} from "@/lib/panels";

/* ── Additional panels not yet in panels.ts ─────────────────── */
const EXTRA_ADMIN_PANELS: { id: string; label: string }[] = [
  { id: "quality", label: "Quality" },
  { id: "decisions", label: "Decisions" },
  { id: "narratives", label: "Narratives" },
  { id: "measurements", label: "Measurements" },
  { id: "reasoning", label: "Reasoning" },
  { id: "planning", label: "Planning" },
  { id: "cognition", label: "Cognition" },
];

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  engineStatus: "ok" | "down" | "unknown";
};

/* ── Hexagon SVG brand mark ─────────────────────────────────── */
function HexIcon() {
  return (
    <svg
      width="28"
      height="32"
      viewBox="0 0 28 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M14 0L27.856 8V24L14 32L0.144 24V8L14 0Z"
        fill="var(--hc-accent)"
      />
      <path
        d="M14 6L22.66 11V21L14 26L5.34 21V11L14 6Z"
        fill="var(--hc-bg)"
      />
      <path
        d="M14 10L19.196 13V19L14 22L8.804 19V13L14 10Z"
        fill="var(--hc-accent)"
      />
    </svg>
  );
}

/* ── Section icons ──────────────────────────────────────────── */
function SectionIcon({ section }: { section: PanelSection }) {
  const props = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (section) {
    case "sources":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case "chat":
      return (
        <svg {...props}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "diagnostics":
      return (
        <svg {...props}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case "experiments":
      return (
        <svg {...props}>
          <path d="M9 3h6v4H9zM4 7h16l-2 14H6z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      );
    case "dataset_training":
      return (
        <svg {...props}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
    case "admin":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    default:
      return null;
  }
}

/* ── Collapsible nav section ────────────────────────────────── */
function NavSection({
  section,
  panels,
  extras,
  activePanelId,
  defaultOpen,
}: {
  section: PanelSection;
  panels: PanelDef[];
  extras?: { id: string; label: string }[];
  activePanelId: string | null;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const allIds = [
    ...panels.map((p) => p.id),
    ...(extras || []).map((e) => e.id),
  ];
  const hasActive = activePanelId !== null && allIds.includes(activePanelId);

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors"
        style={{
          color: hasActive ? "var(--hc-accent)" : "var(--hc-text-muted)",
        }}
      >
        <SectionIcon section={section} />
        <span className="flex-1 text-left">{SECTION_LABELS[section]}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 150ms ease",
          }}
        >
          <polyline points="4 2 8 6 4 10" />
        </svg>
      </button>

      {open && (
        <div className="ml-3 mr-2 flex flex-col gap-0.5">
          {panels.map((panel) => {
            const isActive = activePanelId === panel.id;
            return (
              <Link
                key={panel.id}
                href={`/panel/${panel.id}`}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors relative"
                style={{
                  color: isActive ? "var(--hc-text)" : "var(--hc-text-muted)",
                  background: isActive ? "var(--hc-bg-soft)" : "transparent",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full"
                    style={{
                      height: "60%",
                      background: "var(--hc-accent)",
                    }}
                  />
                )}
                {panel.label}
              </Link>
            );
          })}
          {extras?.map((extra) => {
            const isActive = activePanelId === extra.id;
            return (
              <Link
                key={extra.id}
                href={`/panel/${extra.id}`}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors relative"
                style={{
                  color: isActive ? "var(--hc-text)" : "var(--hc-text-muted)",
                  background: isActive ? "var(--hc-bg-soft)" : "transparent",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full"
                    style={{
                      height: "60%",
                      background: "var(--hc-accent)",
                    }}
                  />
                )}
                {extra.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Sidebar component ──────────────────────────────────────── */
export default function Sidebar({ open, onClose, engineStatus }: SidebarProps) {
  const pathname = usePathname();

  const activePanelId = pathname?.startsWith("/panel/")
    ? pathname.split("/panel/")[1]?.split("/")[0] ?? null
    : null;

  /* Group panels by section from panels.ts */
  const grouped: Record<PanelSection, PanelDef[]> = {
    sources: [],
    chat: [],
    diagnostics: [],
    experiments: [],
    dataset_training: [],
    admin: [],
  };
  for (const panel of PANELS) {
    grouped[panel.section].push(panel);
  }

  const statusDot =
    engineStatus === "ok"
      ? "var(--hc-green)"
      : engineStatus === "down"
        ? "var(--hc-active)"
        : "var(--hc-text-muted)";

  const sidebarContent = (
    <div
      className="flex flex-col h-full"
      style={{
        background: "var(--hc-bg)",
        borderRight: "1px solid var(--hc-border)",
      }}
    >
      {/* Brand header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-2">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <HexIcon />
          <div className="flex flex-col">
            <span
              className="text-base font-bold tracking-tight leading-tight"
              style={{ color: "var(--hc-heading)", fontFamily: "var(--font-heading)" }}
            >
              HexCarb
            </span>
            <span
              className="text-[11px] font-medium uppercase tracking-widest"
              style={{ color: "var(--hc-text-muted)" }}
            >
              AI Console
            </span>
          </div>
        </Link>

        {/* Engine status indicator */}
        <div
          className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{
            background: "var(--hc-bg-soft)",
            color: "var(--hc-text-muted)",
          }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ background: statusDot }}
          />
          <span>
            Engine{" "}
            <span style={{ color: statusDot, fontWeight: 600 }}>
              {engineStatus === "ok"
                ? "online"
                : engineStatus === "down"
                  ? "offline"
                  : "checking..."}
            </span>
          </span>
        </div>
      </div>

      {/* Home link */}
      <div className="px-3 mb-2">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          style={{
            color:
              pathname === "/" ? "var(--hc-text)" : "var(--hc-text-muted)",
            background: pathname === "/" ? "var(--hc-bg-soft)" : "transparent",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Dashboard
        </Link>
      </div>

      {/* Scrollable nav sections */}
      <nav className="flex-1 overflow-y-auto pb-4">
        {SECTION_ORDER.map((section) => {
          const isActive =
            activePanelId !== null &&
            (grouped[section].some((p) => p.id === activePanelId) ||
              (section === "admin" &&
                EXTRA_ADMIN_PANELS.some((e) => e.id === activePanelId)));

          return (
            <NavSection
              key={section}
              section={section}
              panels={grouped[section]}
              extras={section === "admin" ? EXTRA_ADMIN_PANELS : undefined}
              activePanelId={activePanelId}
              defaultOpen={isActive || section === "chat"}
            />
          );
        })}
      </nav>

      {/* Bottom watermark */}
      <div
        className="px-5 py-3 text-[10px] font-medium uppercase tracking-widest"
        style={{
          color: "var(--hc-text-muted)",
          borderTop: "1px solid var(--hc-border)",
          opacity: 0.6,
        }}
      >
        HexCarb AI v0.1
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar: fixed */}
      <aside
        className="hidden lg:flex fixed top-0 left-0 h-dvh z-40 flex-col"
        style={{ width: "var(--sidebar-width)" }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar: overlay drawer */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={onClose}
          />
          {/* Drawer */}
          <aside
            className="lg:hidden fixed top-0 left-0 h-dvh z-50 flex flex-col"
            style={{
              width: "var(--sidebar-width)",
              animation: "slideInLeft 200ms ease",
            }}
          >
            {sidebarContent}
          </aside>
          <style>{`
            @keyframes slideInLeft {
              from { transform: translateX(-100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </>
      )}
    </>
  );
}
