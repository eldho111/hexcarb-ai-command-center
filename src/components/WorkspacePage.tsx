"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { CompanyDashboardSnapshot, DashboardListItem, DashboardTone } from "@/lib/dashboard";
import { getPanelById, getWorkspaceSubviewPanels, type PanelDef, type WorkspaceDef } from "@/lib/panels";
import { PanelSurface } from "@/components/PanelPage";
import { StatusBadge } from "@/components/widgets/StatusBadge";

type WorkspaceState = {
  filterText: string;
  activeSubviewId?: string;
  activePanelBySubview?: Record<string, string>;
  pinnedPanelIds?: string[];
  recentPanelIds?: string[];
};

type SavedArtifact = {
  id: string;
  panelId?: string;
  panelLabel?: string;
  workspaceId?: string | null;
  endpoint?: string;
  savedAt?: string;
};

type MetricDef = {
  label: string;
  value: string | number;
  detail: string;
  tone?: DashboardTone;
};

type SummaryListDef = {
  title: string;
  items: DashboardListItem[];
  emptyLabel: string;
};

function compartmentStyles(compartment: WorkspaceDef["compartment"]): { surface: string; border: string; color: string } {
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
    default:
      return { surface: "rgba(109,124,167,0.12)", border: "rgba(109,124,167,0.24)", color: "#52659a" };
  }
}

function toneStyles(tone: DashboardTone = "info"): { background: string; border: string; color: string } {
  switch (tone) {
    case "success":
      return { background: "rgba(78,124,116,0.12)", border: "rgba(78,124,116,0.26)", color: "var(--hc-green)" };
    case "warning":
      return { background: "rgba(142,106,53,0.12)", border: "rgba(142,106,53,0.26)", color: "var(--hc-accent)" };
    case "critical":
      return { background: "rgba(245,100,84,0.12)", border: "rgba(245,100,84,0.24)", color: "var(--hc-active)" };
    default:
      return { background: "var(--hc-surface-muted)", border: "var(--hc-surface-muted-border)", color: "var(--hc-text-muted)" };
  }
}

function storageKey(workspaceId: string): string {
  return `hc-workspace-state:${workspaceId}`;
}

function readWorkspaceState(workspaceId: string): WorkspaceState {
  if (typeof window === "undefined") return { filterText: "" };
  try {
    const raw = window.localStorage.getItem(storageKey(workspaceId));
    if (!raw) return { filterText: "" };
    const parsed = JSON.parse(raw) as WorkspaceState;
    return {
      filterText: parsed.filterText || "",
      activeSubviewId: parsed.activeSubviewId,
      activePanelBySubview: parsed.activePanelBySubview || {},
      pinnedPanelIds: parsed.pinnedPanelIds || [],
      recentPanelIds: parsed.recentPanelIds || [],
    };
  } catch {
    return { filterText: "" };
  }
}

function saveWorkspaceState(workspaceId: string, state: WorkspaceState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(workspaceId), JSON.stringify(state));
}

function loadSavedArtifacts(workspaceId: string): SavedArtifact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("hc-workspace-saves");
    if (!raw) return [];
    return (JSON.parse(raw) as SavedArtifact[])
      .filter((item) => !item.workspaceId || item.workspaceId === workspaceId)
      .slice(0, 6);
  } catch {
    return [];
  }
}

function MetricCard({ metric }: { metric: MetricDef }) {
  const colors = toneStyles(metric.tone);
  return (
    <div className="rounded-2xl border p-4" style={{ background: "var(--hc-bg)", borderColor: colors.border }}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
        {metric.label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight" style={{ color: colors.color }}>
        {metric.value}
      </div>
      <p className="mt-2 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
        {metric.detail}
      </p>
    </div>
  );
}

function SummaryList({ title, items, emptyLabel }: SummaryListDef) {
  return (
    <div className="rounded-[24px] border p-4" style={{ background: "var(--hc-surface-elevated)", borderColor: "var(--hc-border)" }}>
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
        {title}
      </div>
      <div className="space-y-3">
        {items.length ? items.map((item) => (
          <Link
            key={item.id}
            href={item.href || "#"}
            className="block rounded-2xl border px-3 py-3 transition-colors hover:bg-black/[.03]"
            style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>{item.title}</div>
                {item.subtitle ? <div className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>{item.subtitle}</div> : null}
                {item.meta ? <div className="mt-1 text-[11px] leading-5" style={{ color: "var(--hc-text-muted)" }}>{item.meta}</div> : null}
              </div>
              {item.status ? <StatusBadge status={item.status} /> : null}
            </div>
          </Link>
        )) : (
          <div className="rounded-2xl border border-dashed px-3 py-4 text-sm" style={{ borderColor: "var(--hc-border)", color: "var(--hc-text-muted)" }}>
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}

function panelMatches(panel: PanelDef, filterText: string): boolean {
  if (!filterText.trim()) return true;
  const needle = filterText.trim().toLowerCase();
  return [panel.label, panel.description, panel.id].some((value) => value.toLowerCase().includes(needle));
}

function summariseWorkspace(workspace: WorkspaceDef, snapshot: CompanyDashboardSnapshot | null): { metrics: MetricDef[]; lists: SummaryListDef[] } {
  if (!snapshot) {
    return {
      metrics: [
        { label: "Loading", value: "…", detail: "Workspace snapshot is loading.", tone: "info" },
      ],
      lists: [],
    };
  }

  switch (workspace.id) {
    case "projects":
      return {
        metrics: [
          { label: "Active Projects", value: snapshot.kpis.active_projects, detail: "Work currently in motion.", tone: "success" },
          { label: "Overdue", value: snapshot.kpis.overdue_tasks, detail: `${snapshot.kpis.stalled_tasks} tasks are stalled.`, tone: snapshot.kpis.overdue_tasks > 0 ? "warning" : "success" },
          { label: "Goals", value: snapshot.execution.goals_count, detail: `${snapshot.execution.tasks_count} tracked tasks across the execution lane.`, tone: "info" },
        ],
        lists: [
          { title: "Next Plans", items: snapshot.today.next_plans, emptyLabel: "No next plans were generated yet." },
          { title: "Blocked Work", items: snapshot.today.blocked_items, emptyLabel: "No blocked project items right now." },
          { title: "Decisions", items: snapshot.activity.decisions, emptyLabel: "No recent decisions in the activity rail yet." },
        ],
      };
    case "rnd":
      return {
        metrics: [
          { label: "Experiments", value: snapshot.rnd.experiments_count, detail: "Canonical experiment records.", tone: "info" },
          { label: "Draft Queue", value: snapshot.rnd.draft_count, detail: "Pending review before canonical ingestion.", tone: snapshot.rnd.draft_count > 0 ? "warning" : "success" },
          { label: "Training", value: snapshot.rnd.training_state, detail: snapshot.rnd.training_ready ? "Training readiness is healthy." : "Training readiness needs more input.", tone: snapshot.rnd.training_ready ? "success" : "warning" },
          { label: "Knowledge", value: snapshot.rnd.source_count, detail: `${snapshot.rnd.indexed_chunks} indexed chunks are currently available.`, tone: "info" },
        ],
        lists: [
          { title: "Research Focus", items: snapshot.today.risk_items, emptyLabel: "No urgent R&D risks were surfaced." },
        ],
      };
    case "growth":
      return {
        metrics: [
          { label: "Lead Export", value: snapshot.growth.lead_status.available ? "Live" : "Missing", detail: `${snapshot.growth.lead_status.row_count} ranked lead rows are available.`, tone: snapshot.growth.lead_status.available ? "success" : "warning" },
          { label: "Funding", value: snapshot.growth.funding_count, detail: "Tracked funding opportunities.", tone: "info" },
          { label: "Sales", value: snapshot.growth.sales_count, detail: "Sales-domain records currently loaded.", tone: "info" },
          { label: "Signals", value: snapshot.growth.news_count, detail: "Recent market and research news items.", tone: "info" },
        ],
        lists: [
          { title: "Latest Funding", items: snapshot.growth.latest_funding, emptyLabel: "No funding updates yet." },
          { title: "Market Signals", items: snapshot.growth.latest_news, emptyLabel: "No market signals yet." },
        ],
      };
    case "operations":
      return {
        metrics: [
          { label: "Compliance Due", value: snapshot.operations.compliance_due.length, detail: "Items due within the near-term queue.", tone: snapshot.operations.compliance_due.length > 0 ? "warning" : "success" },
          { label: "Inbox Queue", value: snapshot.inbox.urgent_count, detail: `${snapshot.inbox.unread_count} unread inbox items across approvals, messages, and notices.`, tone: snapshot.inbox.urgent_count > 0 ? "warning" : "success" },
          { label: "Quality", value: snapshot.operations.quality.open_deviations, detail: `${snapshot.operations.quality.overdue_actions} corrective actions are overdue.`, tone: snapshot.operations.quality.open_deviations > 0 ? "warning" : "success" },
          { label: "Finance", value: snapshot.operations.finance_count, detail: "Finance-domain records tied to daily operations.", tone: "info" },
        ],
        lists: [
          { title: "Compliance Due", items: snapshot.operations.compliance_due, emptyLabel: "No near-term compliance tasks." },
          { title: "Inbox", items: snapshot.inbox.approvals, emptyLabel: "No pending approvals in the action center." },
        ],
      };
    case "engine":
    default:
      return {
        metrics: [
          { label: "Mode", value: snapshot.engine.mode, detail: snapshot.engine.recovery_hint || "Launcher-reported runtime mode.", tone: snapshot.engine.mode === "ready" ? "success" : snapshot.engine.mode === "down" ? "critical" : "warning" },
          { label: "GPU", value: snapshot.engine.gpu_available ? "Yes" : "No", detail: "Hardware availability for local serving.", tone: snapshot.engine.gpu_available ? "success" : "warning" },
          { label: "Chat Model", value: snapshot.engine.current_serving_model || "Unknown", detail: snapshot.engine.adapter_version || "Adapter information pending.", tone: snapshot.engine.current_serving_model ? "success" : "warning" },
          { label: "Dependencies", value: snapshot.engine.dependency_states.length, detail: "Tracked dependency states in the runtime layer.", tone: snapshot.engine.dependency_states.length > 0 ? "info" : "warning" },
        ],
        lists: [
          { title: "Dependency State", items: snapshot.engine.dependency_states, emptyLabel: "No dependency state was returned." },
          { title: "Recent Failures", items: snapshot.engine.recent_failures, emptyLabel: "No recent runtime failures were recorded." },
        ],
      };
  }
}

export function WorkspacePage({ workspace }: { workspace: WorkspaceDef }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storedState = useMemo(() => readWorkspaceState(workspace.id), [workspace.id]);
  const [snapshot, setSnapshot] = useState<CompanyDashboardSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [filterText, setFilterText] = useState(storedState.filterText || "");
  const [pinnedPanelIds, setPinnedPanelIds] = useState<string[]>(storedState.pinnedPanelIds || []);
  const [recentPanelIds, setRecentPanelIds] = useState<string[]>(storedState.recentPanelIds || []);
  const [activeSubviewId, setActiveSubviewId] = useState(searchParams.get("view") || storedState.activeSubviewId || workspace.subviews[0]?.id || "");
  const [activePanelBySubview, setActivePanelBySubview] = useState<Record<string, string>>(storedState.activePanelBySubview || {});
  const [savedArtifacts, setSavedArtifacts] = useState<SavedArtifact[]>([]);

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
        if (mounted) setLoadingSnapshot(false);
      }
    }

    void loadSnapshot();
    const timer = window.setInterval(() => {
      void loadSnapshot();
    }, 30000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setSavedArtifacts(loadSavedArtifacts(workspace.id));
  }, [workspace.id, activePanelBySubview]);

  const allPanels = useMemo(() => {
    const seen = new Set<string>();
    return workspace.subviews
      .flatMap((subview) => getWorkspaceSubviewPanels(workspace.id, subview.id))
      .filter((panel) => {
        if (seen.has(panel.id)) return false;
        seen.add(panel.id);
        return true;
      });
  }, [workspace]);

  const fallbackSubview = workspace.subviews[0];
  if (!fallbackSubview) return null;

  const activeSubview = workspace.subviews.find((subview) => subview.id === activeSubviewId) || fallbackSubview;
  const activePanels = useMemo(() => getWorkspaceSubviewPanels(workspace.id, activeSubview.id), [workspace.id, activeSubview.id]);
  const defaultPanelId = activePanelBySubview[activeSubview.id] || activeSubview.defaultPanelId || activePanels[0]?.id || "";
  const activePanel = getPanelById(defaultPanelId) || activePanels[0] || null;
  const panelMatchesFilter = filterText.trim() ? activePanels.filter((panel) => panelMatches(panel, filterText)) : activePanels;
  const filteredCatalog = filterText.trim() ? allPanels.filter((panel) => panelMatches(panel, filterText)) : allPanels;
  const pinnedPanels = pinnedPanelIds.map((panelId) => getPanelById(panelId)).filter((panel): panel is PanelDef => Boolean(panel));
  const recentPanels = recentPanelIds.map((panelId) => getPanelById(panelId)).filter((panel): panel is PanelDef => Boolean(panel));
  const summary = useMemo(() => summariseWorkspace(workspace, snapshot), [workspace, snapshot]);
  const theme = compartmentStyles(workspace.compartment);

  useEffect(() => {
    const nextState: WorkspaceState = {
      filterText,
      activeSubviewId,
      activePanelBySubview,
      pinnedPanelIds,
      recentPanelIds,
    };
    saveWorkspaceState(workspace.id, nextState);
  }, [workspace.id, filterText, activeSubviewId, activePanelBySubview, pinnedPanelIds, recentPanelIds]);

  useEffect(() => {
    const requestedView = searchParams.get("view");
    if (requestedView && requestedView !== activeSubviewId) {
      setActiveSubviewId(requestedView);
    }
  }, [searchParams, activeSubviewId]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", activeSubviewId);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false });
  }, [activeSubviewId, router]);

  useEffect(() => {
    if (!activePanel) return;
    setRecentPanelIds((prev) => [activePanel.id, ...prev.filter((panelId) => panelId !== activePanel.id)].slice(0, 6));
  }, [activePanel?.id]);

  function selectPanel(panelId: string) {
    const containingSubview = workspace.subviews.find((subview) => subview.panelIds.includes(panelId));
    if (!containingSubview) return;
    setActiveSubviewId(containingSubview.id);
    setActivePanelBySubview((prev) => ({ ...prev, [containingSubview.id]: panelId }));
  }

  function togglePinned(panelId: string) {
    setPinnedPanelIds((prev) => prev.includes(panelId)
      ? prev.filter((value) => value !== panelId)
      : [panelId, ...prev].slice(0, 8));
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-8 px-5 py-8">
      <section className="hc-card relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 8% 18%, ${theme.surface}, transparent 28%), radial-gradient(circle at 88% 12%, rgba(255,255,255,0.16), transparent 24%), linear-gradient(135deg, var(--hc-surface-muted), transparent)`,
          }}
        />
        <div className="relative space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="hc-kicker">{workspace.badgeLabel} workspace</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: "var(--hc-heading)" }}>
                {workspace.label}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7" style={{ color: "var(--hc-text-muted)" }}>
                {workspace.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link href="/panel/chat" className="hc-btn hc-btn-primary text-xs">
                Full Page Chat
              </Link>
              <Link href="/" className="hc-btn hc-btn-ghost text-xs">
                Back To Dashboard
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summary.metrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {workspace.subviews.map((subview) => {
            const active = subview.id === activeSubview.id;
            return (
              <button
                key={subview.id}
                type="button"
                onClick={() => setActiveSubviewId(subview.id)}
                className="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
                style={{
                  background: active ? theme.surface : "var(--hc-bg)",
                  color: active ? theme.color : "var(--hc-text-muted)",
                  border: `1px solid ${active ? theme.border : "var(--hc-border)"}`,
                }}
              >
                {subview.label}
              </button>
            );
          })}
        </div>
        <p className="text-sm leading-7" style={{ color: "var(--hc-text-muted)" }}>
          {activeSubview.description}
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {summary.lists.length ? (
            <div className="grid gap-4 xl:grid-cols-3">
              {summary.lists.map((list) => (
                <SummaryList key={list.title} {...list} />
              ))}
            </div>
          ) : null}

          {activePanels.length > 1 ? (
            <section className="rounded-[24px] border p-4" style={{ background: "var(--hc-surface-elevated)", borderColor: "var(--hc-border)" }}>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
                Subtools
              </div>
              <div className="flex flex-wrap gap-2">
                {(panelMatchesFilter.length ? panelMatchesFilter : activePanels).map((panel) => {
                  const active = panel.id === activePanel?.id;
                  return (
                    <button
                      key={panel.id}
                      type="button"
                      onClick={() => setActivePanelBySubview((prev) => ({ ...prev, [activeSubview.id]: panel.id }))}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={{
                        background: active ? theme.surface : "var(--hc-bg)",
                        color: active ? theme.color : "var(--hc-text-muted)",
                        border: `1px solid ${active ? theme.border : "var(--hc-border)"}`,
                      }}
                    >
                      {panel.label}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {activePanel ? <PanelSurface panel={activePanel} embedded workspaceLabel={workspace.label} /> : null}
        </div>

        <aside className="space-y-4">
          <section className="rounded-[24px] border p-4" style={{ background: "var(--hc-surface-elevated)", borderColor: "var(--hc-border)" }}>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
              Workspace Filters
            </div>
            <input
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
              placeholder="Filter tools in this workspace"
              className="w-full rounded-2xl px-3 py-2 text-sm"
              style={{ background: "var(--hc-bg)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}
            />
            <p className="mt-2 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
              This filter is saved for the workspace so you can return to the same context later.
            </p>
          </section>

          <section className="rounded-[24px] border p-4" style={{ background: "var(--hc-surface-elevated)", borderColor: "var(--hc-border)" }}>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
              Pinned Tools
            </div>
            <div className="flex flex-wrap gap-2">
              {pinnedPanels.length ? pinnedPanels.map((panel) => (
                <button
                  key={panel.id}
                  type="button"
                  onClick={() => selectPanel(panel.id)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ background: theme.surface, color: theme.color, border: `1px solid ${theme.border}` }}
                >
                  {panel.label}
                </button>
              )) : (
                <p className="text-sm" style={{ color: "var(--hc-text-muted)" }}>Pin a tool from the catalog to keep it close.</p>
              )}
            </div>
          </section>

          <section className="rounded-[24px] border p-4" style={{ background: "var(--hc-surface-elevated)", borderColor: "var(--hc-border)" }}>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
              Recent Tools
            </div>
            <div className="space-y-2">
              {recentPanels.length ? recentPanels.map((panel) => (
                <button
                  key={panel.id}
                  type="button"
                  onClick={() => selectPanel(panel.id)}
                  className="flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm transition-colors hover:bg-black/[.03]"
                  style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)", color: "var(--hc-text)" }}
                >
                  <span>{panel.label}</span>
                  <span className="text-[11px]" style={{ color: "var(--hc-text-muted)" }}>{panel.id}</span>
                </button>
              )) : (
                <p className="text-sm" style={{ color: "var(--hc-text-muted)" }}>Recent workspace tools will appear here as you move through the workbench.</p>
              )}
            </div>
          </section>

          <section className="rounded-[24px] border p-4" style={{ background: "var(--hc-surface-elevated)", borderColor: "var(--hc-border)" }}>
            <div className="mb-3 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
              <span>Tool Catalog</span>
              {loadingSnapshot ? <span>Syncing…</span> : null}
            </div>
            <div className="space-y-2">
              {filteredCatalog.map((panel) => {
                const pinned = pinnedPanelIds.includes(panel.id);
                return (
                  <div key={panel.id} className="rounded-2xl border px-3 py-3" style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => selectPanel(panel.id)} className="min-w-0 flex-1 text-left">
                        <div className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>{panel.label}</div>
                        <div className="mt-1 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>{panel.description}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePinned(panel.id)}
                        className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                        style={{
                          background: pinned ? theme.surface : "var(--hc-surface-muted)",
                          color: pinned ? theme.color : "var(--hc-text-muted)",
                          border: `1px solid ${pinned ? theme.border : "var(--hc-surface-muted-border)"}`,
                        }}
                      >
                        {pinned ? "Pinned" : "Pin"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[24px] border p-4" style={{ background: "var(--hc-surface-elevated)", borderColor: "var(--hc-border)" }}>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hc-text-muted)" }}>
              Saved Outputs
            </div>
            <div className="space-y-2">
              {savedArtifacts.length ? savedArtifacts.map((artifact) => (
                <div key={artifact.id} className="rounded-2xl border px-3 py-3" style={{ borderColor: "var(--hc-border)", background: "var(--hc-bg)" }}>
                  <div className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>{artifact.panelLabel || "Saved result"}</div>
                  <div className="mt-1 text-[11px] leading-5" style={{ color: "var(--hc-text-muted)" }}>{artifact.endpoint || "Saved from workspace"}</div>
                  {artifact.savedAt ? <div className="mt-1 text-[11px]" style={{ color: "var(--hc-text-muted)" }}>{new Date(artifact.savedAt).toLocaleString()}</div> : null}
                </div>
              )) : (
                <p className="text-sm" style={{ color: "var(--hc-text-muted)" }}>Saved AI outputs will land here when you use Save To Workspace.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
