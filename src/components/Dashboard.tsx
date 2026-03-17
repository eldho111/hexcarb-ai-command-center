"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/components/widgets/StatusBadge";
import type { CompanyDashboardSnapshot, DashboardAlert, DashboardListItem, DashboardTone } from "@/lib/dashboard";
import { WORKSPACES, type WorkspaceDef, type WorkspaceId } from "@/lib/panels";

const REFRESH_INTERVAL_MS = 30000;

type WorkspaceCardSummary = {
  workspaceId: WorkspaceId;
  tone: DashboardTone;
  eyebrow: string;
  headline: string;
  detail: string;
  metrics: Array<{ label: string; value: string | number }>;
  previewItems: DashboardListItem[];
};

function toneStyles(tone: DashboardTone): { background: string; border: string; color: string } {
  switch (tone) {
    case "success":
      return { background: "rgba(78,124,116,0.12)", border: "rgba(78,124,116,0.24)", color: "var(--hc-green)" };
    case "warning":
      return { background: "rgba(142,106,53,0.12)", border: "rgba(142,106,53,0.24)", color: "var(--hc-accent)" };
    case "critical":
      return { background: "rgba(245,100,84,0.12)", border: "rgba(245,100,84,0.24)", color: "var(--hc-active)" };
    default:
      return { background: "var(--hc-surface-muted)", border: "var(--hc-surface-muted-border)", color: "var(--hc-text-muted)" };
  }
}

function workspaceTheme(workspaceId: WorkspaceId): { surface: string; border: string; color: string } {
  switch (workspaceId) {
    case "projects":
      return { surface: "rgba(142,106,53,0.12)", border: "rgba(142,106,53,0.24)", color: "var(--hc-accent)" };
    case "rnd":
      return { surface: "rgba(78,124,116,0.12)", border: "rgba(78,124,116,0.24)", color: "var(--hc-green)" };
    case "growth":
      return { surface: "rgba(95,120,154,0.12)", border: "rgba(95,120,154,0.24)", color: "#496c8d" };
    case "operations":
      return { surface: "rgba(196,129,77,0.12)", border: "rgba(196,129,77,0.24)", color: "#8a5b2f" };
    case "engine":
    default:
      return { surface: "rgba(109,124,167,0.12)", border: "rgba(109,124,167,0.24)", color: "#52659a" };
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function buildWorkspaceSummary(workspaceId: WorkspaceId, snapshot: CompanyDashboardSnapshot): WorkspaceCardSummary {
  switch (workspaceId) {
    case "projects":
      return {
        workspaceId,
        tone: snapshot.execution.overdue_count > 0 || snapshot.execution.stalled_count > 0 ? "warning" : "success",
        eyebrow: "Projects & execution",
        headline: `${snapshot.kpis.active_projects} active projects in motion`,
        detail: `${snapshot.execution.overdue_count} overdue items and ${snapshot.execution.stalled_count} stalled tasks across the execution lane.`,
        metrics: [
          { label: "Goals", value: snapshot.execution.goals_count },
          { label: "Blocked", value: snapshot.today.blocked_items.length },
        ],
        previewItems: snapshot.today.next_plans.slice(0, 2),
      };
    case "rnd":
      return {
        workspaceId,
        tone: snapshot.rnd.training_ready ? "success" : "warning",
        eyebrow: "Research & development",
        headline: `${snapshot.rnd.experiments_count} experiment records and ${snapshot.rnd.source_count} knowledge sources`,
        detail: snapshot.rnd.training_ready
          ? "Training inputs and research ingest are in a healthy state."
          : "Training readiness still needs more curated input.",
        metrics: [
          { label: "Drafts", value: snapshot.rnd.draft_count },
          { label: "Measurements", value: snapshot.rnd.measurement_count },
        ],
        previewItems: snapshot.today.risk_items.slice(0, 2),
      };
    case "growth":
      return {
        workspaceId,
        tone: snapshot.growth.lead_status.available ? "success" : "warning",
        eyebrow: "Growth & market",
        headline: snapshot.growth.lead_status.available
          ? `${snapshot.growth.lead_status.row_count} ranked lead rows exported`
          : "Lead export needs attention",
        detail: snapshot.growth.lead_status.warning || `${snapshot.growth.news_count} market signals and ${snapshot.growth.funding_count} funding opportunities are available.`,
        metrics: [
          { label: "Funding", value: snapshot.growth.funding_count },
          { label: "Sales", value: snapshot.growth.sales_count },
        ],
        previewItems: snapshot.growth.latest_news.slice(0, 2),
      };
    case "operations":
      return {
        workspaceId,
        tone: snapshot.operations.compliance_due.length > 0 || snapshot.inbox.urgent_count > 0 ? "warning" : "success",
        eyebrow: "Daily operations",
        headline: `${snapshot.operations.compliance_due.length} compliance items due and ${snapshot.inbox.urgent_count} urgent inbox items`,
        detail: `${snapshot.operations.quality.open_deviations} open deviations and ${snapshot.operations.finance_count} finance records are tied to daily operations.`,
        metrics: [
          { label: "Quality", value: snapshot.operations.quality.open_deviations },
          { label: "Finance", value: snapshot.operations.finance_count },
        ],
        previewItems: snapshot.operations.compliance_due.slice(0, 2),
      };
    case "engine":
    default:
      return {
        workspaceId,
        tone: snapshot.engine.mode === "ready" ? "success" : snapshot.engine.mode === "down" ? "critical" : "warning",
        eyebrow: "AI engine",
        headline: `${snapshot.engine.mode} runtime with ${snapshot.engine.module_errors.length} module warnings`,
        detail: snapshot.engine.recovery_hint || `${snapshot.engine.dependency_states.length} dependency checks are currently tracked.`,
        metrics: [
          { label: "GPU", value: snapshot.engine.gpu_available ? "Yes" : "No" },
          { label: "Model", value: snapshot.engine.current_serving_model || "Pending" },
        ],
        previewItems: snapshot.engine.dependency_states.slice(0, 2),
      };
  }
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border px-3 py-3" style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: "var(--hc-heading)" }}>
        {value}
      </div>
    </div>
  );
}

function CompactItem({ item }: { item: DashboardListItem }) {
  return (
    <Link
      href={item.href || "#"}
      className="block rounded-2xl border px-3 py-3 transition-colors hover:bg-black/[.03]"
      style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
            {item.title}
          </div>
          {item.subtitle ? (
            <div className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
              {item.subtitle}
            </div>
          ) : null}
          {item.meta ? (
            <div className="mt-1 text-[11px] leading-5" style={{ color: "var(--hc-text-muted)" }}>
              {item.meta}
            </div>
          ) : null}
        </div>
        {item.status ? <StatusBadge status={item.status} /> : null}
      </div>
    </Link>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed px-3 py-4 text-sm" style={{ borderColor: "var(--hc-border)", color: "var(--hc-text-muted)" }}>
      {label}
    </div>
  );
}

function AlertList({ alerts }: { alerts: DashboardAlert[] }) {
  return (
    <div className="space-y-3">
      {alerts.length ? (
        alerts.map((alert) => {
          const colors = toneStyles(alert.severity);
          return (
            <Link
              key={alert.id}
              href={alert.href || "#"}
              className="block rounded-2xl border px-4 py-4 transition-colors hover:bg-black/[.03]"
              style={{ borderColor: colors.border, background: "var(--hc-bg)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                    {alert.title}
                  </div>
                  {alert.detail ? (
                    <div className="mt-2 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
                      {alert.detail}
                    </div>
                  ) : null}
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{ background: colors.background, color: colors.color }}
                >
                  {alert.severity}
                </span>
              </div>
            </Link>
          );
        })
      ) : (
        <EmptyState label="No urgent alerts were generated in the latest snapshot." />
      )}
    </div>
  );
}

function WorkspaceCard({ workspace, summary }: { workspace: WorkspaceDef; summary: WorkspaceCardSummary }) {
  const theme = workspaceTheme(workspace.id);
  const tone = toneStyles(summary.tone);

  return (
    <article className="rounded-[28px] border p-5" style={{ borderColor: tone.border, background: "var(--hc-surface-elevated)" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.color }}>
            {summary.eyebrow}
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight" style={{ color: "var(--hc-heading)" }}>
            {workspace.label}
          </h2>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ background: theme.surface, color: theme.color, border: `1px solid ${theme.border}` }}
        >
          {workspace.badgeLabel}
        </span>
      </div>
      <p className="mt-3 text-sm leading-7" style={{ color: "var(--hc-text-muted)" }}>
        {summary.headline}
      </p>
      <p className="mt-2 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
        {summary.detail}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {summary.metrics.map((metric) => (
          <MiniMetric key={`${workspace.id}-${metric.label}`} label={metric.label} value={metric.value} />
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {summary.previewItems.length ? (
          summary.previewItems.map((item) => <CompactItem key={`${workspace.id}-${item.id}`} item={item} />)
        ) : (
          <EmptyState label="No compact preview items are available for this workspace yet." />
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={workspace.href} className="hc-btn hc-btn-primary text-xs">
          Open Workspace
        </Link>
        <Link href={`/panel/${workspace.subviews[0]?.defaultPanelId || workspace.subviews[0]?.panelIds[0] || "chat"}`} className="hc-btn hc-btn-ghost text-xs">
          Open Lead Tool
        </Link>
      </div>
    </article>
  );
}

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState<CompanyDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSnapshot() {
      try {
        const response = await fetch("/api/dashboard/company", {
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        });
        if (!mounted || !response.ok) return;
        const payload = (await response.json()) as CompanyDashboardSnapshot;
        if (mounted) setSnapshot(payload);
      } catch {
        if (mounted) setSnapshot(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadSnapshot();
    const interval = window.setInterval(() => {
      void loadSnapshot();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const workspaceCards = useMemo(() => {
    if (!snapshot) return [];
    return WORKSPACES.map((workspace) => ({
      workspace,
      summary: buildWorkspaceSummary(workspace.id, snapshot),
    }));
  }, [snapshot]);

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-8 px-5 py-8">
      <section className="hc-card relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 10% 18%, rgba(142,106,53,0.18), transparent 24%), radial-gradient(circle at 88% 12%, rgba(78,124,116,0.16), transparent 22%), linear-gradient(135deg, var(--hc-surface-muted), transparent)",
          }}
        />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
          <div>
            <div className="hc-kicker">HexCarb Dashboard</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: "var(--hc-heading)" }}>
              {snapshot?.hero.company_name || "HexCarb"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: "var(--hc-text-muted)" }}>
              {snapshot?.hero.subtitle || "Shared overview for execution, R&D, operations, growth, and the AI engine runtime."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ background: "var(--hc-surface-chip)", color: "var(--hc-text-muted)" }}>
                Generated {formatDateTime(snapshot?.generated_at)}
              </span>
              {snapshot?.company_status?.phase ? (
                <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ background: "rgba(95,120,154,0.12)", color: "#496c8d" }}>
                  Phase {snapshot.company_status.phase}
                </span>
              ) : null}
              <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ background: "rgba(109,124,167,0.12)", color: "#52659a" }}>
                Engine {snapshot?.hero.engine_status || "checking"}
              </span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {snapshot?.today.focus_now.length ? (
                snapshot.today.focus_now.slice(0, 4).map((item) => (
                  <span
                    key={item}
                    className="rounded-full border px-3 py-1 text-xs"
                    style={{ borderColor: "var(--hc-border)", color: "var(--hc-text-muted)", background: "var(--hc-bg)" }}
                  >
                    {item}
                  </span>
                ))
              ) : (
                <span className="text-sm" style={{ color: "var(--hc-text-muted)" }}>
                  {loading ? "Loading dashboard focus…" : "No focus items were generated yet."}
                </span>
              )}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/workspace/projects" className="hc-btn hc-btn-primary text-xs">
                Open Projects & Execution
              </Link>
              <Link href="/workspace/engine" className="hc-btn hc-btn-ghost text-xs">
                Open AI Engine
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MiniMetric label="Active Projects" value={snapshot?.kpis.active_projects ?? "…"} />
            <MiniMetric label="Approvals Pending" value={snapshot?.kpis.approvals_pending ?? "…"} />
            <MiniMetric label="Compliance Due" value={snapshot?.kpis.compliance_due_soon ?? "…"} />
            <MiniMetric label="Funding Opportunities" value={snapshot?.kpis.funding_opportunities ?? "…"} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="hc-kicker">Workspace Health</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: "var(--hc-heading)" }}>
              Main windows stay focused by design
            </h2>
          </div>
          <div className="text-sm" style={{ color: "var(--hc-text-muted)" }}>
            Dashboard + 5 workspaces, with utilities kept global.
          </div>
        </div>
        <div className="grid gap-4 2xl:grid-cols-5 xl:grid-cols-3 md:grid-cols-2">
          {workspaceCards.length ? (
            workspaceCards.map(({ workspace, summary }) => (
              <WorkspaceCard key={workspace.id} workspace={workspace} summary={summary} />
            ))
          ) : (
            <div className="rounded-[28px] border p-5" style={{ borderColor: "var(--hc-border)", background: "var(--hc-surface-elevated)" }}>
              <p className="text-sm" style={{ color: "var(--hc-text-muted)" }}>
                {loading ? "Loading workspace health cards…" : "Workspace health cards could not be loaded."}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-[28px] border p-5" style={{ borderColor: "var(--hc-border)", background: "var(--hc-surface-elevated)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
            Urgent Alerts
          </div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight" style={{ color: "var(--hc-heading)" }}>
            What needs attention first
          </h3>
          <div className="mt-4">
            <AlertList alerts={snapshot?.alerts || []} />
          </div>
        </div>

        <div className="rounded-[28px] border p-5" style={{ borderColor: "var(--hc-border)", background: "var(--hc-surface-elevated)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
            Today / Focus
          </div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight" style={{ color: "var(--hc-heading)" }}>
            Plans and blockers
          </h3>
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
                Next Plans
              </div>
              <div className="space-y-2">
                {snapshot?.today.next_plans.length ? (
                  snapshot.today.next_plans.slice(0, 3).map((item) => <CompactItem key={`next-${item.id}`} item={item} />)
                ) : (
                  <EmptyState label="No next plans were generated yet." />
                )}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
                Blocked Work
              </div>
              <div className="space-y-2">
                {snapshot?.today.blocked_items.length ? (
                  snapshot.today.blocked_items.slice(0, 3).map((item) => <CompactItem key={`blocked-${item.id}`} item={item} />)
                ) : (
                  <EmptyState label="No blocked items are currently in the queue." />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border p-5" style={{ borderColor: "var(--hc-border)", background: "var(--hc-surface-elevated)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
            Inbox / Action Center
          </div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight" style={{ color: "var(--hc-heading)" }}>
            Cross-workspace action queue
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MiniMetric label="Unread" value={snapshot?.inbox.unread_count ?? "…"} />
            <MiniMetric label="Urgent" value={snapshot?.inbox.urgent_count ?? "…"} />
          </div>
          <div className="mt-4 space-y-2">
            {snapshot?.inbox.approvals.length ? (
              snapshot.inbox.approvals.slice(0, 3).map((item) => <CompactItem key={`inbox-${item.id}`} item={item} />)
            ) : (
              <EmptyState label="No pending action-center items were returned." />
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_380px]">
        <div className="rounded-[28px] border p-5" style={{ borderColor: "var(--hc-border)", background: "var(--hc-surface-elevated)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
            Company State
          </div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight" style={{ color: "var(--hc-heading)" }}>
            Strategic context without leaving the dashboard
          </h3>
          {snapshot?.company_status ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm leading-7" style={{ color: "var(--hc-text-muted)" }}>
                {snapshot.company_status.summary}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniMetric label="Operating Mode" value={snapshot.company_status.operating_mode} />
                <MiniMetric label="Mapping Mode" value={snapshot.company_status.mapping_mode} />
                <MiniMetric label="Overrides" value={snapshot.company_status.override_count} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
                    Top Risks
                  </div>
                  <div className="space-y-2">
                    {snapshot.company_status.top_risks.length ? (
                      snapshot.company_status.top_risks.slice(0, 4).map((item) => (
                        <div key={item} className="rounded-2xl border px-3 py-3 text-sm" style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)", color: "var(--hc-text-muted)" }}>
                          {item}
                        </div>
                      ))
                    ) : (
                      <EmptyState label="No top risks were returned." />
                    )}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
                    Top Catalysts
                  </div>
                  <div className="space-y-2">
                    {snapshot.company_status.top_catalysts.length ? (
                      snapshot.company_status.top_catalysts.slice(0, 4).map((item) => (
                        <div key={item} className="rounded-2xl border px-3 py-3 text-sm" style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)", color: "var(--hc-text-muted)" }}>
                          {item}
                        </div>
                      ))
                    ) : (
                      <EmptyState label="No catalysts were returned." />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState label="Strategic company-state data is not available yet." />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border p-5" style={{ borderColor: "var(--hc-border)", background: "var(--hc-surface-elevated)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
              Engine Pulse
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight" style={{ color: "var(--hc-heading)" }}>
              Compact runtime preview
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <MiniMetric label="Mode" value={snapshot?.engine.mode || "…"} />
              <MiniMetric label="Model" value={snapshot?.engine.current_serving_model || "Pending"} />
            </div>
            <p className="mt-4 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
              {snapshot?.engine.recovery_hint || "No recovery hint is active right now."}
            </p>
            <div className="mt-4 space-y-2">
              {snapshot?.engine.dependency_states.length ? (
                snapshot.engine.dependency_states.slice(0, 3).map((item) => <CompactItem key={`engine-${item.id}`} item={item} />)
              ) : (
                <EmptyState label="No dependency states were returned." />
              )}
            </div>
          </div>

          <div className="rounded-[28px] border p-5" style={{ borderColor: "var(--hc-border)", background: "var(--hc-surface-elevated)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
              Narrative Context
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight" style={{ color: "var(--hc-heading)" }}>
              Recent decisions and narratives
            </h3>
            <div className="mt-4 space-y-2">
              {[...(snapshot?.activity.decisions || []), ...(snapshot?.activity.narratives || [])].slice(0, 4).length ? (
                [...(snapshot?.activity.decisions || []), ...(snapshot?.activity.narratives || [])]
                  .slice(0, 4)
                  .map((item) => <CompactItem key={`activity-${item.id}`} item={item} />)
              ) : (
                <EmptyState label="Recent decisions and narratives will appear here." />
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
