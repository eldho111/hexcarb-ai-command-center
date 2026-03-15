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

const STORAGE_INPUTS_KEY = "hc-company-planner-inputs-v1";
const STORAGE_CONTEXT_KEY = "hc-company-planner-context-v1";
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
      return { background: "rgba(29, 122, 99, 0.10)", color: "#0e5a47", border: "rgba(29, 122, 99, 0.20)" };
    case "blocked":
      return { background: "rgba(196, 82, 39, 0.10)", color: "#9e3e17", border: "rgba(196, 82, 39, 0.22)" };
    case "review":
      return { background: "rgba(181, 125, 0, 0.10)", color: "#8b6500", border: "rgba(181, 125, 0, 0.22)" };
    case "done":
      return { background: "rgba(86, 94, 110, 0.10)", color: "#495365", border: "rgba(86, 94, 110, 0.18)" };
    case "inbox":
      return { background: "rgba(88, 102, 126, 0.08)", color: "#465064", border: "rgba(88, 102, 126, 0.16)" };
    default:
      return { background: "rgba(46, 92, 180, 0.10)", color: "#204f9b", border: "rgba(46, 92, 180, 0.18)" };
  }
}

function priorityTone(priority: string): { background: string; color: string; border: string } {
  switch (priority) {
    case "high":
    case "critical":
      return { background: "rgba(245,100,84,0.10)", color: "#a33a2f", border: "rgba(245,100,84,0.22)" };
    case "medium":
      return { background: "rgba(142,106,53,0.10)", color: "#7a592b", border: "rgba(142,106,53,0.22)" };
    default:
      return { background: "rgba(78,124,116,0.10)", color: "#2f655b", border: "rgba(78,124,116,0.22)" };
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
        background: selected ? "rgba(15, 25, 36, 0.05)" : "var(--hc-card-bg)",
        border: `1px solid ${selected ? "var(--hc-accent)" : "var(--hc-border)"}`,
        boxShadow: selected ? "0 16px 32px rgba(15, 25, 36, 0.10)" : "none",
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
                      background: selected ? "rgba(15, 25, 36, 0.04)" : "transparent",
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
          <div className="rounded-2xl p-3" style={{ background: "rgba(46, 92, 180, 0.08)", border: "1px solid rgba(46, 92, 180, 0.18)" }}>
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

  useEffect(() => {
    try {
      const rawInputs = window.localStorage.getItem(STORAGE_INPUTS_KEY);
      if (rawInputs) {
        const parsed = JSON.parse(rawInputs) as Record<string, unknown>;
        if (typeof parsed.ownerId === "string") setOwnerId(parsed.ownerId);
        if (typeof parsed.feedMarkdown === "string") setFeedMarkdown(parsed.feedMarkdown);
        if (typeof parsed.seedPlansJson === "string") setSeedPlansJson(parsed.seedPlansJson);
      }

      const rawContext = window.localStorage.getItem(STORAGE_CONTEXT_KEY);
      if (rawContext) {
        const parsedContext = JSON.parse(rawContext) as unknown;
        if (isRecord(parsedContext)) setPlanningContext(parsedContext);
      }
      setRestored(true);
    } catch {
      setRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!restored) return;
    window.localStorage.setItem(
      STORAGE_INPUTS_KEY,
      JSON.stringify({
        ownerId,
        feedMarkdown,
        seedPlansJson,
      }),
    );
  }, [ownerId, feedMarkdown, seedPlansJson, restored]);

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

      const res = await engineFetch<{ planning_context?: unknown }>("/planning/company", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!isRecord(res.planning_context)) {
        throw new Error("Planner response did not include a planning_context object.");
      }

      setPlanningContext(res.planning_context);
      setActiveTab("overview");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function clearSavedPlanner() {
    setPlanningContext(null);
    setOwnerId("");
    setFeedMarkdown("");
    setSeedPlansJson("");
    setSearchQuery("");
    setStatusFilter("all");
    setSelectedPlanId("");
    setError("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_INPUTS_KEY);
      window.localStorage.removeItem(STORAGE_CONTEXT_KEY);
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
              "radial-gradient(circle at top left, rgba(142,106,53,0.18), transparent 34%), radial-gradient(circle at top right, rgba(78,124,116,0.18), transparent 28%), linear-gradient(135deg, rgba(15,25,36,0.06), rgba(15,25,36,0.0))",
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
            {restored && (feedMarkdown.trim() || seedPlansJson.trim() || planningContext) ? <span>Saved locally in this browser</span> : null}
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
          <div className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ background: "rgba(181, 125, 0, 0.10)", border: "1px solid rgba(181, 125, 0, 0.22)", color: "#8b6500" }}>
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
