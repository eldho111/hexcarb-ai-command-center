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
import {
  COMPARTMENT_LABELS,
  COMPARTMENT_ORDER,
  PANELS,
  type NavCompartmentId,
  type PanelDef,
} from "@/lib/panels";
import { StatusBadge } from "@/components/widgets/StatusBadge";

const REFRESH_INTERVAL_MS = 30000;
const QUICK_ACCESS_IDS = [
  "projects",
  "weekly_plan",
  "chat",
  "system_status",
  "compliance",
  "lead_intel",
] as const;
const WORKSPACE_IDS: NavCompartmentId[] = ["overview", "projects", "rnd", "growth", "operations", "engine"];

function toneStyles(tone: DashboardTone): { background: string; color: string; border: string } {
  switch (tone) {
    case "success":
      return { background: "rgba(78,124,116,0.12)", color: "var(--hc-green)", border: "rgba(78,124,116,0.26)" };
    case "warning":
      return { background: "rgba(142,106,53,0.12)", color: "var(--hc-accent)", border: "rgba(142,106,53,0.26)" };
    case "critical":
      return { background: "rgba(245,100,84,0.12)", color: "var(--hc-active)", border: "rgba(245,100,84,0.24)" };
    default:
      return { background: "var(--hc-surface-muted)", color: "var(--hc-text-muted)", border: "var(--hc-surface-muted-border)" };
  }
}

function compartmentStyles(compartment: NavCompartmentId): { surface: string; border: string; color: string } {
  switch (compartment) {
    case "overview":
      return { surface: "var(--hc-surface-muted)", border: "var(--hc-surface-muted-border)", color: "var(--hc-heading)" };
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
    case "advanced":
    default:
      return { surface: "var(--hc-surface-muted-strong)", border: "var(--hc-surface-muted-border)", color: "var(--hc-text-muted)" };
  }
}

function statusFromTone(tone: DashboardTone): "ok" | "warning" | "error" {
  if (tone === "success") return "ok";
  if (tone === "critical") return "error";
  return "warning";
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

function byPriority(a: PanelDef, b: PanelDef): number {
  const aPriority = a.priority ?? 100;
  const bPriority = b.priority ?? 100;
  if (aPriority !== bPriority) return aPriority - bPriority;
  return a.label.localeCompare(b.label);
}

function CompartmentIcon({ compartment }: { compartment: NavCompartmentId }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (compartment) {
    case "overview":
      return (
        <svg {...props}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case "projects":
      return (
        <svg {...props}>
          <path d="M3 7h7v7H3z" />
          <path d="M14 7h7v4h-7z" />
          <path d="M14 15h7v6h-7z" />
          <path d="M3 18h7v3H3z" />
        </svg>
      );
    case "rnd":
      return (
        <svg {...props}>
          <path d="M9 3h6v4H9z" />
          <path d="M4 7h16l-2 14H6z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      );
    case "growth":
      return (
        <svg {...props}>
          <polyline points="4 14 9 9 13 13 20 6" />
          <polyline points="16 6 20 6 20 10" />
          <path d="M4 20h16" />
        </svg>
      );
    case "operations":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case "engine":
      return (
        <svg {...props}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case "advanced":
    default:
      return (
        <svg {...props}>
          <path d="M12 2v20" />
          <path d="M2 12h20" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        background: "var(--hc-surface-chip)",
        border: "1px solid var(--hc-border)",
        color: "var(--hc-text-muted)",
      }}
    >
      {children}
    </span>
  );
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

function OrbitalMetricCard({
  label,
  value,
  detail,
  tone = "info",
  href,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: DashboardTone;
  href?: string;
}) {
  const colors = toneStyles(tone);
  const content = (
    <div
      className="group relative overflow-hidden rounded-[28px] border p-5 transition-transform duration-200 hover:-translate-y-0.5"
      style={{
        background: "var(--hc-surface-elevated-strong)",
        borderColor: colors.border,
      }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full" style={{ background: colors.background }} />
      <div className="relative flex items-start justify-between gap-4">
        <div className="max-w-[60%]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
            {label}
          </div>
          <p className="mt-3 text-sm leading-6" style={{ color: "var(--hc-text-muted)" }}>
            {detail}
          </p>
        </div>
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border text-center"
          style={{ background: colors.background, borderColor: colors.border, color: colors.color }}
        >
          <div className="px-2 text-2xl font-semibold tracking-tight">{value}</div>
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function QuickActionTile({ panel }: { panel: PanelDef }) {
  const theme = compartmentStyles(panel.compartment);
  return (
    <Link href={`/panel/${panel.id}`} className="block">
      <div
        className="h-full rounded-[24px] border p-4 transition-transform duration-200 hover:-translate-y-0.5"
        style={{ background: "var(--hc-surface-elevated)", borderColor: theme.border }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
            style={{ background: theme.surface, color: theme.color, borderColor: theme.border }}
          >
            <CompartmentIcon compartment={panel.compartment} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
              {panel.label}
            </div>
            <p className="mt-1 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
              {panel.description}
            </p>
          </div>
        </div>
      </div>
    </Link>
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
    <section className="hc-card relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(142,106,53,0.36), transparent)" }} />
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

type WorkspaceCardData = {
  compartment: NavCompartmentId;
  value: string | number;
  detail: string;
  tone: DashboardTone;
  href: string;
  panels: string[];
};

function WorkspaceCard({
  compartment,
  value,
  detail,
  tone,
  href,
  panels,
}: {
  compartment: NavCompartmentId;
  value: string | number;
  detail: string;
  tone: DashboardTone;
  href: string;
  panels: string[];
}) {
  const theme = compartmentStyles(compartment);
  return (
    <Link href={href} className="block">
      <div className="h-full rounded-[28px] border p-5 transition-transform duration-200 hover:-translate-y-0.5" style={{ background: "var(--hc-surface-elevated)", borderColor: theme.border }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border" style={{ background: theme.surface, color: theme.color, borderColor: theme.border }}>
              <CompartmentIcon compartment={compartment} />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
                {COMPARTMENT_LABELS[compartment]}
              </div>
              <div className="mt-1 text-2xl font-semibold tracking-tight" style={{ color: theme.color }}>
                {value}
              </div>
            </div>
          </div>
          <StatusBadge status={statusFromTone(tone)} />
        </div>
        <p className="mt-4 text-sm leading-6" style={{ color: "var(--hc-text-muted)" }}>
          {detail}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {panels.map((panel) => (
            <span key={panel} className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: theme.surface, color: theme.color }}>
              {panel}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function LoadingShell() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-5 py-10">
      <div className="hc-card h-72 animate-pulse" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="hc-card h-40 animate-pulse" />
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
    () => QUICK_ACCESS_IDS.map((id) => PANELS.find((panel) => panel.id === id)).filter((panel): panel is PanelDef => Boolean(panel)),
    [],
  );

  const groupedPanels = useMemo(() => {
    const out: Record<NavCompartmentId, PanelDef[]> = {
      overview: [],
      projects: [],
      rnd: [],
      growth: [],
      operations: [],
      engine: [],
      advanced: [],
    };

    for (const panel of PANELS) {
      out[panel.compartment].push(panel);
    }

    for (const compartment of COMPARTMENT_ORDER) {
      out[compartment].sort(byPriority);
    }

    return out;
  }, []);

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

  const workspaceCards: WorkspaceCardData[] = WORKSPACE_IDS.map((compartment) => {
    const defaultPanels = groupedPanels[compartment].slice(0, 3).map((panel) => panel.label);
    if (compartment === "overview") {
      return {
        compartment,
        href: "/",
        value: `${moduleErrors}`,
        detail: `${snapshot.hero.engine_status === "ok" ? "Founder cockpit steady" : "Founder cockpit needs attention"}. ${Object.keys(snapshot.modules).length} operating modules tracked live.`,
        tone: moduleErrors > 0 ? "warning" : "success",
        panels: ["Founder Dashboard", ...defaultPanels].slice(0, 3),
      };
    }
    if (compartment === "projects") {
      return {
        compartment,
        href: "/panel/projects",
        value: snapshot.execution.project_count,
        detail: `${snapshot.execution.overdue_count} overdue and ${snapshot.execution.stalled_count} stalled execution items need steering.`,
        tone: (snapshot.execution.overdue_count + snapshot.execution.stalled_count) > 0 ? "warning" : "success",
        panels: defaultPanels,
      };
    }
    if (compartment === "rnd") {
      return {
        compartment,
        href: "/panel/experiment_form",
        value: snapshot.rnd.experiments_count,
        detail: `${snapshot.rnd.training_state} training state with ${snapshot.rnd.measurement_count} linked measurements and ${snapshot.rnd.source_count} sources.`,
        tone: snapshot.rnd.training_ready ? "success" : "warning",
        panels: defaultPanels,
      };
    }
    if (compartment === "growth") {
      return {
        compartment,
        href: "/panel/lead_intel",
        value: snapshot.growth.funding_count,
        detail: `${snapshot.growth.lead_status.row_count} lead rows exported, ${snapshot.growth.sales_count} sales records, ${snapshot.growth.finance_count} finance records.`,
        tone: snapshot.growth.lead_status.available ? "success" : "warning",
        panels: defaultPanels,
      };
    }
    if (compartment === "operations") {
      return {
        compartment,
        href: "/panel/compliance",
        value: snapshot.operations.compliance_due.length + snapshot.operations.approvals.length,
        detail: `${snapshot.operations.compliance_due.length} compliance items and ${snapshot.operations.approvals.length} approvals are in the immediate queue.`,
        tone: (snapshot.operations.compliance_due.length + snapshot.operations.approvals.length) > 0 ? "warning" : "success",
        panels: defaultPanels,
      };
    }
    return {
      compartment,
      href: "/panel/system_status",
      value: snapshot.engine.compute_mode,
      detail: `${snapshot.engine.ollama_reachable ? "Ollama reachable" : "Ollama down"} with ${snapshot.engine.module_errors.length} engine-side errors surfaced in state.`,
      tone: snapshot.hero.engine_status === "ok" ? "success" : snapshot.hero.engine_status === "down" ? "critical" : "warning",
      panels: defaultPanels,
    };
  });

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-8 px-5 py-10">
      <section className="hc-card relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 8% 18%, rgba(142,106,53,0.18), transparent 28%), radial-gradient(circle at 88% 16%, rgba(78,124,116,0.18), transparent 24%), radial-gradient(circle at 85% 84%, rgba(95,120,154,0.12), transparent 22%), linear-gradient(135deg, var(--hc-surface-muted), transparent)",
          }}
        />
        <div className="relative space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <div className="hc-kicker">HexCarb Founder Cockpit</div>
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
            <MetaChip>
              <StatusBadge status={snapshot.hero.engine_status === "ok" ? "ok" : snapshot.hero.engine_status === "down" ? "error" : "warning"} />
              Engine {snapshot.hero.engine_status}
            </MetaChip>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {quickAccess.map((panel) => (
              <QuickActionTile key={panel.id} panel={panel} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <OrbitalMetricCard label="Active Projects" value={kpis.active_projects} detail="Current planning and delivery work in motion." tone="success" href="/panel/projects" />
        <OrbitalMetricCard label="Overdue Tasks" value={kpis.overdue_tasks} detail={`${kpis.stalled_tasks} additional tasks are stalled.`} tone={kpis.overdue_tasks > 0 ? "critical" : "info"} href="/panel/weekly_plan" />
        <OrbitalMetricCard label="Pending Approvals" value={kpis.approvals_pending} detail="Actions waiting for founder or reviewer approval." tone={kpis.approvals_pending > 0 ? "warning" : "success"} href="/panel/approvals" />
        <OrbitalMetricCard label="Compliance Due" value={kpis.compliance_due_soon} detail="Filings, remittances, and governance tasks due soon." tone={kpis.compliance_due_soon > 0 ? "warning" : "success"} href="/panel/compliance" />
        <OrbitalMetricCard label="Funding Pipeline" value={kpis.funding_opportunities} detail="Tracked grants, investor motion, and opportunity flow." tone="info" href="/panel/funding" />
        <OrbitalMetricCard label="Indexed Chunks" value={kpis.indexed_chunks} detail={`${kpis.unread_notifications} unread notices still in the system.`} tone="info" href="/panel/doc_ingest" />
      </section>

      <SectionCard title="Workspace Map" subtitle="A calmer view of where work lives in the company cockpit and what each area is signaling right now." actionHref="/panel/projects" actionLabel="Open Workspace">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workspaceCards.map((card) => (
            <WorkspaceCard
              key={card.compartment}
              compartment={card.compartment}
              value={card.value}
              detail={card.detail}
              tone={card.tone}
              href={card.href}
              panels={card.panels}
            />
          ))}
        </div>
      </SectionCard>

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

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <SectionCard title="Today / Focus" subtitle="What needs founder attention right now." actionHref="/panel/projects" actionLabel="Projects">
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-accent)" }}>
                Focus now
              </div>
              <div className="flex flex-wrap gap-2">
                {snapshot.today.focus_now.length ? snapshot.today.focus_now.map((item) => (
                  <span key={item} className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--hc-surface-muted)", color: "var(--hc-text)" }}>
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
            <MetricCard label="Finance" value={snapshot.growth.finance_count} detail="Finance domain records" tone="info" />
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
