"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import {
  COMPARTMENT_LABELS,
  PANELS,
  PRIMARY_NAV_ITEMS,
  WORKSPACES,
  getPanelById,
  type WorkspaceId,
} from "@/lib/panels";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  engineStatus: "ready" | "degraded" | "down" | "booting" | "unknown";
  engineHint?: string | null;
  engineIssueCount?: number;
  inboxCount?: number;
  workspaceBadges?: Partial<Record<WorkspaceId | "dashboard", number>>;
  onOpenAssistant: () => void;
  onOpenInbox: () => void;
  onOpenQuickSwitch: () => void;
};

function HexIcon() {
  return (
    <svg width="28" height="32" viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0L27.856 8V24L14 32L0.144 24V8L14 0Z" fill="var(--hc-accent)" />
      <path d="M14 6L22.66 11V21L14 26L5.34 21V11L14 6Z" fill="var(--hc-bg)" />
      <path d="M14 10L19.196 13V19L14 22L8.804 19V13L14 10Z" fill="var(--hc-accent)" />
    </svg>
  );
}

function navTheme(id: string): { surface: string; border: string; color: string } {
  switch (id) {
    case "dashboard":
      return { surface: "var(--hc-surface-muted)", border: "var(--hc-surface-muted-border)", color: "var(--hc-heading)" };
    case "projects":
      return { surface: "rgba(142,106,53,0.12)", border: "rgba(142,106,53,0.24)", color: "var(--hc-accent)" };
    case "rnd":
      return { surface: "rgba(78,124,116,0.12)", border: "rgba(78,124,116,0.24)", color: "var(--hc-green)" };
    case "growth":
      return { surface: "rgba(95,120,154,0.12)", border: "rgba(95,120,154,0.24)", color: "#496c8d" };
    case "operations":
      return { surface: "rgba(196,129,77,0.12)", border: "rgba(196,129,77,0.24)", color: "#8a5b2f" };
    case "engine":
      return { surface: "rgba(109,124,167,0.12)", border: "rgba(109,124,167,0.24)", color: "#52659a" };
    default:
      return { surface: "var(--hc-surface-muted-strong)", border: "var(--hc-surface-muted-border)", color: "var(--hc-text-muted)" };
  }
}

function NavIcon({ id }: { id: string }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (id) {
    case "dashboard":
      return (
        <svg {...props}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case "projects":
      return (
        <svg {...props}>
          <path d="M3 7h7v7H3z" />
          <path d="M14 7h7v4h-7z" />
          <path d="M14 15h7v6h-7z" />
          <path d="M3 18h7v3H3z" />
        </svg>
      );
    case "rnd":
      return (
        <svg {...props}>
          <path d="M9 3h6v4H9z" />
          <path d="M4 7h16l-2 14H6z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      );
    case "growth":
      return (
        <svg {...props}>
          <polyline points="4 14 9 9 13 13 20 6" />
          <polyline points="16 6 20 6 20 10" />
          <path d="M4 20h16" />
        </svg>
      );
    case "operations":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v-.09a1.65 1.65 0 0 0 1-1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case "engine":
      return (
        <svg {...props}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <path d="M12 2v20" />
          <path d="M2 12h20" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

export default function Sidebar({
  open,
  onClose,
  engineStatus,
  engineHint,
  engineIssueCount = 0,
  inboxCount = 0,
  workspaceBadges = {},
  onOpenAssistant,
  onOpenInbox,
  onOpenQuickSwitch,
}: SidebarProps) {
  const pathname = usePathname() || "/";
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const activeWorkspaceId = useMemo(() => {
    if (pathname === "/") return "dashboard";
    if (pathname.startsWith("/workspace/")) {
      return pathname.split("/workspace/")[1]?.split("/")[0] || "dashboard";
    }
    if (pathname.startsWith("/panel/")) {
      const panelId = pathname.split("/panel/")[1]?.split("/")[0] || "";
      const panel = getPanelById(panelId);
      return panel?.workspaceId || "dashboard";
    }
    return "dashboard";
  }, [pathname]);

  const advancedPanels = useMemo(() => PANELS.filter((panel) => panel.advanced), []);
  const workspaceDescriptions = Object.fromEntries(WORKSPACES.map((workspace) => [workspace.id, workspace.description]));
  const dashboardDescription = "Shared founder and team overview with focus, alerts, and workspace health.";
  const statusColor =
    engineStatus === "ready"
      ? "var(--hc-green)"
      : engineStatus === "degraded"
        ? "var(--hc-accent)"
        : engineStatus === "down"
          ? "var(--hc-active)"
          : engineStatus === "booting"
            ? "#52659a"
            : "var(--hc-text-muted)";

  return (
    <>
      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-30 bg-black/30 transition-opacity lg:hidden ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed left-0 top-0 z-40 flex h-dvh w-[var(--sidebar-width)] flex-col border-r transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-[104%]"} lg:translate-x-0`}
        style={{
          background: "var(--hc-bg)",
          borderColor: "var(--hc-border)",
        }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="flex items-center gap-3" onClick={onClose}>
            <HexIcon />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-accent)" }}>
                HexCarb AI Engine
              </div>
              <div className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                Main windows
              </div>
            </div>
          </Link>
          <button type="button" onClick={onClose} className="lg:hidden hc-btn hc-btn-ghost text-xs">
            Close
          </button>
        </div>

        <div className="px-4 pb-3">
          <div
            className="rounded-[24px] border px-4 py-3"
            style={{ background: "var(--hc-surface-chip)", borderColor: statusColor }}
            title={engineHint || undefined}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
                  Engine
                </div>
                <div className="mt-1 text-sm font-semibold" style={{ color: statusColor }}>
                  {COMPARTMENT_LABELS.engine}
                </div>
              </div>
              <span className="inline-flex h-3 w-3 rounded-full" style={{ background: statusColor }} />
            </div>
            <div className="mt-2 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
              {engineHint || (engineIssueCount > 0 ? `${engineIssueCount} runtime issues need attention.` : "Runtime signals look steady.")}
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-3 pb-4">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const theme = navTheme(item.id);
            const active = activeWorkspaceId === item.id;
            const badge = workspaceBadges[item.id as WorkspaceId | "dashboard"] || 0;
            const description = item.id === "dashboard" ? dashboardDescription : workspaceDescriptions[item.id] || "Primary workspace";

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                className="flex items-start gap-3 rounded-[24px] border px-3 py-3 transition-colors"
                style={{
                  background: active ? theme.surface : "transparent",
                  borderColor: active ? theme.border : "transparent",
                  color: active ? theme.color : "var(--hc-text-muted)",
                }}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                  style={{ background: theme.surface, borderColor: theme.border, color: theme.color }}
                >
                  <NavIcon id={item.id} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: active ? theme.color : "var(--hc-heading)" }}>
                    {item.label}
                  </span>
                  <span className="mt-1 block text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
                    {description}
                  </span>
                </span>
                {badge > 0 ? (
                  <span
                    className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                    style={{ borderColor: theme.border, color: theme.color }}
                  >
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}

          <div className="rounded-[24px] border p-3" style={{ background: "var(--hc-surface-chip)", borderColor: "var(--hc-border)" }}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
              Global Tools
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={onOpenAssistant}
                className="flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-sm font-medium"
                style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)", color: "var(--hc-text)" }}
              >
                <span>Assistant</span>
                <span className="text-[11px]" style={{ color: "var(--hc-text-muted)" }}>
                  Chat
                </span>
              </button>
              <button
                type="button"
                onClick={onOpenInbox}
                className="flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-sm font-medium"
                style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)", color: "var(--hc-text)" }}
              >
                <span>Inbox</span>
                {inboxCount > 0 ? (
                  <span className="text-[11px]" style={{ color: "var(--hc-text-muted)" }}>
                    {inboxCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={onOpenQuickSwitch}
                className="flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-sm font-medium"
                style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)", color: "var(--hc-text)" }}
              >
                <span>Quick Switch</span>
                <span className="text-[11px]" style={{ color: "var(--hc-text-muted)" }}>
                  Cmd/Ctrl+K
                </span>
              </button>
            </div>
          </div>

          <div className="rounded-[24px] border p-3" style={{ background: "var(--hc-surface-chip)", borderColor: "var(--hc-border)" }}>
            <button
              type="button"
              onClick={() => setAdvancedOpen((value) => !value)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
                Advanced
              </span>
              <span className="text-xs" style={{ color: "var(--hc-text-muted)" }}>
                {advancedPanels.length}
              </span>
            </button>
            {advancedOpen ? (
              <div className="mt-3 space-y-2">
                {advancedPanels.map((panel) => (
                  <Link
                    key={panel.id}
                    href={`/panel/${panel.id}`}
                    onClick={onClose}
                    className="block rounded-2xl border px-3 py-2 text-sm transition-colors hover:bg-black/[.03]"
                    style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)", color: "var(--hc-text)" }}
                  >
                    <div className="font-semibold">{panel.label}</div>
                    <div className="mt-1 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
                      {panel.description}
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </nav>
      </aside>
    </>
  );
}
