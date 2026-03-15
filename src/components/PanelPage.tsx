"use client";

import Link from "next/link";
import { useState } from "react";

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

export function PanelPage(props: { panel: PanelDef }) {
  const { panel } = props;
  const compartmentLabel = COMPARTMENT_LABELS[panel.compartment] ?? panel.compartment;
  const [runnerOpen, setRunnerOpen] = useState(false);

  const defaultCall = panel.quickCalls.find((call) => call.method === "GET") || panel.quickCalls[0];
  const showRunner = panel.viewType === "runner";

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
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

          <h1 className="mt-3 text-2xl font-semibold tracking-tight" style={{ color: "var(--hc-heading)" }}>
            {panel.label}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--hc-text-muted)" }}>
            {panel.description}
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      <div className="mt-6">
        <InstructionBanner panelId={panel.id} instructions={panel.instructions} tips={panel.tips} />
      </div>

      <div className="mt-6">
        <ViewRouter panel={panel} />
      </div>

      {panel.relatedPanels && panel.relatedPanels.length > 0 ? (
        <div className="mt-6">
          <RelatedLinks links={panel.relatedPanels} />
        </div>
      ) : null}

      <div className="mt-8">
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
          <div className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--hc-border)" }}>
            <button
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
