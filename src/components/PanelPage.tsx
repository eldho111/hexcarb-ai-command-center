"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { PanelDef } from "@/lib/panels";
import { SECTION_LABELS } from "@/lib/panels";
import { EngineRunner } from "@/components/EngineRunner";
import { ChatPanel } from "@/components/ChatPanel";

export function PanelPage(props: { panel: PanelDef }) {
  const { panel } = props;
  const defaultCall =
    panel.quickCalls.find((c) => c.method === "GET") || panel.quickCalls[0];
  const sectionLabel = SECTION_LABELS[panel.section] ?? panel.section;

  const endpoints = useMemo(
    () => panel.quickCalls.map((call) => `${call.method} ${call.path}`),
    [panel.quickCalls],
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: "var(--hc-text-muted)" }}
          >
            <Link
              href="/"
              className="transition-colors hover:underline"
              style={{ color: "var(--hc-accent)" }}
            >
              Console
            </Link>
            <span className="px-1 opacity-50">/</span>
            <span>{sectionLabel}</span>
            <span className="px-1 opacity-50">/</span>
            <span style={{ color: "var(--hc-text)" }}>{panel.label}</span>
          </nav>

          <h1
            className="mt-3 text-2xl font-semibold tracking-tight"
            style={{ color: "var(--hc-heading)" }}
          >
            {panel.label}
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--hc-text-muted)" }}
          >
            {panel.description}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/" className="hc-btn hc-btn-ghost text-xs">
            Back
          </Link>
          <Link href="/panel/chat" className="hc-btn hc-btn-primary text-xs">
            Chat
          </Link>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="mt-8 space-y-6">
        {panel.id === "chat" && <ChatPanel />}

        <div className="hc-card overflow-hidden p-0">
          <EngineRunner
            title={
              panel.id === "chat" ? "API Runner (Advanced)" : "API Runner"
            }
            initialMethod={defaultCall?.method}
            initialPath={defaultCall?.path}
            initialBody={
              defaultCall?.body
                ? JSON.stringify(defaultCall.body, null, 2)
                : "{}"
            }
            quickCalls={panel.quickCalls}
          />
        </div>
      </div>

      {/* ── Notes ───────────────────────────────────────────────── */}
      <div
        className="mt-10 p-4 text-xs"
        style={{
          background: "var(--hc-bg-soft)",
          border: "1px solid var(--hc-border)",
          borderRadius: "var(--radius-md)",
          color: "var(--hc-text-muted)",
        }}
      >
        <div
          className="font-semibold"
          style={{ color: "var(--hc-text)" }}
        >
          Notes
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            All requests go through the server-side proxy at{" "}
            <span className="font-mono">/api/engine/*</span>, which injects the
            API key.
          </li>
          <li>
            Streaming endpoints are supported: NDJSON (
            <span className="font-mono">application/x-ndjson</span>) and SSE (
            <span className="font-mono">text/event-stream</span>).
          </li>
          <li>
            If a Quick Call body doesn&apos;t match your engine build, use the
            API Runner to adjust it.
          </li>
        </ul>
      </div>
    </div>
  );
}
