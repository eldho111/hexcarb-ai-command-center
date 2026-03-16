"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { PanelDef } from "@/lib/panels";
import { COMPARTMENT_LABELS } from "@/lib/panels";
import type { ListDetailConfig } from "@/components/views/ListDetailView";
import type { DashboardConfig } from "@/components/views/DashboardView";
import type { FormActionConfig } from "@/components/views/FormActionView";
import type { WorkflowConfig } from "@/components/views/WorkflowView";
import type { CrudConfig } from "@/components/views/CrudView";

import { ListDetailView } from "@/components/views/ListDetailView";
import { DashboardView } from "@/components/views/DashboardView";
import { FormActionView } from "@/components/views/FormActionView";
import { WorkflowView } from "@/components/views/WorkflowView";
import { CrudView } from "@/components/views/CrudView";
import { ChatPanel } from "@/components/ChatPanel";
import { LeadIntelPanel } from "@/components/LeadIntelPanel";
import { CompanyPlannerPanel } from "@/components/CompanyPlannerPanel";
import { EngineRunner } from "@/components/EngineRunner";
import { IngestPanel } from "@/components/IngestPanel";
import { InstructionBanner } from "@/components/widgets/InstructionBanner";
import { RelatedLinks } from "@/components/widgets/RelatedLinks";

type PanelBehaviorTone = "assistant" | "native" | "reader";

type PanelBehavior = {
  label: string;
  detail: string;
  endpoint?: string;
  tone: PanelBehaviorTone;
};

function ViewRouter({ panel }: { panel: PanelDef }) {
  switch (panel.viewType) {
    case "ingest":
      return <IngestPanel />;
    case "lead-intel":
      return <LeadIntelPanel />;
    case "company-planner":
      return <CompanyPlannerPanel />;
    case "chat":
      return <ChatPanel />;
    case "list-detail":
      return <ListDetailView config={panel.viewConfig as ListDetailConfig} />;
    case "dashboard":
      return <DashboardView config={panel.viewConfig as DashboardConfig} />;
    case "form-action":
      return <FormActionView config={panel.viewConfig as FormActionConfig} />;
    case "workflow":
      return <WorkflowView config={panel.viewConfig as WorkflowConfig} />;
    case "crud":
      return <CrudView config={panel.viewConfig as CrudConfig} />;
    case "runner":
    default:
      return null;
  }
}

function compartmentBadgeStyle(compartment: string): { surface: string; border: string; color: string } {
  switch (compartment) {
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
      return { surface: "var(--hc-surface-muted)", border: "var(--hc-surface-muted-border)", color: "var(--hc-heading)" };
  }
}

function behaviorStyle(tone: PanelBehaviorTone): { background: string; border: string; color: string } {
  switch (tone) {
    case "assistant":
      return { background: "rgba(78,124,116,0.12)", border: "rgba(78,124,116,0.24)", color: "var(--hc-green)" };
    case "reader":
      return { background: "rgba(95,120,154,0.12)", border: "rgba(95,120,154,0.24)", color: "#496c8d" };
    case "native":
    default:
      return { background: "var(--hc-surface-muted)", border: "var(--hc-surface-muted-border)", color: "var(--hc-text)" };
  }
}

function describePanelBehavior(panel: PanelDef): PanelBehavior {
  if (panel.id === "chat" || panel.viewType === "chat") {
    return {
      label: "Canonical chat workspace",
      detail: "This is the main HexCarb chat window. It uses /api/chat as the stable conversation path and can opt into /api/engine/chat_stream for advanced streaming with automatic fallback.",
      endpoint: "/api/chat • /api/engine/chat_stream",
      tone: "assistant",
    };
  }

  if (panel.viewType === "dashboard" || panel.viewType === "lead-intel") {
    return {
      label: "Dashboard / reader",
      detail: "This panel primarily reads live engine endpoints and presents state, health, or inventory rather than acting as a general generation tool.",
      tone: "reader",
    };
  }

  if (panel.viewType === "form-action") {
    const config = panel.viewConfig as FormActionConfig | undefined;
    if (config?.submitEndpoint === "/chat") {
      return {
        label: "AI assistant workflow",
        detail: "This workflow intentionally uses the main model layer via /chat to generate guidance, drafts, or triage steps.",
        endpoint: "/chat",
        tone: "assistant",
      };
    }
    return {
      label: "Native tool",
      detail: "This workflow runs a dedicated backend action instead of the general chat surface.",
      endpoint: config?.submitEndpoint,
      tone: "native",
    };
  }

  if (panel.viewType === "company-planner") {
    return {
      label: "Native tool",
      detail: "This workspace builds planning context through dedicated planning endpoints and can still generate AI-assisted next actions from that structured state.",
      endpoint: "/planning/company • /planning/next",
      tone: "native",
    };
  }

  if (panel.viewType === "ingest") {
    return {
      label: "Native tool",
      detail: "This workspace uploads and ingests source material into the engine knowledge base using dedicated ingest endpoints.",
      endpoint: "/ingest_files • /ingest_path",
      tone: "native",
    };
  }

  if (panel.viewType === "runner") {
    return {
      label: "Native tool",
      detail: "This panel exposes direct raw engine access for advanced diagnostics and does not depend on the general chat route.",
      tone: "native",
    };
  }

  return {
    label: "Native tool",
    detail: "This workspace uses dedicated engine endpoints and structured data flows rather than the general chat surface.",
    tone: "native",
  };
}

export function PanelPage(props: { panel: PanelDef }) {
  const { panel } = props;
  const compartmentLabel = COMPARTMENT_LABELS[panel.compartment] ?? panel.compartment;
  const [runnerOpen, setRunnerOpen] = useState(false);

  const defaultCall = panel.quickCalls.find((call) => call.method === "GET") || panel.quickCalls[0];
  const showRunner = panel.viewType === "runner";
  const theme = compartmentBadgeStyle(panel.compartment);
  const featuredCalls = useMemo(() => panel.quickCalls.slice(0, 3), [panel.quickCalls]);
  const behavior = useMemo(() => describePanelBehavior(panel), [panel]);
  const behaviorColors = behaviorStyle(behavior.tone);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-5 py-10">
      <section className="hc-card relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 12% 18%, rgba(142,106,53,0.18), transparent 26%), radial-gradient(circle at 88% 12%, rgba(78,124,116,0.14), transparent 24%), linear-gradient(135deg, var(--hc-surface-muted), transparent)",
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="flex max-w-3xl items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border text-lg font-semibold uppercase tracking-[0.18em]" style={{ background: theme.surface, borderColor: theme.border, color: theme.color }}>
              {panel.label.slice(0, 2)}
            </div>
            <div>
              <nav className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--hc-text-muted)" }}>
                <Link href="/" className="transition-colors hover:underline" style={{ color: "var(--hc-accent)" }}>
                  Founder Dashboard
                </Link>
                <span className="px-1 opacity-50">/</span>
                <span>{compartmentLabel}</span>
                <span className="px-1 opacity-50">/</span>
                <span style={{ color: "var(--hc-text)" }}>{panel.label}</span>
              </nav>

              <h1 className="mt-3 text-3xl font-semibold tracking-tight" style={{ color: "var(--hc-heading)" }}>
                {panel.label}
              </h1>
              <p className="mt-2 text-sm leading-7" style={{ color: "var(--hc-text-muted)" }}>
                {panel.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ background: theme.surface, borderColor: theme.border, color: theme.color }}>
                  {compartmentLabel}
                </span>
                <span className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ background: "var(--hc-surface-chip)", borderColor: "var(--hc-border)", color: "var(--hc-text-muted)" }}>
                  {panel.viewType.replace(/-/g, " ")}
                </span>
              </div>

              <div className="mt-4 rounded-2xl border px-4 py-3" style={{ background: "var(--hc-surface-elevated)", borderColor: behaviorColors.border }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ background: behaviorColors.background, color: behaviorColors.color }}>
                    {behavior.label}
                  </span>
                  {behavior.endpoint ? (
                    <span className="text-[11px] font-medium" style={{ color: "var(--hc-text-muted)" }}>
                      {behavior.endpoint}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--hc-text-muted)" }}>
                  {behavior.detail}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <Link href="/" className="hc-btn hc-btn-ghost text-xs">
              Overview
            </Link>
            {panel.id !== "chat" ? (
              <Link href="/panel/chat" className="hc-btn hc-btn-primary text-xs">
                Chat
              </Link>
            ) : null}
          </div>
        </div>

        {featuredCalls.length > 0 ? (
          <div className="relative mt-6 grid gap-3 md:grid-cols-3">
            {featuredCalls.map((call) => (
              <div key={`${call.method}-${call.path}`} className="rounded-2xl border p-4" style={{ background: "var(--hc-surface-elevated)", borderColor: "var(--hc-border)" }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                    {call.label}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ background: theme.surface, color: theme.color }}>
                    {call.method}
                  </span>
                </div>
                <div className="mt-2 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
                  {call.path}
                </div>
                {call.hint ? (
                  <div className="mt-2 text-[11px] leading-5" style={{ color: "var(--hc-text-muted)" }}>
                    {call.hint}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <InstructionBanner panelId={panel.id} instructions={panel.instructions} tips={panel.tips} />

      <div>
        <ViewRouter panel={panel} />
      </div>

      {panel.relatedPanels && panel.relatedPanels.length > 0 ? <RelatedLinks links={panel.relatedPanels} /> : null}

      <div>
        {showRunner ? (
          <div className="hc-card overflow-hidden p-0">
            <EngineRunner
              title="API Runner"
              initialMethod={defaultCall?.method}
              initialPath={defaultCall?.path}
              initialBody={defaultCall?.body ? JSON.stringify(defaultCall.body, null, 2) : "{}"}
              quickCalls={panel.quickCalls}
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-[22px] border" style={{ border: "1px solid var(--hc-border)" }}>
            <button
              type="button"
              onClick={() => setRunnerOpen((value) => !value)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-black/[.03]"
              style={{ color: "var(--hc-text-muted)", background: "var(--hc-bg-soft)" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: runnerOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms" }}>
                <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="flex-1">Advanced: API Runner</span>
              <span className="text-[10px] opacity-50">Direct HTTP access to engine endpoints</span>
            </button>
            {runnerOpen ? (
              <div style={{ borderTop: "1px solid var(--hc-border)" }}>
                <EngineRunner
                  title="API Runner"
                  initialMethod={defaultCall?.method}
                  initialPath={defaultCall?.path}
                  initialBody={defaultCall?.body ? JSON.stringify(defaultCall.body, null, 2) : "{}"}
                  quickCalls={panel.quickCalls}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
