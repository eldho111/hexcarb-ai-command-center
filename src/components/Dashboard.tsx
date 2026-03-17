"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { StatusBadge } from "@/components/widgets/StatusBadge";
import type {
  CompanyDashboardSnapshot,
  DashboardAlert,
  DashboardListItem,
  DashboardRange,
  DashboardTone,
} from "@/lib/dashboard";
import { WORKSPACES, type WorkspaceDef, type WorkspaceId } from "@/lib/panels";

const REFRESH_INTERVAL_MS = 30_000;
const RANGE_OPTIONS: DashboardRange[] = ["30d", "90d", "365d"];

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

function formatInteger(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 10_000_000) return `INR ${(value / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000) return `INR ${(value / 100_000).toFixed(1)}L`;
  if (abs >= 1_000) return `INR ${(value / 1_000).toFixed(0)}K`;
  return `INR ${Math.round(value)}`;
}

function formatQuantity(value: number): string {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function dependencyIssues(snapshot: CompanyDashboardSnapshot | null): number {
  if (!snapshot) return 0;
  return snapshot.engine.dependency_states.filter((item) => {
    const status = (item.status || "").toLowerCase();
    return status && !["healthy", "up", "ready", "active"].includes(status);
  }).length;
}

function workspaceBadgeCount(workspaceId: WorkspaceId, snapshot: CompanyDashboardSnapshot | null): number {
  if (!snapshot) return 0;
  switch (workspaceId) {
    case "projects":
      return snapshot.execution.overdue_count + snapshot.execution.stalled_count + snapshot.today.blocked_items.length;
    case "rnd":
      return snapshot.rnd.draft_count + (snapshot.rnd.training_ready ? 0 : 1);
    case "growth":
      return snapshot.sales.inquiries_total + snapshot.sales.pipeline_total;
    case "operations":
      return snapshot.operations.compliance_due.length + snapshot.production.low_stock_items.length;
    case "engine":
    default:
      return snapshot.alerts.length + dependencyIssues(snapshot);
  }
}

function MetricTile({ label, value, detail, tone = "info" }: { label: string; value: string | number; detail?: string; tone?: DashboardTone }) {
  const colors = toneStyles(tone);
  return (
    <div
      className="hc-metric-tile min-w-0 rounded-[26px] border px-5 py-5"
      style={{ borderColor: colors.border, background: "var(--hc-bg)" }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
        {label}
      </div>
      <div className="hc-balance hc-long-value mt-4 text-3xl font-semibold tracking-tight" style={{ color: colors.color }}>
        {value}
      </div>
      {detail ? (
        <p className="hc-clamp-2 mt-auto pt-3 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function SeriesToggle({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors"
      style={{
        borderColor: active ? color : "var(--hc-border)",
        color: active ? color : "var(--hc-text-muted)",
        background: active ? `${color}14` : "var(--hc-bg)",
      }}
    >
      {label}
    </button>
  );
}

function CompactItem({ item }: { item: DashboardListItem }) {
  return (
    <Link
      href={item.href || "#"}
      className="hc-compact-item group block min-w-0 rounded-[22px] border px-4 py-4 transition-colors hover:bg-black/[.03]"
      style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="hc-long-value text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
            {item.title}
          </div>
          {item.subtitle ? (
            <div className="hc-clamp-2 mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
              {item.subtitle}
            </div>
          ) : null}
          {item.meta ? (
            <div className="hc-clamp-2 mt-1 text-[11px] leading-5" style={{ color: "var(--hc-text-muted)" }}>
              {item.meta}
            </div>
          ) : null}
        </div>
        {item.status ? <StatusBadge status={item.status} /> : null}
      </div>
    </Link>
  );
}

function EmptyState({
  title,
  detail,
  badge,
}: {
  title: string;
  detail: string;
  badge?: string;
}) {
  return (
    <div
      className="flex h-full min-h-[220px] flex-col justify-center rounded-[24px] border border-dashed px-5 py-6"
      style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}
    >
      {badge ? (
        <div className="mb-3 inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ background: "rgba(142,106,53,0.12)", color: "var(--hc-accent)" }}>
          {badge}
        </div>
      ) : null}
      <div className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
        {title}
      </div>
      <p className="mt-2 text-sm leading-7" style={{ color: "var(--hc-text-muted)" }}>
        {detail}
      </p>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  mode = "number",
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
  mode?: "currency" | "number";
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="min-w-[180px] rounded-[20px] border px-4 py-3"
      style={{ borderColor: "var(--hc-border)", background: "rgba(255,255,255,0.96)", boxShadow: "var(--shadow-soft)" }}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
        {label}
      </div>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <div key={`${entry.name}-${entry.color}`} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2" style={{ color: "var(--hc-text-muted)" }}>
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: entry.color || "var(--hc-accent)" }} />
              {entry.name}
            </span>
            <span style={{ color: "var(--hc-heading)" }}>
              {mode === "currency" ? formatCurrency(entry.value || 0) : formatQuantity(entry.value || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModuleFrame({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
  children,
  className = "",
}: {
  eyebrow: string;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[30px] border p-6 sm:p-7 ${className}`.trim()}
      style={{ borderColor: "var(--hc-border)", background: "var(--hc-surface-elevated)", boxShadow: "var(--shadow-soft)" }}
    >
      <div className="hc-module-head flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
            {eyebrow}
          </div>
          <h2 className="hc-balance mt-2 text-2xl font-semibold tracking-tight" style={{ color: "var(--hc-heading)" }}>
            {title}
          </h2>
          <p className="hc-clamp-2 mt-3 max-w-3xl text-sm leading-7" style={{ color: "var(--hc-text-muted)" }}>
            {description}
          </p>
        </div>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="hc-btn hc-btn-ghost shrink-0 text-xs">
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function WorkspaceLauncher({ workspace, badgeCount }: { workspace: WorkspaceDef; badgeCount: number }) {
  const theme = workspaceTheme(workspace.id);
  return (
    <Link
      href={workspace.href}
      className="hc-workspace-launcher block min-w-0 rounded-[28px] border px-5 py-5 transition-transform hover:-translate-y-0.5"
      style={{ borderColor: theme.border, background: "var(--hc-surface-elevated)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.color }}>
            {workspace.badgeLabel}
          </div>
          <div className="hc-balance mt-3 text-[1.08rem] font-semibold leading-7" style={{ color: "var(--hc-heading)" }}>
            {workspace.label}
          </div>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ background: theme.surface, color: theme.color, border: `1px solid ${theme.border}` }}
        >
          {badgeCount}
        </span>
      </div>
      <p className="hc-clamp-2 mt-4 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
        {workspace.description}
      </p>
    </Link>
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
              className="block rounded-[22px] border px-4 py-4 transition-colors hover:bg-black/[.03]"
              style={{ borderColor: colors.border, background: "var(--hc-bg)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="hc-long-value text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                    {alert.title}
                  </div>
                  {alert.detail ? (
                    <div className="hc-clamp-3 mt-2 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
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
        <EmptyState title="No urgent alerts" detail="The current snapshot did not surface urgent issues across execution, operations, or the engine." />
      )}
    </div>
  );
}

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState<CompanyDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState<DashboardRange>("90d");
  const [isPending, startTransition] = useTransition();
  const [financeVisible, setFinanceVisible] = useState({ income: true, expense: true, net: false });
  const [salesVisible, setSalesVisible] = useState({ inquiries: true, qualified: true, revenue: false });

  useEffect(() => {
    let mounted = true;

    async function loadSnapshot() {
      if (mounted) setLoading(true);
      try {
        const response = await fetch(`/api/dashboard/company?range=${selectedRange}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(15_000),
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
  }, [selectedRange]);

  const workspaceLaunchers = useMemo(
    () =>
      WORKSPACES.map((workspace) => ({
        workspace,
        badgeCount: workspaceBadgeCount(workspace.id, snapshot),
      })),
    [snapshot],
  );

  const rangeOptions = snapshot?.filters.available_ranges || RANGE_OPTIONS;
  const focusItems = snapshot?.today.focus_now || [];
  const financeChartReady = Boolean(snapshot?.finance.trend.length) && snapshot?.finance.state === "ready";
  const salesChartReady = Boolean(snapshot?.sales.momentum.length) && snapshot?.sales.state === "ready";
  const inventoryChartReady = Boolean(snapshot?.production.nanotube_units.length) && snapshot?.production.state === "ready";
  const pilotChartReady = Boolean(snapshot?.pilotPlant.trend.length) && snapshot?.pilotPlant.state === "ready";
  const rndChartReady = Boolean(snapshot?.rndPulse.momentum.length) && snapshot?.rndPulse.state === "ready";

  return (
    <div className="mx-auto w-full max-w-[1560px] space-y-8 px-5 py-8 lg:px-8 xl:space-y-9 2xl:px-10">
      <section className="grid gap-7 xl:grid-cols-[minmax(0,1.3fr)_360px]">
        <div className="relative overflow-hidden rounded-[36px] border px-6 py-7 sm:px-9 sm:py-10" style={{ borderColor: "var(--hc-border)", background: "var(--hc-surface-elevated-strong)", boxShadow: "var(--shadow-soft)" }}>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 12% 18%, rgba(142,106,53,0.16), transparent 28%), radial-gradient(circle at 86% 14%, rgba(78,124,116,0.12), transparent 24%), linear-gradient(135deg, rgba(255,255,255,0.72), transparent)",
            }}
          />
          <div className="relative">
            <div className="hc-kicker">Founder Cockpit</div>
            <h1 className="hc-balance mt-4 max-w-3xl text-[2.8rem] font-semibold tracking-tight sm:text-[3.5rem]" style={{ color: "var(--hc-heading)" }}>
              {snapshot?.hero.company_name || "HexCarb"}
            </h1>
            <p className="hc-clamp-2 mt-4 max-w-3xl text-[1.02rem] leading-8" style={{ color: "var(--hc-text-muted)" }}>
              {snapshot?.hero.subtitle || "Executive overview for revenue, production readiness, sales motion, research cadence, and engine resilience."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ background: "var(--hc-bg)", color: "var(--hc-text-muted)", border: "1px solid var(--hc-border)" }}>
                Generated {formatDateTime(snapshot?.generated_at)}
              </span>
              <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ background: "rgba(109,124,167,0.12)", color: "#52659a" }}>
                Engine {snapshot?.engine.mode || "checking"}
              </span>
              {snapshot?.company_status?.phase ? (
                <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ background: "rgba(95,120,154,0.12)", color: "#496c8d" }}>
                  Phase {snapshot.company_status.phase}
                </span>
              ) : null}
            </div>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <MetricTile label="Active Projects" value={snapshot?.kpis.active_projects ?? "…"} tone="success" detail="Programs currently in motion across the execution lane." />
              <MetricTile label="Unread Action Items" value={snapshot?.inbox.unread_count ?? "…"} tone={(snapshot?.inbox.urgent_count || 0) > 0 ? "warning" : "info"} detail="Approvals, alerts, and messages waiting for review." />
              <MetricTile label="Indexed Knowledge" value={snapshot?.rnd.indexed_chunks ?? "…"} tone="info" detail="Current retrieved corpus supporting R&D and planning responses." />
            </div>
            <div className="mt-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
                Today / Focus
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {focusItems.length ? (
                  focusItems.slice(0, 6).map((item) => (
                    <span
                      key={item}
                      className="rounded-full border px-3 py-1 text-xs"
                      style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)", color: "var(--hc-text-muted)" }}
                    >
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="text-sm" style={{ color: "var(--hc-text-muted)" }}>
                    {loading ? "Loading focus items…" : "No focus items surfaced yet."}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-[32px] border p-6" style={{ borderColor: "var(--hc-border)", background: "var(--hc-surface-elevated)", boxShadow: "var(--shadow-soft)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
              Dashboard Range
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: "var(--hc-heading)" }}>
              30d, 90d, or 12m
            </h2>
            <p className="mt-3 text-sm leading-7" style={{ color: "var(--hc-text-muted)" }}>
              Every chart on this page uses the same server-side time window so comparisons stay aligned.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {rangeOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => startTransition(() => setSelectedRange(option))}
                  className="rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors"
                  style={{
                    borderColor: selectedRange === option ? "var(--hc-accent)" : "var(--hc-border)",
                    color: selectedRange === option ? "var(--hc-accent)" : "var(--hc-text-muted)",
                    background: selectedRange === option ? "rgba(142,106,53,0.12)" : "var(--hc-bg)",
                  }}
                >
                  {option === "365d" ? "12m" : option}
                </button>
              ))}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <MetricTile label="Module Warnings" value={snapshot?.hero.module_errors ?? "…"} tone={(snapshot?.hero.module_errors || 0) > 0 ? "warning" : "success"} detail="Snapshots with upstream fetch problems or incomplete dependencies." />
              <MetricTile label="Data Quality Gaps" value={snapshot ? snapshot.dataQuality.invalidFinance + snapshot.dataQuality.invalidSalesRevenue + snapshot.dataQuality.invalidProductionRuns : "…"} tone="warning" detail="Records excluded from analytics because the required fields were missing or not normalized." />
            </div>
            <p className="mt-4 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
              {isPending ? "Refreshing the cockpit view for the new time window…" : "Range changes refresh the dashboard without leaving the page."}
            </p>
          </div>

          <div className="rounded-[32px] border p-6" style={{ borderColor: "var(--hc-border)", background: "var(--hc-surface-elevated)", boxShadow: "var(--shadow-soft)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
              What Changed Recently
            </div>
            <div className="mt-4 space-y-3">
              {snapshot?.today.next_plans.length ? (
                snapshot.today.next_plans.slice(0, 2).map((item) => <CompactItem key={`next-${item.id}`} item={item} />)
              ) : (
                <EmptyState title="No fresh plans" detail="The planner did not return new next-step items in the latest snapshot." />
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="hc-kicker">Workspace Launchers</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: "var(--hc-heading)" }}>
              Main windows stay compact while the home page carries the analytics
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7" style={{ color: "var(--hc-text-muted)" }}>
            The dashboard is now the executive cockpit. Workspaces stay focused for drill-down, entry, and operations.
          </p>
        </div>
        <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-5">
          {workspaceLaunchers.map(({ workspace, badgeCount }) => (
            <WorkspaceLauncher key={workspace.id} workspace={workspace} badgeCount={badgeCount} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-12">
        <ModuleFrame
          eyebrow="Finance"
          title="Income and expenditure move together here"
          description="This chart only includes finance records with income or expense types, a normalized INR amount, and a transaction date. That keeps the spend picture accurate instead of inferred."
          actionHref="/workspace/operations"
          actionLabel="Open Operations"
          className="xl:col-span-7"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricTile label="Income" value={snapshot ? formatCurrency(snapshot.finance.income_total) : "…"} tone="success" detail="Total recognized income in the selected window." />
            <MetricTile label="Expenditure" value={snapshot ? formatCurrency(snapshot.finance.expense_total) : "…"} tone="warning" detail="Total recognized expense in the selected window." />
            <MetricTile label="Net" value={snapshot ? formatCurrency(snapshot.finance.net_total) : "…"} tone={(snapshot?.finance.net_total || 0) >= 0 ? "success" : "critical"} detail="Income minus expenditure for the selected window." />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <SeriesToggle label="Income" color="var(--hc-green)" active={financeVisible.income} onClick={() => setFinanceVisible((prev) => ({ ...prev, income: !prev.income }))} />
            <SeriesToggle label="Expenditure" color="var(--hc-accent)" active={financeVisible.expense} onClick={() => setFinanceVisible((prev) => ({ ...prev, expense: !prev.expense }))} />
            <SeriesToggle label="Net" color="#52659a" active={financeVisible.net} onClick={() => setFinanceVisible((prev) => ({ ...prev, net: !prev.net }))} />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_320px]">
            <div className="hc-chart-panel h-[340px] rounded-[26px] border p-4" style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}>
              {financeChartReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={snapshot?.finance.trend} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(16,33,49,0.08)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="var(--hc-text-muted)" />
                    <YAxis tickFormatter={formatCompactCurrency} tickLine={false} axisLine={false} width={72} fontSize={12} stroke="var(--hc-text-muted)" />
                    <Tooltip content={<ChartTooltip mode="currency" />} />
                    {financeVisible.income ? <Area type="monotone" dataKey="income" name="Income" stroke="var(--hc-green)" fill="rgba(78,124,116,0.18)" strokeWidth={2.4} /> : null}
                    {financeVisible.expense ? <Area type="monotone" dataKey="expense" name="Expenditure" stroke="var(--hc-accent)" fill="rgba(142,106,53,0.14)" strokeWidth={2.4} /> : null}
                    {financeVisible.net ? <Line type="monotone" dataKey="net" name="Net" stroke="#52659a" strokeWidth={2.4} dot={false} /> : null}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="Income and expenditure chart needs normalized finance records"
                  detail="Only finance rows with record_type income or expense, amount_inr, and transaction_date appear here. Sparse legacy rows stay out of the chart on purpose."
                  badge={snapshot ? `${snapshot.dataQuality.invalidFinance} finance rows excluded` : undefined}
                />
              )}
            </div>
            <div className="space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
                Recent Qualified Entries
              </div>
              {snapshot?.finance.recent_entries.length ? (
                snapshot.finance.recent_entries.map((item) => <CompactItem key={`finance-${item.id}`} item={item} />)
              ) : (
                <EmptyState title="No chart-ready finance entries" detail="Add normalized income and expense records to unlock the trend view and the recent-entry rail." />
              )}
            </div>
          </div>
        </ModuleFrame>

        <ModuleFrame
          eyebrow="Sales Momentum"
          title="New inquiries, qualified pipeline, and revenue stay in one view"
          description="Inquiry counts come from lead and inquiry records bucketed by creation time. Revenue only appears once a sale row carries a normalized revenue_inr value."
          actionHref="/workspace/growth"
          actionLabel="Open Growth"
          className="xl:col-span-5"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricTile label="New Inquiries" value={snapshot ? formatInteger(snapshot.sales.inquiries_total) : "…"} tone="info" detail="Lead and inquiry rows created in the selected range." />
            <MetricTile label="Pipeline" value={snapshot ? formatInteger(snapshot.sales.pipeline_total) : "…"} tone="success" detail="Stage-bearing sales and opportunity records in the current data set." />
            <MetricTile label="Revenue" value={snapshot ? formatCurrency(snapshot.sales.revenue_total) : "…"} tone={snapshot?.sales.revenue_state === "ready" ? "success" : "warning"} detail="Sales revenue only when revenue_inr is present and valid." />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <SeriesToggle label="Inquiries" color="#496c8d" active={salesVisible.inquiries} onClick={() => setSalesVisible((prev) => ({ ...prev, inquiries: !prev.inquiries }))} />
            <SeriesToggle label="Qualified" color="var(--hc-green)" active={salesVisible.qualified} onClick={() => setSalesVisible((prev) => ({ ...prev, qualified: !prev.qualified }))} />
            <SeriesToggle label="Revenue" color="var(--hc-accent)" active={salesVisible.revenue} onClick={() => setSalesVisible((prev) => ({ ...prev, revenue: !prev.revenue }))} />
          </div>
          <div className="mt-6 rounded-[26px] border p-4" style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}>
            <div className="h-[290px]">
              {salesChartReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={snapshot?.sales.momentum} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(16,33,49,0.08)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="var(--hc-text-muted)" />
                    <YAxis tickLine={false} axisLine={false} width={56} fontSize={12} stroke="var(--hc-text-muted)" />
                    <Tooltip content={<ChartTooltip mode={salesVisible.revenue && !salesVisible.inquiries && !salesVisible.qualified ? "currency" : "number"} />} />
                    {salesVisible.inquiries ? <Line type="monotone" dataKey="inquiries" name="Inquiries" stroke="#496c8d" strokeWidth={2.3} dot={false} /> : null}
                    {salesVisible.qualified ? <Line type="monotone" dataKey="qualified_pipeline" name="Qualified" stroke="var(--hc-green)" strokeWidth={2.3} dot={false} /> : null}
                    {salesVisible.revenue ? <Line type="monotone" dataKey="revenue" name="Revenue" stroke="var(--hc-accent)" strokeWidth={2.3} dot={false} /> : null}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="Sales charts are waiting on richer sales records"
                  detail="Lead and inquiry activity already appears when created_at is present. Revenue will remain hidden until sale rows include revenue_inr."
                  badge={snapshot ? `${snapshot.dataQuality.invalidSalesRevenue} sales rows excluded from revenue` : undefined}
                />
              )}
            </div>
          </div>
          <div className="mt-6 grid gap-5">
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
                Recent Inquiries And Pipeline
              </div>
              <div className="space-y-3">
                {(snapshot?.sales.recent_inquiries.length || snapshot?.sales.recent_pipeline.length) ? (
                  [...(snapshot?.sales.recent_inquiries || []), ...(snapshot?.sales.recent_pipeline || [])]
                    .slice(0, 4)
                    .map((item) => <CompactItem key={`sales-${item.id}`} item={item} />)
                ) : (
                  <EmptyState title="No recent inquiries" detail="Add lead and opportunity records to populate the sales momentum rail." />
                )}
              </div>
            </div>
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
                Stage Mix
              </div>
              <div className="space-y-3">
                {snapshot?.sales.stage_mix.length ? (
                  snapshot.sales.stage_mix.map((stage) => (
                    <div key={stage.stage} className="rounded-[20px] border px-3 py-3" style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}>
                      <div className="flex items-center justify-between gap-3 text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                        <span className="hc-long-value">{stage.stage}</span>
                        <span>{formatInteger(stage.count)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No stage data" detail="Pipeline stage bars appear once opportunity records include a stage." />
                )}
              </div>
            </div>
          </div>
        </ModuleFrame>

        <ModuleFrame
          eyebrow="Nanotube In Hand"
          title="Tagged nanotube stock stays visible without mixing units"
          description="Only procurement inventory items explicitly tagged material_category=nanotube appear here. Mixed units are kept separate instead of being summed into a misleading total."
          actionHref="/workspace/operations"
          actionLabel="Open Procurement"
          className="xl:col-span-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:[grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
            <MetricTile label="Tagged Items" value={snapshot ? formatInteger(snapshot.production.tagged_item_count) : "…"} tone={snapshot?.production.state === "ready" ? "success" : "warning"} detail="Inventory rows currently eligible for the nanotube stock panel." />
            <MetricTile label="Unit Groups" value={snapshot ? formatInteger(snapshot.production.nanotube_units.length) : "…"} tone="info" detail="Separate unit buckets used to avoid false summed inventory totals." />
            <MetricTile label="Low Stock" value={snapshot ? formatInteger(snapshot.production.low_stock_items.length) : "…"} tone={(snapshot?.production.low_stock_items.length || 0) > 0 ? "warning" : "success"} detail="Tagged nanotube items at or below their reorder point." />
          </div>
          <div className="mt-6 rounded-[26px] border p-4" style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}>
            <div className="h-[285px]">
              {inventoryChartReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={snapshot?.production.nanotube_units} layout="vertical" margin={{ top: 8, right: 8, left: 12, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(16,33,49,0.08)" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} stroke="var(--hc-text-muted)" />
                    <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={120} fontSize={12} stroke="var(--hc-text-muted)" />
                    <Tooltip content={<ChartTooltip mode="number" />} />
                    <Bar dataKey="quantity" name="Quantity" fill="var(--hc-green)" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="Nanotube inventory needs tagged stock records"
                  detail="The stock panel only reads inventory_item records tagged material_category=nanotube. Untagged inventory stays out of view until it is normalized."
                  badge={snapshot ? `${snapshot.dataQuality.untaggedInventory} inventory items missing material tags` : undefined}
                />
              )}
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {snapshot?.production.low_stock_items.length ? (
              snapshot.production.low_stock_items.map((item) => <CompactItem key={`stock-${item.id}`} item={item} />)
            ) : (
              <EmptyState title="No nanotube low-stock items" detail="Tagged nanotube inventory is currently above its reorder threshold or no tagged stock exists yet." />
            )}
          </div>
        </ModuleFrame>

        <ModuleFrame
          eyebrow="Pilot Plant Output"
          title="Pilot runs stay hidden until production_run records are real"
          description="This module expects structured production_run records with product, run_date, quantity, unit, and status. Until then it shows a deliberate data-needed state instead of a decorative throughput chart."
          actionHref="/workspace/operations"
          actionLabel="Open Operations"
          className="xl:col-span-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:[grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
            <MetricTile label="Runs" value={snapshot ? formatInteger(snapshot.pilotPlant.run_count) : "…"} tone={snapshot?.pilotPlant.state === "ready" ? "success" : "warning"} detail="Structured production_run rows available to the dashboard." />
            <MetricTile label="Output" value={snapshot ? formatQuantity(snapshot.pilotPlant.total_quantity) : "…"} tone="info" detail="Summed only when the production unit is consistent within the selected range." />
            <MetricTile label="Units" value={snapshot ? (snapshot.pilotPlant.units.join(", ") || "none") : "…"} tone="info" detail="Multiple units prevent a single combined throughput trend from rendering." />
          </div>
          <div className="mt-6 rounded-[26px] border p-4" style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}>
            <div className="h-[285px]">
              {pilotChartReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={snapshot?.pilotPlant.trend} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(16,33,49,0.08)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="var(--hc-text-muted)" />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--hc-text-muted)" />
                    <Tooltip content={<ChartTooltip mode="number" />} />
                    <Bar dataKey="quantity" name="Output" fill="#52659a" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="Pilot plant throughput needs structured production runs"
                  detail={snapshot?.pilotPlant.units.length && snapshot.pilotPlant.units.length > 1 ? "Production data exists but mixes units, so throughput is intentionally withheld until the runs are normalized." : "Add production_run objects with run_date, product, quantity, unit, and status to unlock the pilot output trend."}
                  badge={snapshot ? `${snapshot.dataQuality.invalidProductionRuns} production rows excluded` : undefined}
                />
              )}
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {snapshot?.pilotPlant.recent_runs.length ? (
              snapshot.pilotPlant.recent_runs.map((item) => <CompactItem key={`run-${item.id}`} item={item} />)
            ) : (
              <EmptyState title="No pilot runs yet" detail="Recent production runs will appear here once production_run records are being captured by the engine." />
            )}
          </div>
        </ModuleFrame>

        <ModuleFrame
          eyebrow="R&D Pulse"
          title="Experiment velocity is visible without leaving the cockpit"
          description="This panel pairs experiment and measurement movement with training readiness, draft pressure, and source volume so research cadence is easier to read at a glance."
          actionHref="/workspace/rnd"
          actionLabel="Open R&D"
          className="xl:col-span-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:[grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
            <MetricTile label="Experiments" value={snapshot ? formatInteger(snapshot.rndPulse.experiments_total) : "…"} tone="info" detail="Canonical experiment records currently available." />
            <MetricTile label="Measurements" value={snapshot ? formatInteger(snapshot.rndPulse.measurements_total) : "…"} tone="success" detail="Measurement records captured for review and follow-on analysis." />
            <MetricTile label="Training State" value={snapshot?.rndPulse.training_state || "…"} tone={snapshot?.rndPulse.training_ready ? "success" : "warning"} detail={`${snapshot?.rndPulse.drafts_total ?? 0} drafts and ${snapshot?.rndPulse.sources_total ?? 0} sources are available.`} />
          </div>
          <div className="mt-6 rounded-[26px] border p-4" style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}>
            <div className="h-[285px]">
              {rndChartReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={snapshot?.rndPulse.momentum} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(16,33,49,0.08)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="var(--hc-text-muted)" />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--hc-text-muted)" />
                    <Tooltip content={<ChartTooltip mode="number" />} />
                    <Line type="monotone" dataKey="experiments" name="Experiments" stroke="var(--hc-green)" strokeWidth={2.4} dot={false} />
                    <Line type="monotone" dataKey="measurements" name="Measurements" stroke="#496c8d" strokeWidth={2.4} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="R&D pulse is waiting for more activity" detail="Experiment and measurement trends will fill in automatically as more research records land inside the selected range." />
              )}
            </div>
          </div>
          <div className="mt-6 rounded-[26px] border px-5 py-5" style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
              Training Readiness
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="hc-long-value text-lg font-semibold" style={{ color: "var(--hc-heading)" }}>
                {snapshot?.rndPulse.training_ready ? "Ready for training runs" : "Needs more curated research input"}
              </div>
              <span className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ background: snapshot?.rndPulse.training_ready ? "rgba(78,124,116,0.12)" : "rgba(142,106,53,0.12)", color: snapshot?.rndPulse.training_ready ? "var(--hc-green)" : "var(--hc-accent)" }}>
                {snapshot?.rndPulse.training_state || "pending"}
              </span>
            </div>
          </div>
        </ModuleFrame>

        <ModuleFrame
          eyebrow="Engine Health & Alerts"
          title="Runtime status, model selection, and urgent attention live together"
          description="The cockpit ends with the operational truth: current runtime mode, model wiring, dependencies, and the cross-company alerts that need action before the next refresh."
          actionHref="/workspace/engine"
          actionLabel="Open AI Engine"
          className="xl:col-span-12"
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                <MetricTile label="Mode" value={snapshot?.engine.mode || "…"} tone={snapshot?.engine.mode === "ready" ? "success" : snapshot?.engine.mode === "down" ? "critical" : "warning"} detail={snapshot?.engine.recovery_hint || "Launcher-reported runtime mode and recovery signal."} />
                <MetricTile label="GPU" value={snapshot?.engine.gpu_available ? "Available" : "CPU"} tone={snapshot?.engine.gpu_available ? "success" : "warning"} detail="Current serving hardware available to the runtime." />
                <MetricTile label="Dependency Issues" value={snapshot ? formatInteger(dependencyIssues(snapshot)) : "…"} tone={dependencyIssues(snapshot) > 0 ? "warning" : "success"} detail="Dependency states that are not healthy or fully up." />
                <MetricTile label="Current Model" value={snapshot?.engine.current_serving_model || "Pending"} tone={snapshot?.engine.current_serving_model ? "success" : "warning"} detail={snapshot?.engine.adapter_version || snapshot?.engine.base_model || "Adapter and base-model details are still resolving."} />
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
                    Runtime Dependencies
                  </div>
                  <div className="space-y-3">
                    {snapshot?.engine.dependency_states.length ? (
                      snapshot.engine.dependency_states.map((item) => <CompactItem key={`dep-${item.id}`} item={item} />)
                    ) : (
                      <EmptyState title="No dependency states" detail="The runtime did not return dependency state rows in the latest snapshot." />
                    )}
                  </div>
                </div>
                <div>
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
                    Recent Failures And Tools
                  </div>
                  <div className="space-y-3">
                    {snapshot?.engine.recent_failures.length ? (
                      snapshot.engine.recent_failures.map((item) => <CompactItem key={`failure-${item.id}`} item={item} />)
                    ) : snapshot?.engine.tools_health.length ? (
                      snapshot.engine.tools_health.slice(0, 4).map((item) => <CompactItem key={`tool-${item.id}`} item={item} />)
                    ) : (
                      <EmptyState title="No recent runtime anomalies" detail="Recent failures and tools-health signals will appear here as the engine captures them." />
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
                Urgent Alerts
              </div>
              <AlertList alerts={snapshot?.alerts || []} />
            </div>
          </div>
        </ModuleFrame>
      </section>
    </div>
  );
}
