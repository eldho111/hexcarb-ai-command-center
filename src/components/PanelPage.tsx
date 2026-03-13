"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { PanelDef } from "@/lib/panels";
import { EngineRunner } from "@/components/EngineRunner";
import { ChatPanel } from "@/components/ChatPanel";

export function PanelPage(props: { panel: PanelDef }) {
  const { panel } = props;
  const defaultCall = panel.quickCalls.find((c) => c.method === "GET") ||
    panel.quickCalls[0];

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
            <h1 className="mt-2 text-2xl font-semibold">{panel.label}</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--hex-ink-muted)]">
              {panel.description}
            </p>
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

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {panel.id === "chat" ? <ChatPanel /> : null}

          <EngineRunner
            title={panel.id === "chat" ? "API Runner (Advanced)" : "API Runner"}
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
                <div key={endpoint} className="rounded-lg border border-[var(--hex-border)] bg-white px-3 py-2 font-mono">
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
    </div>
  );
}
