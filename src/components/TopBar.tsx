"use client";

import React from "react";

type TopBarProps = {
  panelLabel?: string;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  theme: "light" | "dark";
  engineStatus: "ok" | "down" | "unknown";
};

export default function TopBar({
  panelLabel,
  onToggleSidebar,
  onToggleTheme,
  theme,
  engineStatus,
}: TopBarProps) {
  const statusColor =
    engineStatus === "ok"
      ? "var(--hc-green)"
      : engineStatus === "down"
        ? "var(--hc-active)"
        : "var(--hc-text-muted)";

  const statusText =
    engineStatus === "ok"
      ? "Engine: ok"
      : engineStatus === "down"
        ? "Engine: down"
        : "Engine: ...";

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 gap-4"
      style={{
        height: "var(--topbar-height)",
        background: "var(--hc-bg)",
        borderBottom: "1px solid var(--hc-border)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Left: hamburger + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
          style={{ color: "var(--hc-text)" }}
          aria-label="Toggle sidebar"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <line x1="3" y1="5" x2="17" y2="5" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <line x1="3" y1="15" x2="17" y2="15" />
          </svg>
        </button>

        <nav className="flex items-center gap-2 text-sm font-medium">
          <span style={{ color: "var(--hc-text-muted)" }}>Console</span>
          {panelLabel && (
            <>
              <span style={{ color: "var(--hc-text-muted)" }}>/</span>
              <span style={{ color: "var(--hc-text)" }}>{panelLabel}</span>
            </>
          )}
        </nav>
      </div>

      {/* Center: reserved for search */}
      <div className="flex-1" />

      {/* Right: engine badge + theme toggle */}
      <div className="flex items-center gap-3">
        {/* Engine status pill */}
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            border: `1px solid ${statusColor}`,
            color: statusColor,
            background:
              engineStatus === "ok"
                ? "rgba(78, 124, 116, 0.1)"
                : engineStatus === "down"
                  ? "rgba(245, 100, 84, 0.1)"
                  : "transparent",
          }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: statusColor }}
          />
          {statusText}
        </div>

        {/* Dark/light mode toggle */}
        <button
          onClick={onToggleTheme}
          className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
          style={{
            color: "var(--hc-text-muted)",
            border: "1px solid var(--hc-border)",
          }}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            /* Sun icon */
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
            /* Moon icon */
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
