"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import type { AppMeta } from "@/lib/meta";

type TopBarProps = {
  panelLabel?: string;
  compartmentLabel?: string;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  theme: "light" | "dark";
  engineStatus: "ready" | "degraded" | "down" | "booting" | "unknown";
  engineHint?: string | null;
  engineIssueCount?: number;
  appMeta?: AppMeta | null;
};

function Pill({ children }: { children: ReactNode }) {
  return (
    <div
      className="hidden items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold md:flex"
      style={{
        border: "1px solid var(--hc-border)",
        color: "var(--hc-text-muted)",
        background: "var(--hc-surface-chip)",
      }}
    >
      {children}
    </div>
  );
}

export default function TopBar({
  panelLabel,
  compartmentLabel,
  onToggleSidebar,
  onToggleTheme,
  theme,
  engineStatus,
  engineHint,
  engineIssueCount = 0,
  appMeta,
}: TopBarProps) {
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

  const statusText =
    engineStatus === "ready"
      ? "Engine ready"
      : engineStatus === "degraded"
        ? engineIssueCount > 0
          ? `Engine degraded (${engineIssueCount})`
          : "Engine degraded"
      : engineStatus === "down"
        ? "Engine down"
        : engineStatus === "booting"
          ? "Engine booting"
        : "Engine checking";

  const buildLabel = appMeta ? `${appMeta.vercel_env} • ${appMeta.app_commit}` : "build pending";
  const gatewayLabel = appMeta ? `Gateway ${appMeta.gateway_host_label}` : "Gateway pending";
  const onChatPanel = panelLabel === "Cited Chat";

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4"
      style={{
        height: "var(--topbar-height)",
        background: "var(--hc-bg)",
        borderBottom: "1px solid var(--hc-border)",
        backdropFilter: "blur(14px)",
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors lg:hidden"
          style={{ color: "var(--hc-text)" }}
          aria-label="Toggle sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="3" y1="5" x2="17" y2="5" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <line x1="3" y1="15" x2="17" y2="15" />
          </svg>
        </button>

        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-accent)" }}>
            HexCarb AI Engine
          </div>
          <nav className="flex min-w-0 items-center gap-2 text-sm font-medium">
            {compartmentLabel ? <span style={{ color: "var(--hc-text-muted)" }}>{compartmentLabel}</span> : null}
            {compartmentLabel && panelLabel ? <span style={{ color: "var(--hc-text-muted)" }}>/</span> : null}
            {panelLabel ? (
              <span className="truncate" style={{ color: "var(--hc-text)" }}>
                {panelLabel}
              </span>
            ) : null}
          </nav>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Pill>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--hc-accent)" }} />
          {buildLabel}
        </Pill>
        <Pill>{gatewayLabel}</Pill>

        <Link href="/panel/chat" className={`hc-btn ${onChatPanel ? "hc-btn-ghost" : "hc-btn-primary"} text-xs`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {onChatPanel ? "Chat Open" : "Open Chat"}
        </Link>

        <div
          className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
          title={engineHint || statusText}
          style={{
            border: `1px solid ${statusColor}`,
            color: statusColor,
            background:
              engineStatus === "ready"
                ? "rgba(78, 124, 116, 0.1)"
                : engineStatus === "degraded"
                  ? "rgba(142, 106, 53, 0.12)"
                  : engineStatus === "down"
                  ? "rgba(245, 100, 84, 0.1)"
                  : engineStatus === "booting"
                    ? "rgba(82, 101, 154, 0.12)"
                  : "var(--hc-surface-chip)",
          }}
        >
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: statusColor }} />
          {statusText}
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
          style={{
            color: "var(--hc-text-muted)",
            border: "1px solid var(--hc-border)",
            background: "var(--hc-surface-chip)",
          }}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
