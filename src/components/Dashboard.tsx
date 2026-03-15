"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import type {
  CompanyDashboardSnapshot,
  DashboardAlert,
  DashboardListItem,
  DashboardModuleState,
  DashboardTone,
} from "@/lib/dashboard";
import type { AppMeta } from "@/lib/meta";
import { PANELS } from "@/lib/panels";
import { StatusBadge } from "@/components/widgets/StatusBadge";

const REFRESH_INTERVAL_MS = 30000;
const QUICK_ACCESS_IDS = [
  "projects",
  "weekly_plan",
  "chat",
  "doc_ingest",
  "system_status",
  "compliance",
  "lead_intel",
] as const;

function toneStyles(tone: DashboardTone): { background: string; color: string; border: string } {
  switch (tone) {
    case "success":
      return { background: "rgba(78,124,116,0.10)", color: "var(--hc-green)", border: "rgba(78,124,116,0.24)" };
    case "warning":
      return { background: "rgba(142,106,53,0.10)", color: "var(--hc-accent)", border: "rgba(142,106,53,0.24)" };
    case "critical":
      return { background: "rgba(245,100,84,0.10)", color: "var(--hc-active)", border: "rgba(245,100,84,0.24)" };
    default:
      return { background: "rgba(15,25,36,0.06)", color: "var(--hc-text-muted)", border: "rgba(15,25,36,0.12)" };
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

function MetricCard({
  label,
  value,
  detail,
  tone = "info",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: DashboardTone;
}) {
  const colors = toneStyles(tone);
  return (
    <div className="rounded-2xl border p-4" style={{ background: "var(--hc-bg)", borderColor: colors.border }}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight" style={{ color: colors.color }}>
        {value}
      </div>
      <p className="mt-2 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
        {detail}
      </p>
    </div>
  );
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        background: "rgba(255,255,255,0.72)",
        border: "1px solid var(--hc-border)",
        color: "var(--hc-text-muted)",
      }}
    >
      {children}
    </span>
  );
}

function SectionCard({
  title,
  subtitle,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  subtitle: string;
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="hc-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight" style={{ color: "var(--hc-heading)" }}>
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6" style={{ color: "var(--hc-text-muted)" }}>
            {subtitle}
          </p>
        </div>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="hc-btn hc-btn-ghost text-xs">
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function AlertStrip({ alerts }: { alerts: DashboardAlert[] }) {
  if (!alerts.length) return null;
  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {alerts.map((alert) => {
        const colors = toneStyles(alert.severity);
        const content = (
          <div className="rounded-2xl border p-4" style={{ background: colors.background, borderColor: colors.border }}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold" style={{ color: colors.color }}>
                {alert.title}
              </div>
              <StatusBadge status={alert.severity} />
            </div>
            {alert.detail ? (
              <p className="mt-2 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
                {alert.detail}
              </p>
            ) : null}
          </div>
        );
        return alert.href ? <Link key={alert.id} href={alert.href}>{content}</Link> : <div key={alert.id}>{content}</div>;
      })}
    </div>
  );
}

function ItemRow({ item }: { item: DashboardListItem }) {
  const colors = toneStyles(item.tone || "info");
  const body = (
    <div className="rounded-2xl border px-4 py-3 transition-colors" style={{ background: "var(--hc-bg)", borderColor: "var(--hc-border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
            {item.title}
          </div>
          {item.subtitle ? (
            <div className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
              {item.subtitle}
            </div>
          ) : null}
          {item.meta ? (
            <div className="mt-2 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
              {item.meta}
            </div>
          ) : null}
        </div>
        {item.status ? (
          <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize" style={{ background: colors.background, color: colors.color, borderColor: colors.border }}>
            {item.status}
          </span>
        ) : null}
      </div>
    </div>
  );

  return item.href ? <Link href={item.href}>{body}</Link> : body;
}

function ItemList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: DashboardListItem[];
  emptyLabel: string;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-accent)" }}>
        {title}
      </div>
      <div className="space-y-3">
        {items.length ? items.map((item) => <ItemRow key={item.id} item={item} />) : (
          <div className="rounded-2xl border border-dashed px-4 py-5 text-sm" style={{ borderColor: "var(--hc-border)", color: "var(--hc-text-muted)", background: "var(--hc-bg)" }}>
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}

function ModuleGrid({ modules }: { modules: Record<string, DashboardModuleState> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Object.entries(modules).map(([key, value]) => (
        <div key={key} className="rounded-2xl border p-4" style={{ background: "var(--hc-bg)", borderColor: value.ok ? "rgba(78,124,116,0.24)" : "rgba(245,100,84,0.24)" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold capitalize" style={{ color: "var(--hc-heading)" }}>
              {key.replace(/_/g, " ")}
            </div>
            <StatusBadge status={value.ok ? "ok" : "error"} />
          </div>
          <div className="mt-2 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
            {value.success_count} / {value.endpoint_count} endpoints healthy
          </div>
          {value.error ? (
            <div className="mt-2 text-xs leading-6" style={{ color: "var(--hc-active)" }}>
              {value.error}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-5 py-10">
      <div className="hc-card h-64 animate-pulse" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="hc-card h-28 animate-pulse" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="hc-card h-96 animate-pulse" />
        <div className="hc-card h-96 animate-pulse" />
      </div>
    </div>
  );
}

export function Dashboard() {
  const [snapshot, setSnapshot] = useState<CompanyDashboardSnapshot | null>(null);
  const [meta, setMeta] = useState<AppMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const quickAccess = useMemo(
    () => QUICK_ACCESS_IDS.map((id) => PANELS.find((panel) => panel.id === id)).filter((panel): panel is (typeof PANELS)[number] => Boolean(panel)),
    [],
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [snapshotRes, metaRes] = await Promise.all([
        fetch("/api/dashboard/company", { cache: "no-store", signal: AbortSignal.timeout(15000) }),
        fetch("/api/meta", { cache: "no-store", signal: AbortSignal.timeout(8000) }),
      ]);

      if (!snapshotRes.ok) {
        throw new Error(`Dashboard ${snapshotRes.status}`);
      }

      const snapshotPayload = (await snapshotRes.json()) as CompanyDashboardSnapshot;
      const metaPayload = metaRes.ok ? ((await metaRes.json()) as AppMeta) : null;
      setSnapshot(snapshotPayload);
      setMeta(metaPayload);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    const interval = setInterval(() => {
      void loadDashboard();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  if (!snapshot && loading) {
    return <LoadingShell />;
  }

  if (!snapshot) {
    return (
      <div className="mx-auto w-full max-w-4xl px-5 py-10">
        <section className="hc-card p-6">
          <div className="text-sm font-semibold" style={{ color: "var(--hc-active)" }}>
            Founder dashboard unavailable
          </div>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--hc-text-muted)" }}>
            {error || "The dashboard snapshot could not be loaded."}
          </p>
          <button type="button" className="hc-btn hc-btn-primary mt-4 text-xs" onClick={() => void loadDashboard()}>
            Retry
          </button>
        </section>
      </div>
    );
  }

  const kpis = snapshot.kpis;
  const moduleErrors = Object.values(snapshot.modules).filter((module) => !module.ok).length;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-5 py-10">
      <section className="hc-card relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(142,106,53,0.18), transparent 30%), radial-gradient(circle at top right, rgba(78,124,116,0.18), transparent 26%), linear-gradient(135deg, rgba(15,25,36,0.06), rgba(15,25,36,0.0))",
          }}
        />
        <div className="relative space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="hc-kicker">Founder Cockpit</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: "var(--hc-heading)" }}>
                {snapshot.hero.company_name}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7" style={{ color: "var(--hc-text-muted)" }}>
                {snapshot.hero.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="hc-btn hc-btn-ghost text-xs" onClick={() => void loadDashboard()}>
                {loading ? "Refreshing..." : "Refresh Snapshot"}
              </button>
              <Link href="/panel/projects" className="hc-btn hc-btn-primary text-xs">
                Open Projects
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <MetaChip>{meta ? `${meta.vercel_env} • ${meta.app_commit}` : "Build pending"}</MetaChip>
            <MetaChip>{meta ? `Gateway ${meta.gateway_host_label}` : "Gateway pending"}</MetaChip>
            <MetaChip>{meta ? `Built ${formatDateTime(meta.build_time)}` : "Build time pending"}</MetaChip>
            <MetaChip>Last refresh {formatDateTime(snapshot.generated_at)}</MetaChip>
            <MetaChip>{moduleErrors} module issues</MetaChip>
            <MetaChip>
              <StatusBadge status={snapshot.hero.engine_status === "ok" ? "ok" : snapshot.hero.engine_status === "down" ? "error" : "warning"} />
            </MetaChip>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickAccess.map((panel) => (
              <Link key={panel.id} href={`/panel/${panel.id}`} className="hc-btn hc-btn-ghost text-xs">
                {panel.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <MetricCard label="Active Projects" value={kpis.active_projects} detail="Current work tracked from planning context" tone="success" />
        <MetricCard label="Overdue Tasks" value={kpis.overdue_tasks} detail="Execution work past due date" tone={kpis.overdue_tasks > 0 ? "critical" : "info"} />
        <MetricCard label="Stalled Tasks" value={kpis.stalled_tasks} detail="Tasks without recent progress" tone={kpis.stalled_tasks > 0 ? "warning" : "info"} />
        <MetricCard label="Pending Approvals" value={kpis.approvals_pending} detail="Actions waiting for review" tone={kpis.approvals_pending > 0 ? "warning" : "info"} />
        <MetricCard label="Compliance Due" value={kpis.compliance_due_soon} detail="Upcoming filings and governance tasks" tone={kpis.compliance_due_soon > 0 ? "warning" : "info"} />
        <MetricCard label="Funding Pipeline" value={kpis.funding_opportunities} detail="Tracked funding opportunities" tone="info" />
        <MetricCard label="Unread Notices" value={kpis.unread_notifications} detail="Unread notifications in the system" tone={kpis.unread_notifications > 0 ? "warning" : "info"} />
        <MetricCard label="Indexed Chunks" value={kpis.indexed_chunks} detail="Knowledge chunks available to the engine" tone="info" />
      </div>

      <AlertStrip alerts={snapshot.alerts} />

      {error ? (
        <section
          className="rounded-2xl border px-4 py-3 text-sm"
          style={{
            background: "rgba(142,106,53,0.10)",
            borderColor: "rgba(142,106,53,0.24)",
            color: "var(--hc-text-muted)",
          }}
        >
          Snapshot refresh warning: {error}
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <SectionCard title="Today / Focus" subtitle="What needs founder attention right now." actionHref="/panel/projects" actionLabel="Projects">
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-accent)" }}>
                Focus now
              </div>
              <div className="flex flex-wrap gap-2">
                {snapshot.today.focus_now.length ? snapshot.today.focus_now.map((item) => (
                  <span key={item} className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(15,25,36,0.06)", color: "var(--hc-text)" }}>
                    {item}
                  </span>
                )) : (
                  <span className="text-sm" style={{ color: "var(--hc-text-muted)" }}>
                    No focus items generated yet.
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              <ItemList title="Next moves" items={snapshot.today.next_plans} emptyLabel="Generate projects context to see next plans." />
              <ItemList title="Blocked work" items={snapshot.today.blocked_items} emptyLabel="No blocked project items right now." />
              <ItemList title="Urgent risks" items={snapshot.today.risk_items} emptyLabel="No urgent execution risks were returned." />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Signal Integrity" subtitle="Live module health across the company operating surface." actionHref="/panel/system_status" actionLabel="System Status">
          <ModuleGrid modules={snapshot.modules} />
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Execution Lane" subtitle="Goals, tasks, weekly plan, and project throughput." actionHref="/panel/weekly_plan" actionLabel="Weekly Plan">
          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            <MetricCard label="Goals" value={snapshot.execution.goals_count} detail="Tracked goals" tone="info" />
            <MetricCard label="Tasks" value={snapshot.execution.tasks_count} detail="Open and historical tasks" tone="info" />
            <MetricCard label="Projects" value={snapshot.execution.project_count} detail="Projects in workspace" tone="success" />
            <MetricCard label="Health" value={`${snapshot.execution.overdue_count}/${snapshot.execution.stalled_count}`} detail="Overdue / stalled" tone={(snapshot.execution.overdue_count + snapshot.execution.stalled_count) > 0 ? "warning" : "success"} />
          </div>
          <ItemList title="Weekly plan preview" items={snapshot.execution.weekly_tasks} emptyLabel="No weekly execution tasks were returned." />
        </SectionCard>

        <SectionCard title="Operations Lane" subtitle="Compliance, approvals, notifications, and quality governance." actionHref="/panel/compliance" actionLabel="Operations">
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <MetricCard label="Open Deviations" value={snapshot.operations.quality.open_deviations} detail="Quality events still open" tone={snapshot.operations.quality.open_deviations > 0 ? "warning" : "success"} />
            <MetricCard label="Overdue CAPA" value={snapshot.operations.quality.overdue_actions} detail="Corrective or preventive actions overdue" tone={snapshot.operations.quality.overdue_actions > 0 ? "critical" : "success"} />
            <MetricCard label="Quality Items" value={snapshot.operations.quality.total_items} detail="Total quality governance objects" tone="info" />
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            <ItemList title="Compliance due" items={snapshot.operations.compliance_due} emptyLabel="No upcoming compliance tasks." />
            <ItemList title="Approvals" items={snapshot.operations.approvals} emptyLabel="No approvals are pending." />
            <ItemList title="Notifications" items={snapshot.operations.notifications} emptyLabel="No recent notifications." />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Growth Lane" subtitle="Market, funding, sales, and external opportunity signals." actionHref="/panel/lead_intel" actionLabel="Growth">
          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            <MetricCard label="Lead Export" value={snapshot.growth.lead_status.available ? "Live" : "Missing"} detail={`Rows ${snapshot.growth.lead_status.row_count}`} tone={snapshot.growth.lead_status.available ? "success" : "warning"} />
            <MetricCard label="Funding" value={snapshot.growth.funding_count} detail="Tracked opportunities" tone="info" />
            <MetricCard label="Sales" value={snapshot.growth.sales_count} detail="Sales domain items" tone="info" />
            <MetricCard label="Accounts" value={snapshot.growth.accounts_count} detail="Account records" tone="info" />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <ItemList title="Latest funding" items={snapshot.growth.latest_funding} emptyLabel="No funding items are stored yet." />
            <ItemList title="Latest news" items={snapshot.growth.latest_news} emptyLabel="No news items are stored yet." />
          </div>
        </SectionCard>

        <SectionCard title="R&D Lane" subtitle="Research operations, measurements, training, and knowledge coverage." actionHref="/panel/experiment_form" actionLabel="R&D">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Experiments" value={snapshot.rnd.experiments_count} detail="Canonical records" tone="info" />
            <MetricCard label="Drafts" value={snapshot.rnd.draft_count} detail="Pending review queue" tone={snapshot.rnd.draft_count > 0 ? "warning" : "success"} />
            <MetricCard label="Measurements" value={snapshot.rnd.measurement_count} detail="Linked measurement records" tone="info" />
            <MetricCard label="Training" value={snapshot.rnd.training_state} detail={snapshot.rnd.training_ready ? "Readiness ok" : "Readiness pending"} tone={snapshot.rnd.training_ready ? "success" : "warning"} />
            <MetricCard label="Knowledge" value={snapshot.rnd.indexed_chunks} detail="Indexed chunks" tone="info" />
            <MetricCard label="Sources" value={snapshot.rnd.source_count} detail="Tracked source objects" tone="info" />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Engine Lane" subtitle="Runtime health, memory, compute mode, and recent anomalies." actionHref="/panel/system_status" actionLabel="Engine">
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="GPU" value={snapshot.engine.gpu_available ? "Yes" : "No"} detail="Hardware availability" tone={snapshot.engine.gpu_available ? "success" : "warning"} />
            <MetricCard label="Compute" value={snapshot.engine.compute_mode} detail="Effective compute mode" tone="info" />
            <MetricCard label="Ollama" value={snapshot.engine.ollama_reachable ? "Reachable" : "Down"} detail="Model serving health" tone={snapshot.engine.ollama_reachable ? "success" : "critical"} />
            <MetricCard label="RAM Used" value={snapshot.engine.memory_used_percent != null ? `${snapshot.engine.memory_used_percent.toFixed(0)}%` : "N/A"} detail={snapshot.engine.available_ram_gb != null ? `${snapshot.engine.available_ram_gb.toFixed(1)} GB free` : "Memory metrics unavailable"} tone="info" />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <ItemList title="Recent failures" items={snapshot.engine.recent_failures} emptyLabel="No recent engine failures were recorded." />
            <ItemList title="Tool health" items={snapshot.engine.tools_health} emptyLabel="Tool health has not been populated in system state yet." />
          </div>
        </SectionCard>

        <SectionCard title="Activity Rail" subtitle="Recent decisions, narratives, messages, and notifications." actionHref="/panel/narratives" actionLabel="Activity">
          <div className="grid gap-5 xl:grid-cols-2">
            <ItemList title="Decisions" items={snapshot.activity.decisions} emptyLabel="No recent decisions." />
            <ItemList title="Narratives" items={snapshot.activity.narratives} emptyLabel="No recent narratives." />
            <ItemList title="Messages" items={snapshot.activity.messages} emptyLabel="No recent messages." />
            <ItemList title="Notifications" items={snapshot.activity.notifications} emptyLabel="No recent notifications." />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
