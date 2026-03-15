"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { PanelDef } from "@/lib/panels";
import { isPanelLive } from "@/lib/panels";
import { EngineRunner } from "@/components/EngineRunner";
import { ChatPanel } from "@/components/ChatPanel";
import { LeadIntelPanel } from "@/components/LeadIntelPanel";

export function PanelPage(props: { panel: PanelDef }) {
  const { panel } = props;
  const live = isPanelLive(panel);
  const defaultCall = live
    ? panel.quickCalls.find((call) => call.method === "GET") || panel.quickCalls[0]
    : undefined;

  const endpoints = useMemo(
    () => panel.quickCalls.map((call) => `${call.method} ${call.path}`),
    [panel.quickCalls],
  );

  return (
    <div className="space-y-8">
      <div className="hex-card px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs text-[var(--hex-ink-soft)]">
              <Link href="/" className="hover:underline">
                Command Center
              </Link>
              <span className="px-2">/</span>
              <span className="font-mono text-[var(--hex-ink-muted)]">
                {panel.id}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">{panel.label}</h1>
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
            <p className="mt-2 max-w-2xl text-sm text-[var(--hex-ink-muted)]">
              {panel.description}
            </p>
            {panel.availabilityNote ? (
              <p className="mt-3 max-w-2xl text-sm text-[var(--hex-ink-soft)]">
                {panel.availabilityNote}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Link className="hex-button-outline" href="/">
              Back to Dashboard
            </Link>
            <Link className="hex-button" href="/panel/chat">
              Open Chat
            </Link>
          </div>
        </div>
      </div>

      {!live ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <section className="hex-card px-6 py-6">
              <div className="hex-section-title">Availability</div>
              <h2 className="mt-2 text-xl font-semibold">
                This panel is not yet wired to this engine build.
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-[var(--hex-ink-muted)]">
                The console keeps this panel visible so the roadmap stays clear,
                but the backend routes behind it are not available in the
                current FastAPI deployment. Use one of the live panels for now
                while we keep the unsupported surface area non-destructive.
              </p>
            </section>
          </div>

          <aside className="space-y-6 lg:col-span-4">
            <div className="hex-card px-5 py-4">
              <div className="hex-section-title">Suggested next step</div>
              <div className="mt-3 text-sm text-[var(--hex-ink-muted)]">
                Try <span className="font-semibold">System Status</span> to
                inspect the running engine, or head back to the dashboard for a
                live panel.
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {panel.id === "chat" ? <ChatPanel /> : null}
            {panel.id === "lead_intel" ? <LeadIntelPanel /> : null}

            <EngineRunner
              title={panel.id === "chat" || panel.id === "lead_intel" ? "API Runner (Advanced)" : "API Runner"}
              initialMethod={defaultCall?.method}
              initialPath={defaultCall?.path}
              initialBody={defaultCall?.body ? JSON.stringify(defaultCall.body, null, 2) : "{}"}
              quickCalls={panel.quickCalls}
            />
          </div>

          <aside className="space-y-6 lg:col-span-4">
            <div className="hex-card px-5 py-4">
              <div className="hex-section-title">Panel endpoints</div>
              <div className="mt-3 space-y-2 text-xs text-[var(--hex-ink-muted)]">
                {endpoints.map((endpoint) => (
                  <div
                    key={endpoint}
                    className="rounded-lg border border-[var(--hex-border)] bg-white px-3 py-2 font-mono"
                  >
                    {endpoint}
                  </div>
                ))}
              </div>
            </div>

            <div className="hex-card px-5 py-4">
              <div className="hex-section-title">Notes</div>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-xs text-[var(--hex-ink-muted)]">
                <li>
                  All requests flow through the server-side proxy at
                  <span className="font-mono"> /api/engine/*</span>.
                </li>
                <li>
                  Streaming NDJSON and SSE endpoints are supported in the runner.
                </li>
                <li>
                  If a Quick Call body needs adjustment, edit the JSON before
                  sending.
                </li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
