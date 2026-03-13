"use client";

import Link from "next/link";

import type { PanelDef } from "@/lib/panels";
import { EngineRunner } from "@/components/EngineRunner";
import { ChatPanel } from "@/components/ChatPanel";

export function PanelPage(props: { panel: PanelDef }) {
  const { panel } = props;
  const defaultCall = panel.quickCalls.find((c) => c.method === "GET") ||
    panel.quickCalls[0];

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-zinc-500">
            <Link href="/" className="hover:underline">
              Console
            </Link>
            <span className="px-2">/</span>
            <span className="font-mono text-zinc-700">{panel.id}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
            {panel.label}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">{panel.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Back
          </Link>
          <Link
            href="/panel/chat"
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Chat
          </Link>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        {panel.id === "chat" ? <ChatPanel /> : null}

        <EngineRunner
          title={panel.id === "chat" ? "API Runner (Advanced)" : "API Runner"}
          initialMethod={defaultCall?.method}
          initialPath={defaultCall?.path}
          initialBody={defaultCall?.body ? JSON.stringify(defaultCall.body, null, 2) : "{}"}
          quickCalls={panel.quickCalls}
        />
      </div>

      <div className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-700">
        <div className="font-semibold text-zinc-900">Notes</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            All requests go through the server-side proxy at{" "}
            <span className="font-mono">/api/engine/*</span>, which injects the
            API key.
          </li>
          <li>
            Streaming endpoints are supported: NDJSON (<span className="font-mono">application/x-ndjson</span>) and SSE (<span className="font-mono">text/event-stream</span>).
          </li>
          <li>
            If a Quick Call body doesn’t match your engine build, use the API
            Runner to adjust it.
          </li>
        </ul>
      </div>
    </div>
  );
}
