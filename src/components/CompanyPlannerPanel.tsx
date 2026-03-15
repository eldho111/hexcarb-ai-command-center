"use client";

import { useEffect, useState } from "react";

import { engineFetch } from "@/lib/useEngine";

type JsonRecord = Record<string, unknown>;
type DashboardTab = "overview" | "intake" | "database" | "board" | "next";

type PreviewRow = {
  plan_id: string;
  title: string;
  status: string;
  kind: string;
  priority: string;
  horizon: string;
  owner_id: string;
  origin: string;
  source_url: string;
  goal_ids: string[];
  task_ids: string[];
};

type BoardColumn = {
  id: string;
  title: string;
  item_ids: string[];
};

type CompanyStatusLane = {
  tone: string;
  headline: string;
  item_count: number;
  top_items: string[];
};

type CompanyStatusBet = {
  title: string;
  tone: string;
  headline: string;
  item_count: number;
  item_ids: string[];
  top_items: string[];
  lifecycles: string[];
};

type CompanyStatus = {
  phase: string;
  summary: string;
  operating_mode: string;
  mapping_mode: string;
  override_count: number;
  lanes: Record<string, CompanyStatusLane>;
  top_bets: CompanyStatusBet[];
  top_risks: string[];
  top_catalysts: string[];
  strategic_bets: string[];
  as_of: string;
};

type ProjectOverride = {
  lane?: string;
  bet?: string;
  lifecycle?: string;
  counts_toward_status?: boolean;
};

type PlannerWorkspaceResponse = {
  found?: boolean;
  persisted?: boolean;
  workspace?: unknown;
  planning_context?: unknown;
};

const STORAGE_INPUTS_KEY = "hc-company-planner-inputs-v1";
const STORAGE_CONTEXT_KEY = "hc-company-planner-context-v1";
const DEFAULT_STRATEGIC_BETS = [
  "Nanotube sales",
  "MWCNT and SWCNT dispersion for battery",
  "Dispersion for refractory/cement",
  "Pristine nanotube fiber",
  "Thermal interface material",
  "Long-term single chiral nanotube reactor",
] as const;
const LANE_OPTIONS = ["execution", "operations", "growth", "rnd", "engine"] as const;
const LIFECYCLE_OPTIONS = ["discovery", "validation", "commercialization", "infrastructure", "governance"] as const;
const PLANNER_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
const TAB_ORDER: DashboardTab[] = ["overview", "intake", "database", "board", "next"];
const TAB_LABELS: Record<DashboardTab, string> = {
  overview: "Overview",
  intake: "Intake",
  database: "Database",
  board: "Board",
  next: "Next Moves",
};
const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  blocked: "Blocked",
  planned: "Planned",
  review: "Review",
  inbox: "Inbox",
  done: "Done",
};

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter((item) => item.trim().length > 0);
}

function asRecordArray(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function stableId(prefix: string, basis: string): string {
  let hash = 0;
  for (let index = 0; index < basis.length; index += 1) {
    hash = (hash * 31 + basis.charCodeAt(index)) >>> 0;
  }
  return `${prefix}_${hash.toString(16)}`;
}

function itemId(item: JsonRecord): string {
  return asString(
    item.plan_id,
    stableId(
      "item",
      [
        asString(item.title, "Untitled"),
        asString(item.source_url),
        asString(item.origin),
        asString(item.kind),
      ].join("|"),
    ),
  );
}

function inferKindFromTitle(title: string): string {
  const text = title.toLowerCase();
  if (/(compliance|gst|tax|remittance)/.test(text)) return "compliance_plan";
  if (/(grant|investor|funding|ventures)/.test(text)) return "funding_plan";
  if (/(meeting|follow-up|outreach|mou|collab)/.test(text)) return "follow_up_plan";
  if (/(procurement|supplier|consumables|card)/.test(text)) return "procurement_plan";
  if (/(protocol|sop|dispersion|batch|characterization)/.test(text)) return "research_protocol";
  if (/(pricing|datasheet|market|website|linkedin)/.test(text)) return "commercial_plan";
  if (/(engine|gpu|tools|training)/.test(text)) return "engineering_plan";
  return "notion_page";
}

function inferPriorityFromTitle(title: string): string {
  const text = title.toLowerCase();
  if (/(compliance|gst|tax|meeting|follow-up|grant|payment|redistribution)/.test(text)) return "high";
  if (/(pilot|protocol|supplier|pricing|procurement)/.test(text)) return "medium";
  return "low";
}

function inferHorizonFromTitle(title: string): string {
  const text = title.toLowerCase();
  if (/(monthly|week|meeting|follow-up|slot|payment)/.test(text)) return "this_week";
  if (/(grant|supplier|outreach|report|datasheet)/.test(text)) return "this_month";
  return "quarter";
}

function sourceLabel(url: string): string {
  if (!url) return "-";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatSavedAt(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function seedPlansToJson(value: unknown): string {
  const plans = Array.isArray(value) ? value : isRecord(value) ? [value] : [];
  return plans.length > 0 ? JSON.stringify(plans, null, 2) : "";
}

function priorityRank(priority: string): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority] ?? 4;
}

function statusRank(status: string): number {
  return { blocked: 0, active: 1, planned: 2, review: 3, inbox: 4, done: 5 }[status] ?? 6;
}

function formatList(items: string[], empty = "None", limit = 4): string {
  if (items.length === 0) return empty;
  const slice = items.slice(0, limit);
  return items.length > limit ? `${slice.join(", ")} +${items.length - limit}` : slice.join(", ");
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status || "Planned";
}

function humanizeSlug(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseStrategicBets(value: unknown): string[] {
  const items = asStringArray(value);
  return items.length > 0 ? items : [...DEFAULT_STRATEGIC_BETS];
}

function parseProjectOverrides(value: unknown): Record<string, ProjectOverride> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => isRecord(item))
      .map(([planId, item]) => {
        const entry = item as JsonRecord;
        const normalized: ProjectOverride = {};
        const lane = asString(entry.lane).toLowerCase();
        const bet = asString(entry.bet);
        const lifecycle = asString(entry.lifecycle).toLowerCase();
        if (lane) normalized.lane = lane;
        if (bet) normalized.bet = bet;
        if (lifecycle) normalized.lifecycle = lifecycle;
        if (typeof entry.counts_toward_status === "boolean") {
          normalized.counts_toward_status = entry.counts_toward_status;
        }
        return [planId, normalized];
      }),
  );
}

function parseCompanyStatus(value: unknown): CompanyStatus | null {
  if (!isRecord(value)) return null;
  const lanes = isRecord(value.lanes)
    ? Object.fromEntries(
        Object.entries(value.lanes).map(([lane, payload]) => {
          const laneRecord = isRecord(payload) ? payload : {};
          return [
            lane,
            {
              tone: asString(laneRecord.tone, "info"),
              headline: asString(laneRecord.headline),
              item_count: asNumber(laneRecord.item_count),
              top_items: asStringArray(laneRecord.top_items),
            } satisfies CompanyStatusLane,
          ];
        }),
      )
    : {};
  return {
    phase: asString(value.phase, "operating_execution"),
    summary: asString(value.summary),
    operating_mode: asString(value.operating_mode),
    mapping_mode: asString(value.mapping_mode, "default_heuristic"),
    override_count: asNumber(value.override_count),
    lanes,
    top_bets: asRecordArray(value.top_bets).map((item) => ({
      title: asString(item.title, "Strategic bet"),
      tone: asString(item.tone, "info"),
      headline: asString(item.headline),
      item_count: asNumber(item.item_count),
      item_ids: asStringArray(item.item_ids),
      top_items: asStringArray(item.top_items),
      lifecycles: asStringArray(item.lifecycles),
    })),
    top_risks: asStringArray(value.top_risks),
    top_catalysts: asStringArray(value.top_catalysts),
    strategic_bets: parseStrategicBets(value.strategic_bets),
    as_of: asString(value.as_of),
  };
}

function companyTone(tone: string): { background: string; color: string; border: string } {
  switch (tone) {
    case "success":
      return { background: "rgba(29, 122, 99, 0.14)", color: "var(--hc-green)", border: "rgba(29, 122, 99, 0.28)" };
    case "warning":
      return { background: "rgba(181, 125, 0, 0.14)", color: "var(--hc-accent)", border: "rgba(181, 125, 0, 0.28)" };
    case "critical":
      return { background: "rgba(196, 82, 39, 0.14)", color: "var(--hc-active)", border: "rgba(196, 82, 39, 0.28)" };
    default:
      return { background: "rgba(46, 92, 180, 0.12)", color: "var(--hc-text)", border: "rgba(46, 92, 180, 0.22)" };
  }
}

function strategicBetsToText(value: string[]): string {
  return value.join("\n");
}

function strategicBetsFromText(value: string): string[] {
  const items = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? Array.from(new Set(items)) : [...DEFAULT_STRATEGIC_BETS];
}

function parsePlannerFeedPreview(feedMarkdown: string): PreviewRow[] {
  const rows: PreviewRow[] = [];
  PLANNER_LINK_RE.lastIndex = 0;
  let matchIndex = 0;
  for (const match of feedMarkdown.matchAll(PLANNER_LINK_RE)) {
    const title = (match[1] || "").trim();
    const sourceUrl = (match[2] || "").trim();
    if (!title) continue;
    matchIndex += 1;
    rows.push({
      plan_id: stableId("feed", `${title}|${sourceUrl}|${matchIndex}`),
      title,
      status: "planned",
      kind: inferKindFromTitle(title),
      priority: inferPriorityFromTitle(title),
      horizon: inferHorizonFromTitle(title),
      owner_id: "unassigned",
      origin: "feed",
      source_url: sourceUrl,
      goal_ids: [],
      task_ids: [],
    });
  }
  return rows;
}

function parseSeedPlanPreview(seedPlansJson: string): { items: PreviewRow[]; error: string | null } {
  if (!seedPlansJson.trim()) return { items: [], error: null };
  try {
    const parsed = JSON.parse(seedPlansJson) as unknown;
    const rawItems = Array.isArray(parsed) ? parsed : [parsed];
    const items = rawItems
      .filter(isRecord)
      .map((item, index) => {
        const title = asString(item.title || item.objective || item.description, `Seed plan ${index + 1}`);
        const sourceUrl = asString(item.source_url);
        return {
          plan_id: asString(item.plan_id, stableId("seed", `${title}|${sourceUrl}|${index + 1}`)),
          title,
          status: asString(item.status, "planned"),
          kind: asString(item.kind, inferKindFromTitle(title)),
          priority: asString(item.priority, inferPriorityFromTitle(title)),
          horizon: asString(item.horizon, inferHorizonFromTitle(title)),
          owner_id: asString(item.owner_id || item.owner, "unassigned"),
          origin: asString(item.origin, "seed"),
          source_url: sourceUrl,
          goal_ids: asStringArray(item.goal_ids || item.related_goal_ids),
          task_ids: asStringArray(item.task_ids || item.related_task_ids),
        } satisfies PreviewRow;
      });
    return { items, error: null };
  } catch {
    return { items: [], error: "Seed Plans JSON is invalid." };
  }
}

function itemMatches(item: JsonRecord, query: string, statusFilter: string): boolean {
  const status = asString(item.status, "planned");
  if (statusFilter !== "all" && status !== statusFilter) return false;

  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    asString(item.title),
    asString(item.kind),
    asString(item.priority),
    asString(item.horizon),
    asString(item.owner_id),
    asString(item.origin),
    asString(item.summary),
    asString(item.notes),
    asString(item.source_url),
    ...asStringArray(item.goal_ids),
    ...asStringArray(item.task_ids),
    ...asStringArray(item.next_actions),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

function statusTone(status: string): { background: string; color: string; border: string } {
  switch (status) {
    case "active":
      return { background: "rgba(29, 122, 99, 0.14)", color: "var(--hc-green)", border: "rgba(29, 122, 99, 0.28)" };
    case "blocked":
      return { background: "rgba(196, 82, 39, 0.14)", color: "var(--hc-active)", border: "rgba(196, 82, 39, 0.28)" };
    case "review":
      return { background: "rgba(181, 125, 0, 0.14)", color: "var(--hc-accent)", border: "rgba(181, 125, 0, 0.28)" };
    case "done":
      return { background: "var(--hc-surface-muted)", color: "var(--hc-text-muted)", border: "var(--hc-surface-muted-border)" };
    case "inbox":
      return { background: "var(--hc-surface-muted)", color: "var(--hc-text-muted)", border: "var(--hc-surface-muted-border)" };
    default:
      return { background: "rgba(46, 92, 180, 0.12)", color: "var(--hc-text)", border: "rgba(46, 92, 180, 0.22)" };
  }
}

function priorityTone(priority: string): { background: string; color: string; border: string } {
  switch (priority) {
    case "high":
    case "critical":
      return { background: "rgba(245,100,84,0.14)", color: "var(--hc-active)", border: "rgba(245,100,84,0.28)" };
    case "medium":
      return { background: "rgba(142,106,53,0.14)", color: "var(--hc-accent)", border: "rgba(142,106,53,0.28)" };
    default:
      return { background: "rgba(78,124,116,0.14)", color: "var(--hc-green)", border: "rgba(78,124,116,0.28)" };
  }
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl px-4 py-4" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
      <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold" style={{ color: "var(--hc-heading)" }}>
        {value}
      </div>
      {detail ? (
        <div className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function DashboardTabButton({
  tab,
  active,
  count,
  onClick,
}: {
  tab: DashboardTab;
  active: boolean;
  count?: number;
  onClick: (tab: DashboardTab) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(tab)}
      className="rounded-full px-4 py-2 text-sm font-medium transition-all"
      style={{
        background: active ? "var(--hc-primary)" : "var(--hc-bg-soft)",
        color: active ? "#ffffff" : "var(--hc-text)",
        border: `1px solid ${active ? "var(--hc-primary)" : "var(--hc-border)"}`,
        boxShadow: active ? "0 12px 24px rgba(15, 25, 36, 0.18)" : "none",
      }}
    >
      {TAB_LABELS[tab]}
      {typeof count === "number" ? ` (${count})` : ""}
    </button>
  );
}

function ProjectCard({
  item,
  selected = false,
  compact = false,
  onSelect,
}: {
  item: JsonRecord;
  selected?: boolean;
  compact?: boolean;
  onSelect: (planId: string) => void;
}) {
  const id = itemId(item);
  const title = asString(item.title, "Untitled project");
  const status = asString(item.status, "planned");
  const priority = asString(item.priority, "medium");
  const kind = asString(item.kind, "plan");
  const horizon = asString(item.horizon, "this_week");
  const origin = asString(item.origin, "planner");
  const summary = asString(item.summary) || asString(item.notes);
  const nextActions = asStringArray(item.next_actions);
  const statusColors = statusTone(status);
  const priorityColors = priorityTone(priority);

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className="w-full rounded-2xl p-4 text-left transition-all"
      style={{
        background: selected ? "var(--hc-surface-muted)" : "var(--hc-card-bg)",
        border: `1px solid ${selected ? "var(--hc-accent)" : "var(--hc-border)"}`,
        boxShadow: selected ? "var(--shadow-soft)" : "none",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
            {origin}
          </div>
          <div className="mt-1 text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
            {title}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ background: statusColors.background, color: statusColors.color, borderColor: statusColors.border }}>
            {statusLabel(status)}
          </span>
          <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ background: priorityColors.background, color: priorityColors.color, borderColor: priorityColors.border }}>
            {priority}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-[11px]" style={{ color: "var(--hc-text-muted)" }}>
        <span>{kind}</span>
        <span>{horizon}</span>
        <span>{sourceLabel(asString(item.source_url))}</span>
      </div>

      {!compact ? (
        <>
          <div className="mt-3 text-sm leading-6" style={{ color: "var(--hc-text)" }}>
            {summary || "Select this project to inspect goals, tasks, linked sources, and generated actions."}
          </div>
          {nextActions.length > 0 ? (
            <div className="mt-3 text-xs" style={{ color: "var(--hc-text-muted)" }}>
              Next: {formatList(nextActions, "No actions", 2)}
            </div>
          ) : null}
        </>
      ) : null}
    </button>
  );
}

function PlannerDatabaseTable({
  title,
  subtitle,
  items,
  selectedPlanId,
  onSelect,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  items: JsonRecord[];
  selectedPlanId: string;
  onSelect: (planId: string) => void;
  emptyMessage: string;
}) {
  return (
    <section className="hc-card overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--hc-border)" }}>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
            {title}
          </h3>
          <p className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
            {subtitle}
          </p>
        </div>
        <span className="text-xs" style={{ color: "var(--hc-text-muted)" }}>
          {items.length} rows
        </span>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-5 text-sm" style={{ color: "var(--hc-text-muted)" }}>
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead style={{ background: "var(--hc-bg-soft)", color: "var(--hc-text-muted)" }}>
              <tr>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Links</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const id = itemId(item);
                const status = asString(item.status, "planned");
                const priority = asString(item.priority, "medium");
                const statusColors = statusTone(status);
                const priorityColors = priorityTone(priority);
                const selected = id === selectedPlanId;
                const goalIds = asStringArray(item.goal_ids);
                const taskIds = asStringArray(item.task_ids);
                const sourceUrl = asString(item.source_url);
                return (
                  <tr
                    key={id}
                    onClick={() => onSelect(id)}
                    className="cursor-pointer transition-colors"
                    style={{
                      borderTop: "1px solid var(--hc-border)",
                      background: selected ? "var(--hc-surface-muted)" : "transparent",
                    }}
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium" style={{ color: "var(--hc-heading)" }}>
                        {asString(item.title, "Untitled project")}
                      </div>
                      <div className="mt-1 text-[11px]" style={{ color: "var(--hc-text-muted)" }}>
                        {asString(item.origin, "planner")}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ background: statusColors.background, color: statusColors.color, borderColor: statusColors.border }}>
                        {statusLabel(status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ background: priorityColors.background, color: priorityColors.color, borderColor: priorityColors.border }}>
                        {priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top" style={{ color: "var(--hc-text)" }}>
                      {asString(item.kind, "plan")}
                    </td>
                    <td className="px-4 py-3 align-top" style={{ color: "var(--hc-text)" }}>
                      {asString(item.owner_id, "unassigned")}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {sourceUrl ? (
                        <a href={sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--hc-accent)" }} onClick={(event) => event.stopPropagation()}>
                          {sourceLabel(sourceUrl)}
                        </a>
                      ) : (
                        <span style={{ color: "var(--hc-text-muted)" }}>-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-[11px]" style={{ color: "var(--hc-text-muted)" }}>
                      Goals {goalIds.length} | Tasks {taskIds.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ProjectDetailPanel({ item }: { item: JsonRecord | null }) {
  if (!item) {
    return (
      <section className="hc-card p-5">
        <div className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
          Project Detail
        </div>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--hc-text-muted)" }}>
          Select a project, database row, or board card to inspect its planning detail.
        </p>
      </section>
    );
  }

  const title = asString(item.title, "Untitled project");
  const status = asString(item.status, "planned");
  const priority = asString(item.priority, "medium");
  const horizon = asString(item.horizon, "this_week");
  const owner = asString(item.owner_id, "unassigned");
  const kind = asString(item.kind, "plan");
  const sourceUrl = asString(item.source_url);
  const summary = asString(item.summary) || asString(item.notes) || "No summary is available yet for this project.";
  const nextActions = asStringArray(item.next_actions);
  const goalIds = asStringArray(item.goal_ids);
  const taskIds = asStringArray(item.task_ids);
  const linkedPlanIds = asStringArray(item.linked_plan_ids);
  const dependsOn = asStringArray(item.depends_on);
  const automation = isRecord(item.automation) ? item.automation : null;
  const metrics = isRecord(item.metrics) ? Object.entries(item.metrics).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)).slice(0, 6) : [];
  const statusColors = statusTone(status);
  const priorityColors = priorityTone(priority);

  return (
    <section className="hc-card overflow-hidden p-0">
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--hc-border)" }}>
        <div className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
          Project Detail
        </div>
        <div className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
          Selected project context for the HexCarb projects workspace.
        </div>
      </div>
      <div className="space-y-5 p-5">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ background: statusColors.background, color: statusColors.color, borderColor: statusColors.border }}>
              {statusLabel(status)}
            </span>
            <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ background: priorityColors.background, color: priorityColors.color, borderColor: priorityColors.border }}>
              {priority}
            </span>
            <span className="rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: "var(--hc-border)", color: "var(--hc-text-muted)" }}>
              {kind}
            </span>
            <span className="rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: "var(--hc-border)", color: "var(--hc-text-muted)" }}>
              {horizon}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold leading-7" style={{ color: "var(--hc-heading)" }}>
            {title}
          </h3>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--hc-text)" }}>
            {summary}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl p-3" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
            <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
              Owner
            </div>
            <div className="mt-1 text-sm font-medium" style={{ color: "var(--hc-heading)" }}>
              {owner}
            </div>
          </div>
          <div className="rounded-2xl p-3" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
            <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
              Source
            </div>
            <div className="mt-1 text-sm font-medium" style={{ color: "var(--hc-heading)" }}>
              {sourceUrl ? (
                <a href={sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--hc-accent)" }}>
                  {sourceLabel(sourceUrl)}
                </a>
              ) : (
                "No linked source"
              )}
            </div>
          </div>
          <div className="rounded-2xl p-3" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
            <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
              Goals
            </div>
            <div className="mt-1 text-sm font-medium" style={{ color: "var(--hc-heading)" }}>
              {goalIds.length}
            </div>
          </div>
          <div className="rounded-2xl p-3" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
            <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
              Tasks
            </div>
            <div className="mt-1 text-sm font-medium" style={{ color: "var(--hc-heading)" }}>
              {taskIds.length}
            </div>
          </div>
        </div>

        {nextActions.length > 0 ? (
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
              Next Actions
            </div>
            <div className="mt-2 space-y-2">
              {nextActions.slice(0, 5).map((action) => (
                <div key={action} className="rounded-xl px-3 py-2 text-sm" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}>
                  {action}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
              Goal Links
            </div>
            <div className="mt-1 text-sm" style={{ color: "var(--hc-text)" }}>
              {formatList(goalIds)}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
              Task Links
            </div>
            <div className="mt-1 text-sm" style={{ color: "var(--hc-text)" }}>
              {formatList(taskIds)}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
              Linked Plans
            </div>
            <div className="mt-1 text-sm" style={{ color: "var(--hc-text)" }}>
              {formatList(linkedPlanIds)}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
              Depends On
            </div>
            <div className="mt-1 text-sm" style={{ color: "var(--hc-text)" }}>
              {formatList(dependsOn)}
            </div>
          </div>
        </div>

        {metrics.length > 0 ? (
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
              Metrics
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {metrics.map(([key, value]) => (
                <div key={key} className="rounded-xl px-3 py-2 text-sm" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
                  <div style={{ color: "var(--hc-text-muted)" }}>{key}</div>
                  <div className="mt-1 font-medium" style={{ color: "var(--hc-heading)" }}>
                    {String(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {automation ? (
          <div className="rounded-2xl p-3" style={{ background: "var(--hc-surface-elevated)", border: "1px solid rgba(46, 92, 180, 0.18)" }}>
            <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
              Automation
            </div>
            <div className="mt-1 text-sm" style={{ color: "var(--hc-text)" }}>
              Reason: {asString(automation.reason, "manual")} | Confidence: {asString(automation.confidence, String(asNumber(automation.confidence, 0)))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CompanyStatusCard({ status }: { status: CompanyStatus | null }) {
  if (!status) {
    return (
      <section className="hc-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
              Company Status
            </h3>
            <p className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
              Founder-level synthesis of the current company queue.
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl px-4 py-4 text-sm" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)", color: "var(--hc-text-muted)" }}>
          Refresh Projects with your current planner feed to generate the company phase, strategic bet map, risks, and catalysts.
        </div>
      </section>
    );
  }

  const visibleLanes = Object.entries(status.lanes).filter(([, lane]) => lane.item_count > 0);

  return (
    <section className="hc-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
            Company Status
          </h3>
          <p className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
            Strategic synthesis of what phase HexCarb is in, which programs are carrying the load, and what is creating drag.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full px-3 py-1 font-semibold" style={{ background: "var(--hc-surface-chip)", color: "var(--hc-text)", border: "1px solid var(--hc-border)" }}>
            {humanizeSlug(status.phase)}
          </span>
          <span className="rounded-full px-3 py-1 font-semibold" style={{ background: "var(--hc-surface-chip)", color: "var(--hc-text)", border: "1px solid var(--hc-border)" }}>
            {status.mapping_mode === "hybrid_overrides" ? `Override assisted (${status.override_count})` : "Heuristic mapping"}
          </span>
          {status.as_of ? (
            <span className="rounded-full px-3 py-1 font-semibold" style={{ background: "var(--hc-surface-chip)", color: "var(--hc-text-muted)", border: "1px solid var(--hc-border)" }}>
              {formatSavedAt(status.as_of)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-3xl p-5" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
          <h4 className="text-lg font-semibold leading-7" style={{ color: "var(--hc-heading)" }}>
            {status.summary}
          </h4>
          <p className="mt-3 text-sm leading-7" style={{ color: "var(--hc-text-muted)" }}>
            {status.operating_mode}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {status.strategic_bets.map((bet) => (
              <span key={bet} className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: "var(--hc-card-bg)", color: "var(--hc-text)", border: "1px solid var(--hc-border)" }}>
                {bet}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-3xl p-5" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
          <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
            Top Bets
          </div>
          <div className="mt-3 space-y-3">
            {status.top_bets.length ? status.top_bets.slice(0, 3).map((bet) => {
              const colors = companyTone(bet.tone);
              return (
                <div key={bet.title} className="rounded-2xl border p-3" style={{ background: colors.background, borderColor: colors.border }}>
                  <div className="text-sm font-semibold" style={{ color: colors.color }}>
                    {bet.title}
                  </div>
                  <div className="mt-1 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
                    {bet.headline}
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-2xl px-4 py-4 text-sm" style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)", color: "var(--hc-text-muted)" }}>
                No strategic bets are mapped yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {(visibleLanes.length ? visibleLanes : Object.entries(status.lanes)).map(([laneName, lane]) => {
          const colors = companyTone(lane.tone);
          return (
            <div key={laneName} className="rounded-3xl border p-4" style={{ background: "var(--hc-card-bg)", borderColor: colors.border }}>
              <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
                {humanizeSlug(laneName)}
              </div>
              <div className="mt-2 text-2xl font-semibold" style={{ color: colors.color }}>
                {lane.item_count}
              </div>
              <div className="mt-2 text-xs leading-6" style={{ color: "var(--hc-text-muted)" }}>
                {lane.headline}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl p-4" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
          <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
            Top Risks
          </div>
          <div className="mt-3 space-y-2">
            {status.top_risks.length ? status.top_risks.map((risk) => (
              <div key={risk} className="rounded-2xl border px-3 py-2 text-sm" style={{ background: "rgba(245,100,84,0.08)", borderColor: "rgba(245,100,84,0.24)", color: "var(--hc-text)" }}>
                {risk}
              </div>
            )) : <div className="text-sm" style={{ color: "var(--hc-text-muted)" }}>No synthesized risks yet.</div>}
          </div>
        </div>
        <div className="rounded-3xl p-4" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
          <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
            Top Catalysts
          </div>
          <div className="mt-3 space-y-2">
            {status.top_catalysts.length ? status.top_catalysts.map((catalyst) => (
              <div key={catalyst} className="rounded-2xl border px-3 py-2 text-sm" style={{ background: "rgba(78,124,116,0.08)", borderColor: "rgba(78,124,116,0.24)", color: "var(--hc-text)" }}>
                {catalyst}
              </div>
            )) : <div className="text-sm" style={{ color: "var(--hc-text-muted)" }}>No synthesized catalysts yet.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProjectStatusOverridePanel({
  item,
  override,
  strategicBets,
  onChange,
}: {
  item: JsonRecord | null;
  override: ProjectOverride;
  strategicBets: string[];
  onChange: (patch: ProjectOverride) => void;
}) {
  if (!item) {
    return (
      <section className="hc-card p-5">
        <div className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
          Company Status Override
        </div>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--hc-text-muted)" }}>
          Select a project to manually correct its company lane, strategic bet, lifecycle, or rollup behavior.
        </p>
      </section>
    );
  }

  const laneValue = override.lane ?? asString(item.company_lane);
  const betValue = override.bet ?? asString(item.company_bet);
  const lifecycleValue = override.lifecycle ?? asString(item.company_lifecycle);
  const countsToward = typeof override.counts_toward_status === "boolean"
    ? override.counts_toward_status
    : typeof item.company_counts_toward_status === "boolean"
      ? item.company_counts_toward_status
      : true;

  return (
    <section className="hc-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
            Company Status Override
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
            Manual corrections for the selected project. Changes apply when you refresh Projects.
          </div>
        </div>
        <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: "var(--hc-surface-chip)", color: "var(--hc-text-muted)", border: "1px solid var(--hc-border)" }}>
          {asString(item.company_mapping_source, "heuristic") === "manual_override" || Object.keys(override).length > 0 ? "Override pending" : "Heuristic"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--hc-text-muted)" }}>
            Lane
          </label>
          <select
            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
            style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}
            value={laneValue}
            onChange={(event) => onChange({ lane: event.target.value || undefined })}
          >
            <option value="">Auto (heuristic)</option>
            {LANE_OPTIONS.map((lane) => (
              <option key={lane} value={lane}>{humanizeSlug(lane)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--hc-text-muted)" }}>
            Lifecycle
          </label>
          <select
            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
            style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}
            value={lifecycleValue}
            onChange={(event) => onChange({ lifecycle: event.target.value || undefined })}
          >
            <option value="">Auto (heuristic)</option>
            {LIFECYCLE_OPTIONS.map((lifecycle) => (
              <option key={lifecycle} value={lifecycle}>{humanizeSlug(lifecycle)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--hc-text-muted)" }}>
          Strategic Bet
        </label>
        <select
          className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
          style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}
          value={betValue}
          onChange={(event) => onChange({ bet: event.target.value || undefined })}
        >
          <option value="">Auto (heuristic)</option>
          {strategicBets.map((bet) => (
            <option key={bet} value={bet}>{bet}</option>
          ))}
        </select>
      </div>

      <label className="mt-4 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}>
        <input
          type="checkbox"
          checked={countsToward}
          onChange={(event) => onChange({ counts_toward_status: event.target.checked })}
        />
        Include this project in the company-status rollup
      </label>
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="hc-card p-6">
      <div className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
        {title}
      </div>
      <p className="mt-2 text-sm leading-6" style={{ color: "var(--hc-text-muted)" }}>
        {body}
      </p>
    </section>
  );
}

export function CompanyPlannerPanel() {
  const [ownerId, setOwnerId] = useState("");
  const [feedMarkdown, setFeedMarkdown] = useState("");
  const [seedPlansJson, setSeedPlansJson] = useState("");
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [planningContext, setPlanningContext] = useState<JsonRecord | null>(null);
  const [restored, setRestored] = useState(false);
  const [saveLocation, setSaveLocation] = useState<"none" | "backend" | "local">("none");
  const [savedAt, setSavedAt] = useState("");
  const [strategicBets, setStrategicBets] = useState<string[]>([...DEFAULT_STRATEGIC_BETS]);
  const [projectOverrides, setProjectOverrides] = useState<Record<string, ProjectOverride>>({});

  useEffect(() => {
    let cancelled = false;

    async function restorePlannerState() {
      let restoredFromBackend = false;

      try {
        const remote = await engineFetch<PlannerWorkspaceResponse>("/planning/company");
        if (!cancelled && remote.found && isRecord(remote.workspace)) {
          const workspace = remote.workspace;
          const remoteContext = isRecord(workspace.planning_context)
            ? workspace.planning_context
            : isRecord(remote.planning_context)
              ? remote.planning_context
              : null;

          if (typeof workspace.user_id === "string") setOwnerId(workspace.user_id);
          if (typeof workspace.feed_markdown === "string") setFeedMarkdown(workspace.feed_markdown);
          setSeedPlansJson(seedPlansToJson(workspace.seed_plans));
          setStrategicBets(parseStrategicBets(isRecord(workspace) ? workspace.strategic_bets : remoteContext?.strategic_bets));
          setProjectOverrides(parseProjectOverrides(isRecord(workspace) ? workspace.project_overrides : remoteContext?.project_overrides));
          if (remoteContext) {
            setPlanningContext(remoteContext);
            setStrategicBets(parseStrategicBets(remoteContext.strategic_bets ?? workspace.strategic_bets));
            setProjectOverrides(parseProjectOverrides(remoteContext.project_overrides ?? workspace.project_overrides));
          }
          setSaveLocation("backend");
          setSavedAt(asString(workspace.saved_at));
          restoredFromBackend = true;
        }
      } catch {
        restoredFromBackend = false;
      }

      if (!cancelled && !restoredFromBackend) {
        try {
          const rawInputs = window.localStorage.getItem(STORAGE_INPUTS_KEY);
          let hasLocalDraft = false;
          if (rawInputs) {
            const parsed = JSON.parse(rawInputs) as Record<string, unknown>;
            if (typeof parsed.ownerId === "string") {
              setOwnerId(parsed.ownerId);
              hasLocalDraft = hasLocalDraft || Boolean(parsed.ownerId);
            }
            if (typeof parsed.feedMarkdown === "string") {
              setFeedMarkdown(parsed.feedMarkdown);
              hasLocalDraft = hasLocalDraft || Boolean(parsed.feedMarkdown.trim());
            }
            if (typeof parsed.seedPlansJson === "string") {
              setSeedPlansJson(parsed.seedPlansJson);
              hasLocalDraft = hasLocalDraft || Boolean(parsed.seedPlansJson.trim());
            }
            if (Array.isArray(parsed.strategicBets) || typeof parsed.strategicBets === "string") {
              setStrategicBets(parseStrategicBets(parsed.strategicBets));
              hasLocalDraft = true;
            }
            if (isRecord(parsed.projectOverrides)) {
              setProjectOverrides(parseProjectOverrides(parsed.projectOverrides));
              hasLocalDraft = true;
            }
          }

          const rawContext = window.localStorage.getItem(STORAGE_CONTEXT_KEY);
          if (rawContext) {
            const parsedContext = JSON.parse(rawContext) as unknown;
            if (isRecord(parsedContext)) {
              setPlanningContext(parsedContext);
              setStrategicBets(parseStrategicBets(parsedContext.strategic_bets));
              setProjectOverrides(parseProjectOverrides(parsedContext.project_overrides));
              hasLocalDraft = true;
            }
          }

          if (hasLocalDraft) setSaveLocation("local");
        } catch {
          // Fall through to restored flag.
        }
      }

      if (!cancelled) setRestored(true);
    }

    void restorePlannerState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!restored) return;
    window.localStorage.setItem(
      STORAGE_INPUTS_KEY,
      JSON.stringify({
        ownerId,
        feedMarkdown,
        seedPlansJson,
        strategicBets,
        projectOverrides,
      }),
    );
  }, [ownerId, feedMarkdown, seedPlansJson, strategicBets, projectOverrides, restored]);

  useEffect(() => {
    if (!restored) return;
    if (planningContext) {
      window.localStorage.setItem(STORAGE_CONTEXT_KEY, JSON.stringify(planningContext));
      return;
    }
    window.localStorage.removeItem(STORAGE_CONTEXT_KEY);
  }, [planningContext, restored]);

  async function generatePlanner() {
    setLoading(true);
    setError("");

    try {
      let seedPlans: unknown[] = [];
      if (seedPlansJson.trim()) {
        const parsed = JSON.parse(seedPlansJson);
        seedPlans = Array.isArray(parsed) ? parsed : [parsed];
      }

      const payload: JsonRecord = {};
      if (ownerId.trim()) payload.user_id = ownerId.trim();
      if (feedMarkdown.trim()) payload.feed_markdown = feedMarkdown;
      if (seedPlans.length > 0) payload.seed_plans = seedPlans;
      if (strategicBets.length > 0) payload.strategic_bets = strategicBets;
      if (Object.keys(projectOverrides).length > 0) payload.project_overrides = projectOverrides;

      const res = await engineFetch<PlannerWorkspaceResponse>("/planning/company", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!isRecord(res.planning_context)) {
        throw new Error("Planner response did not include a planning_context object.");
      }

      setPlanningContext(res.planning_context);
      setStrategicBets(parseStrategicBets(res.planning_context.strategic_bets));
      setProjectOverrides(parseProjectOverrides(res.planning_context.project_overrides));
      setSaveLocation(res.persisted ? "backend" : "local");
      setSavedAt(isRecord(res.workspace) ? asString(res.workspace.saved_at) : "");
      setActiveTab("overview");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function clearSavedPlanner() {
    const ownerToClear = ownerId.trim();

    setPlanningContext(null);
    setOwnerId("");
    setFeedMarkdown("");
    setSeedPlansJson("");
    setSearchQuery("");
    setStatusFilter("all");
    setSelectedPlanId("");
    setSaveLocation("none");
    setSavedAt("");
    setStrategicBets([...DEFAULT_STRATEGIC_BETS]);
    setProjectOverrides({});
    setError("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_INPUTS_KEY);
      window.localStorage.removeItem(STORAGE_CONTEXT_KEY);
    }

    try {
      const query = ownerToClear ? `?user_id=${encodeURIComponent(ownerToClear)}` : "";
      await engineFetch(`/planning/company${query}`, { method: "DELETE" });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? `Projects cleared locally, but the saved engine workspace could not be removed: ${err.message}`
          : "Projects cleared locally, but the saved engine workspace could not be removed.",
      );
    }
  }

  const feedPreviewItems = parsePlannerFeedPreview(feedMarkdown);
  const seedPreview = parseSeedPlanPreview(seedPlansJson);
  const intakeRows: JsonRecord[] = seedPreview.items.length > 0 ? seedPreview.items : feedPreviewItems;

  const plannerItems = asRecordArray(planningContext?.planner_items);
  const nextPlans = asRecordArray(planningContext?.next_generated_plans);
  const seedPlans = asRecordArray(planningContext?.seed_plans);
  const board = isRecord(planningContext?.planner_board) ? planningContext.planner_board : {};
  const rawBoardColumns = asRecordArray(board.columns);
  const focusNow = asStringArray(planningContext?.focus_now);
  const relationships = asRecordArray(planningContext?.planner_relationships);
  const companyStatus = parseCompanyStatus(planningContext?.company_status);

  const projectRows = plannerItems.length > 0 ? plannerItems : seedPlans.length > 0 ? seedPlans : intakeRows;
  const filteredRows = projectRows.filter((item) => itemMatches(item, searchQuery, statusFilter));
  const filteredNextPlans = nextPlans.filter((item) => itemMatches(item, searchQuery, statusFilter));
  const filteredIntakeRows = intakeRows.filter((item) => itemMatches(item, searchQuery, statusFilter));
  const filteredSeedPlans = seedPlans.filter((item) => itemMatches(item, searchQuery, statusFilter));

  const visibleIds = new Set(filteredRows.map((item) => itemId(item)));
  const boardColumns: BoardColumn[] = rawBoardColumns.length > 0
    ? rawBoardColumns
        .map((column) => ({
          id: asString(column.id, asString(column.title, stableId("column", JSON.stringify(column)))),
          title: asString(column.title, "Lane"),
          item_ids: asStringArray(column.item_ids).filter((id) => visibleIds.has(id)),
        }))
        .filter((column) => column.item_ids.length > 0)
    : ["active", "blocked", "planned", "review", "done"].map((status) => ({
        id: status,
        title: statusLabel(status),
        item_ids: filteredRows.filter((item) => asString(item.status, "planned") === status).map((item) => itemId(item)),
      }));

  const rankedProjects = [...filteredRows].sort((left, right) => {
    const priorityDelta = priorityRank(asString(left.priority, "medium")) - priorityRank(asString(right.priority, "medium"));
    if (priorityDelta !== 0) return priorityDelta;
    const statusDelta = statusRank(asString(left.status, "planned")) - statusRank(asString(right.status, "planned"));
    if (statusDelta !== 0) return statusDelta;
    return asString(left.title).localeCompare(asString(right.title));
  });
  const focusProjects = focusNow
    .map((planId) => projectRows.find((item) => itemId(item) === planId))
    .filter((item): item is JsonRecord => item !== undefined);
  const selectedProject = [
    ...filteredRows,
    ...filteredNextPlans,
    ...projectRows,
    ...intakeRows,
  ].find((item) => itemId(item) === selectedPlanId) || filteredRows[0] || filteredNextPlans[0] || projectRows[0] || intakeRows[0] || null;

  useEffect(() => {
    if (!selectedProject) {
      if (selectedPlanId) setSelectedPlanId("");
      return;
    }
    const id = itemId(selectedProject);
    if (!selectedPlanId) {
      setSelectedPlanId(id);
    }
  }, [selectedProject, selectedPlanId]);

  const selectedId = selectedProject ? itemId(selectedProject) : "";
  const selectedOverride = selectedId ? projectOverrides[selectedId] ?? {} : {};

  function updateSelectedProjectOverride(patch: ProjectOverride) {
    if (!selectedProject) return;
    const planId = itemId(selectedProject);
    const defaultLane = asString(selectedProject.company_lane);
    const defaultBet = asString(selectedProject.company_bet);
    const defaultLifecycle = asString(selectedProject.company_lifecycle);
    const defaultCounts = typeof selectedProject.company_counts_toward_status === "boolean"
      ? selectedProject.company_counts_toward_status
      : true;

    setProjectOverrides((current) => {
      const existing = current[planId] ?? {};
      const next: ProjectOverride = { ...existing, ...patch };
      if (!next.lane || next.lane === defaultLane) delete next.lane;
      if (!next.bet || next.bet === defaultBet) delete next.bet;
      if (!next.lifecycle || next.lifecycle === defaultLifecycle) delete next.lifecycle;
      if (typeof next.counts_toward_status === "boolean" && next.counts_toward_status === defaultCounts) {
        delete next.counts_toward_status;
      }
      const out = { ...current };
      if (Object.keys(next).length === 0) {
        delete out[planId];
      } else {
        out[planId] = next;
      }
      return out;
    });
  }

  const activeCount = projectRows.filter((item) => asString(item.status, "planned") === "active").length;
  const blockedCount = projectRows.filter((item) => asString(item.status, "planned") === "blocked").length;
  const highPriorityCount = projectRows.filter((item) => priorityRank(asString(item.priority, "medium")) <= 1).length;
  const readyCount = nextPlans.length;
  const projectCount = projectRows.length;

  const tabCounts: Record<DashboardTab, number | undefined> = {
    overview: projectCount,
    intake: intakeRows.length,
    database: filteredRows.length,
    board: boardColumns.length,
    next: filteredNextPlans.length,
  };

  const intakeTableRows = filteredSeedPlans.length > 0 ? filteredSeedPlans : filteredIntakeRows;

  return (
    <div className="space-y-6">
      <section className="hc-card relative overflow-hidden p-6">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(142,106,53,0.18), transparent 34%), radial-gradient(circle at top right, rgba(78,124,116,0.18), transparent 28%), linear-gradient(135deg, var(--hc-surface-muted), transparent)",
          }}
        />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="hc-kicker">Hexcarb AI Engine</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight" style={{ color: "var(--hc-heading)" }}>
                Projects Workspace
              </h2>
              <p className="mt-3 text-sm leading-7" style={{ color: "var(--hc-text-muted)" }}>
                Operational workspace for HexCarb projects, imported Notion plans, linked execution work, and AI-generated next actions.
                Use intake to add or refresh projects, then manage them through the database, board, and next-move queue.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="hc-btn hc-btn-ghost text-sm" onClick={clearSavedPlanner}>
                Clear Projects
              </button>
              <button type="button" className="hc-btn hc-btn-primary text-sm" onClick={generatePlanner} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh Projects"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Projects" value={projectCount} detail="All visible planning rows" />
            <MetricCard label="Active" value={activeCount} detail="Current execution work" />
            <MetricCard label="Blocked" value={blockedCount} detail="Needs intervention" />
            <MetricCard label="High Priority" value={highPriorityCount} detail="Urgent or strategic items" />
            <MetricCard label="Next Moves" value={readyCount} detail="Generated follow-on actions" />
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs" style={{ color: "var(--hc-text-muted)" }}>
            <span>{relationships.length} relationships mapped</span>
            <span>{feedPreviewItems.length} imported links parsed</span>
            <span>{seedPreview.items.length} structured seed plans</span>
            {restored && saveLocation === "backend" ? <span>{savedAt ? `Saved in engine workspace • ${formatSavedAt(savedAt)}` : "Saved in engine workspace"}</span> : null}
            {restored && saveLocation === "local" && (feedMarkdown.trim() || seedPlansJson.trim() || planningContext) ? <span>Draft saved locally in this browser</span> : null}
          </div>
        </div>
      </section>

      <section className="hc-card p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {TAB_ORDER.map((tab) => (
              <DashboardTabButton
                key={tab}
                tab={tab}
                active={activeTab === tab}
                count={tabCounts[tab]}
                onClick={setActiveTab}
              />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[260px_180px]">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--hc-text-muted)" }}>
                Search Projects
              </label>
              <input
                type="text"
                className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
                style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}
                placeholder="Search title, source, owner, goals..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--hc-text-muted)" }}>
                Status Filter
              </label>
              <select
                className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
                style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="planned">Planned</option>
                <option value="review">Review</option>
                <option value="inbox">Inbox</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>
        </div>

        {seedPreview.error ? (
          <div className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ background: "rgba(181, 125, 0, 0.14)", border: "1px solid rgba(181, 125, 0, 0.28)", color: "var(--hc-accent)" }}>
            {seedPreview.error}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ background: "rgba(245,100,84,0.08)", border: "1px solid var(--hc-active)", color: "var(--hc-active)" }}>
            {error}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
        <div className="space-y-6">
          {activeTab === "overview" ? (
            <>
              <CompanyStatusCard status={companyStatus} />

              <div className="grid gap-6 xl:grid-cols-2">
                <section className="hc-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                        Current Focus
                      </h3>
                      <p className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
                        Projects the engine wants on the immediate control surface.
                      </p>
                    </div>
                    <span className="text-xs" style={{ color: "var(--hc-text-muted)" }}>
                      {focusProjects.length || Math.min(rankedProjects.length, 4)} items
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {(focusProjects.length > 0 ? focusProjects : rankedProjects.slice(0, 4)).map((item) => (
                      <ProjectCard
                        key={itemId(item)}
                        item={item}
                        selected={itemId(item) === selectedId}
                        onSelect={setSelectedPlanId}
                      />
                    ))}
                    {focusProjects.length === 0 && rankedProjects.length === 0 ? (
                      <div className="rounded-2xl px-4 py-4 text-sm" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)", color: "var(--hc-text-muted)" }}>
                        Add projects in Intake and refresh the dashboard to build the focus queue.
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="hc-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                        Priority Radar
                      </h3>
                      <p className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
                        High-priority and blocked work, sorted for fast triage.
                      </p>
                    </div>
                    <span className="text-xs" style={{ color: "var(--hc-text-muted)" }}>
                      {rankedProjects.length} visible
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {rankedProjects.slice(0, 5).map((item) => (
                      <ProjectCard
                        key={itemId(item)}
                        item={item}
                        compact
                        selected={itemId(item) === selectedId}
                        onSelect={setSelectedPlanId}
                      />
                    ))}
                    {rankedProjects.length === 0 ? (
                      <div className="rounded-2xl px-4 py-4 text-sm" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)", color: "var(--hc-text-muted)" }}>
                        No projects match the current search and status filters.
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>

              <section className="hc-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                      Project Board Snapshot
                    </h3>
                    <p className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
                      A fast board view of the current filtered project set.
                    </p>
                  </div>
                  <span className="text-xs" style={{ color: "var(--hc-text-muted)" }}>
                    {boardColumns.filter((column) => asStringArray(column.item_ids).length > 0).length} lanes
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {boardColumns
                    .filter((column) => asStringArray(column.item_ids).length > 0)
                    .slice(0, 4)
                    .map((column) => {
                      const ids = asStringArray(column.item_ids);
                      return (
                        <div key={asString(column.id, asString(column.title))} className="rounded-3xl p-4" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                              {asString(column.title, "Lane")}
                            </h4>
                            <span className="text-[11px]" style={{ color: "var(--hc-text-muted)" }}>
                              {ids.length}
                            </span>
                          </div>
                          <div className="mt-3 space-y-3">
                            {ids.slice(0, 3).map((planId) => {
                              const item = projectRows.find((project) => itemId(project) === planId);
                              if (!item) return null;
                              return (
                                <ProjectCard
                                  key={planId}
                                  item={item}
                                  compact
                                  selected={planId === selectedId}
                                  onSelect={setSelectedPlanId}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>

              <section className="hc-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                      Suggested Next Moves
                    </h3>
                    <p className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
                      Engine-generated follow-up work that should be converted into execution.
                    </p>
                  </div>
                  <span className="text-xs" style={{ color: "var(--hc-text-muted)" }}>
                    {filteredNextPlans.length} queued
                  </span>
                </div>
                {filteredNextPlans.length === 0 ? (
                  <div className="mt-4 rounded-2xl px-4 py-4 text-sm" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)", color: "var(--hc-text-muted)" }}>
                    No next moves match the current filters yet.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {filteredNextPlans.slice(0, 6).map((item) => (
                      <ProjectCard
                        key={itemId(item)}
                        item={item}
                        selected={itemId(item) === selectedId}
                        onSelect={setSelectedPlanId}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}

          {activeTab === "intake" ? (
            <>
              <section className="hc-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                      Project Intake
                    </h3>
                    <p className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
                      Paste Notion markdown links for current projects or add structured seed plans to preload richer metadata.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs" style={{ color: "var(--hc-text-muted)" }}>
                    <span>{feedPreviewItems.length} feed rows</span>
                    <span>{seedPreview.items.length} seed rows</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: "var(--hc-text-muted)" }}>
                      Project Feed
                    </label>
                    <textarea
                      className="min-h-[240px] w-full rounded-2xl px-3 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
                      style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}
                      placeholder="Paste Notion markdown links or freeform operating notes here."
                      value={feedMarkdown}
                      onChange={(event) => setFeedMarkdown(event.target.value)}
                    />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium" style={{ color: "var(--hc-text-muted)" }}>
                        Owner Filter
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
                        style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}
                        placeholder="Optional user_id"
                        value={ownerId}
                        onChange={(event) => setOwnerId(event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium" style={{ color: "var(--hc-text-muted)" }}>
                        Strategic Bets
                      </label>
                      <textarea
                        className="min-h-[120px] w-full rounded-2xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
                        style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}
                        value={strategicBetsToText(strategicBets)}
                        onChange={(event) => setStrategicBets(strategicBetsFromText(event.target.value))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium" style={{ color: "var(--hc-text-muted)" }}>
                        Seed Plans JSON
                      </label>
                      <textarea
                        className="min-h-[180px] w-full rounded-2xl px-3 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
                        style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}
                        placeholder='[{"title":"Thermal Battery Outreach","goal_ids":["GOAL_0001"]}]'
                        value={seedPlansJson}
                        onChange={(event) => setSeedPlansJson(event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <PlannerDatabaseTable
                title="Project Intake"
                subtitle="Preview of the project rows currently being added into the Hexcarb dashboard. Click a row to inspect it on the right."
                items={intakeTableRows}
                selectedPlanId={selectedId}
                onSelect={setSelectedPlanId}
                emptyMessage="Paste project links or structured seed plans to build your intake preview."
              />
            </>
          ) : null}

          {activeTab === "database" ? (
            <PlannerDatabaseTable
              title="Master Project Database"
              subtitle="Searchable project database for the Hexcarb AI engine planning surface."
              items={filteredRows}
              selectedPlanId={selectedId}
              onSelect={setSelectedPlanId}
              emptyMessage="No projects match the current filters."
            />
          ) : null}

          {activeTab === "board" ? (
            <section className="hc-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                    Project Board
                  </h3>
                  <p className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
                    Lane-based execution view for the current filtered project set.
                  </p>
                </div>
                <span className="text-xs" style={{ color: "var(--hc-text-muted)" }}>
                  {boardColumns.filter((column) => asStringArray(column.item_ids).length > 0).length} lanes
                </span>
              </div>
              {boardColumns.filter((column) => asStringArray(column.item_ids).length > 0).length === 0 ? (
                <div className="mt-4 rounded-2xl px-4 py-4 text-sm" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)", color: "var(--hc-text-muted)" }}>
                  No board lanes match the current filters.
                </div>
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {boardColumns
                    .filter((column) => asStringArray(column.item_ids).length > 0)
                    .map((column) => {
                      const ids = asStringArray(column.item_ids);
                      return (
                        <div key={asString(column.id, asString(column.title))} className="rounded-3xl p-4" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                              {asString(column.title, "Lane")}
                            </h4>
                            <span className="text-[11px]" style={{ color: "var(--hc-text-muted)" }}>
                              {ids.length}
                            </span>
                          </div>
                          <div className="mt-3 space-y-3">
                            {ids.map((planId) => {
                              const item = projectRows.find((project) => itemId(project) === planId);
                              if (!item) return null;
                              return (
                                <ProjectCard
                                  key={planId}
                                  item={item}
                                  compact
                                  selected={planId === selectedId}
                                  onSelect={setSelectedPlanId}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "next" ? (
            <section className="hc-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                    Suggested Next Moves
                  </h3>
                  <p className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
                    Generated work packages and follow-up plans that can be promoted into execution.
                  </p>
                </div>
                <span className="text-xs" style={{ color: "var(--hc-text-muted)" }}>
                  {filteredNextPlans.length} queued
                </span>
              </div>
              {filteredNextPlans.length === 0 ? (
                <div className="mt-4 rounded-2xl px-4 py-4 text-sm" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)", color: "var(--hc-text-muted)" }}>
                  No next moves are available for the current filters.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {filteredNextPlans.map((item) => (
                    <ProjectCard
                      key={itemId(item)}
                      item={item}
                      selected={itemId(item) === selectedId}
                      onSelect={setSelectedPlanId}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {planningContext ? (
            <details className="hc-card p-5">
              <summary className="cursor-pointer text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                Raw Planning Context
              </summary>
              <pre className="mt-4 overflow-x-auto rounded-2xl p-4 text-xs" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}>
                {JSON.stringify(planningContext, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>

        <div className="space-y-6">
          <ProjectDetailPanel item={selectedProject} />
          <ProjectStatusOverridePanel
            item={selectedProject}
            override={selectedOverride}
            strategicBets={strategicBets}
            onChange={updateSelectedProjectOverride}
          />

          <section className="hc-card p-5">
            <div className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
              Dashboard Signals
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl p-4" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
                <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
                  Search Results
                </div>
                <div className="mt-1 text-lg font-semibold" style={{ color: "var(--hc-heading)" }}>
                  {filteredRows.length}
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
                  Projects matching the current search and status filter.
                </div>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
                <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
                  Imported Feed
                </div>
                <div className="mt-1 text-lg font-semibold" style={{ color: "var(--hc-heading)" }}>
                  {feedPreviewItems.length}
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--hc-text-muted)" }}>
                  Parsed project links from the current intake feed.
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl p-4" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
              <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
                Current Filters
              </div>
              <div className="mt-2 space-y-1 text-sm" style={{ color: "var(--hc-text)" }}>
                <div>Search: {searchQuery.trim() || "No search applied"}</div>
                <div>Status: {statusFilter === "all" ? "All statuses" : statusLabel(statusFilter)}</div>
                <div>Owner scope: {ownerId.trim() || "All owners"}</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl p-4" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
              <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
                Operating Guidance
              </div>
              <div className="mt-2 space-y-2 text-sm" style={{ color: "var(--hc-text)" }}>
                <div>Use Intake to add or revise the current Notion project feed.</div>
                <div>Use Database to search and select projects quickly.</div>
                <div>Use Board to reorient around execution status.</div>
                <div>Use Next Moves to promote generated plans into real work.</div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {!planningContext && intakeRows.length === 0 ? (
        <EmptyState
          title="Dashboard Ready For Intake"
          body="Paste your current Notion project list into Intake, then refresh the dashboard to build the master project database and board."
        />
      ) : null}
    </div>
  );
}
