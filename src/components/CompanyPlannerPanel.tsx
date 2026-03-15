"use client";

import { useEffect, useState } from "react";

import { engineFetch } from "@/lib/useEngine";

type JsonRecord = Record<string, unknown>;

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

const STORAGE_INPUTS_KEY = "hc-company-planner-inputs-v1";
const STORAGE_CONTEXT_KEY = "hc-company-planner-context-v1";
const PLANNER_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

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

function parsePlannerFeedPreview(feedMarkdown: string): PreviewRow[] {
  const rows: PreviewRow[] = [];
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

function parseSeedPlanPreview(seedProjectsJson: string): { items: PreviewRow[]; error: string | null } {
  if (!seedProjectsJson.trim()) return { items: [], error: null };
  try {
    const parsed = JSON.parse(seedProjectsJson) as unknown;
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

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
      <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--hc-text-muted)" }}>
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold" style={{ color: "var(--hc-heading)" }}>
        {value}
      </div>
    </div>
  );
}

function PlannerCard({ item, compact = false }: { item: JsonRecord; compact?: boolean }) {
  const title = asString(item.title, "Untitled plan");
  const status = asString(item.status, "planned");
  const tone = statusTone(status);
  const kind = asString(item.kind, "plan");
  const priority = asString(item.priority, "medium");
  const horizon = asString(item.horizon, "this_week");
  const ownerId = asString(item.owner_id);
  const summary = asString(item.summary);
  const nextActions = asStringArray(item.next_actions);
  const goalIds = asStringArray(item.goal_ids);
  const taskIds = asStringArray(item.task_ids);
  const sourceUrl = asString(item.source_url);
  const confidence = isRecord(item.automation) ? item.automation.confidence : null;

  return (
    <article className="rounded-2xl p-4" style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)" }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
            {title}
          </h3>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border px-2 py-0.5 font-medium" style={{ background: tone.background, color: tone.color, borderColor: tone.border }}>
              {status}
            </span>
            <span className="rounded-full border px-2 py-0.5" style={{ borderColor: "var(--hc-border)", color: "var(--hc-text-muted)" }}>
              {kind}
            </span>
            <span className="rounded-full border px-2 py-0.5" style={{ borderColor: "var(--hc-border)", color: "var(--hc-text-muted)" }}>
              {priority}
            </span>
            <span className="rounded-full border px-2 py-0.5" style={{ borderColor: "var(--hc-border)", color: "var(--hc-text-muted)" }}>
              {horizon}
            </span>
          </div>
        </div>
        {ownerId ? (
          <span className="text-[11px] font-medium" style={{ color: "var(--hc-text-muted)" }}>
            owner: {ownerId}
          </span>
        ) : null}
      </div>

      {summary ? (
        <p className="mt-3 text-sm leading-6" style={{ color: "var(--hc-text)" }}>
          {summary}
        </p>
      ) : null}

      {!compact && nextActions.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {nextActions.slice(0, 3).map((action) => (
            <div key={action} className="text-sm" style={{ color: "var(--hc-text)" }}>
              - {action}
            </div>
          ))}
        </div>
      ) : null}

      {!compact && (goalIds.length > 0 || taskIds.length > 0 || sourceUrl || typeof confidence === "number") ? (
        <div className="mt-3 flex flex-wrap gap-3 text-[11px]" style={{ color: "var(--hc-text-muted)" }}>
          {goalIds.length > 0 ? <span>Goals: {goalIds.slice(0, 3).join(", ")}</span> : null}
          {taskIds.length > 0 ? <span>Tasks: {taskIds.slice(0, 3).join(", ")}</span> : null}
          {typeof confidence === "number" ? <span>Automation confidence: {confidence}</span> : null}
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--hc-accent)" }}>
              Source page
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function PlannerDatabaseTable({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: JsonRecord[];
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
        <div className="px-5 py-4 text-sm" style={{ color: "var(--hc-text-muted)" }}>
          No planner rows yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead style={{ background: "var(--hc-bg-soft)", color: "var(--hc-text-muted)" }}>
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Horizon</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Links</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const title = asString(item.title, "Untitled plan");
                const status = asString(item.status, "planned");
                const tone = statusTone(status);
                const sourceUrl = asString(item.source_url);
                const goalIds = asStringArray(item.goal_ids);
                const taskIds = asStringArray(item.task_ids);
                return (
                  <tr key={asString(item.plan_id, title)} style={{ borderTop: "1px solid var(--hc-border)" }}>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium" style={{ color: "var(--hc-heading)" }}>
                        {title}
                      </div>
                      <div className="mt-1 text-[11px]" style={{ color: "var(--hc-text-muted)" }}>
                        {asString(item.origin, "planner")}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ background: tone.background, color: tone.color, borderColor: tone.border }}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top" style={{ color: "var(--hc-text)" }}>
                      {asString(item.kind, "plan")}
                    </td>
                    <td className="px-4 py-3 align-top" style={{ color: "var(--hc-text)" }}>
                      {asString(item.priority, "medium")}
                    </td>
                    <td className="px-4 py-3 align-top" style={{ color: "var(--hc-text)" }}>
                      {asString(item.horizon, "this_week")}
                    </td>
                    <td className="px-4 py-3 align-top" style={{ color: "var(--hc-text)" }}>
                      {asString(item.owner_id, "unassigned")}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {sourceUrl ? (
                        <a href={sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--hc-accent)" }}>
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

export function CompanyPlannerPanel() {
  const [ownerId, setOwnerId] = useState("");
  const [feedMarkdown, setFeedMarkdown] = useState("");
  const [seedPlansJson, setSeedPlansJson] = useState("");
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
    setError("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_INPUTS_KEY);
      window.localStorage.removeItem(STORAGE_CONTEXT_KEY);
    }
  }

  const feedPreviewItems = parsePlannerFeedPreview(feedMarkdown);
  const seedPreview = parseSeedPlanPreview(seedPlansJson);
  const enteredRows: JsonRecord[] = [...feedPreviewItems, ...seedPreview.items];

  const plannerStats = isRecord(planningContext?.planner_stats) ? planningContext.planner_stats : {};
  const plannerItems = asRecordArray(planningContext?.planner_items);
  const nextPlans = asRecordArray(planningContext?.next_generated_plans);
  const board = isRecord(planningContext?.planner_board) ? planningContext.planner_board : {};
  const boardColumns = asRecordArray(board.columns);
  const relationships = asRecordArray(planningContext?.planner_relationships);
  const itemMap = new Map(plannerItems.map((item) => [asString(item.plan_id), item]));
  const focusNow = asStringArray(planningContext?.focus_now);
  const seedPlans = asRecordArray(planningContext?.seed_plans);

  return (
    <div className="space-y-6">
      <section className="hc-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--hc-heading)" }}>
              Hexcarb - Master Project Dashboard
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6" style={{ color: "var(--hc-text-muted)" }}>
              Use this like your Notion master dashboard: paste project links, preview the rows you entered, then generate the connected Hexcarb project view.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="hc-btn hc-btn-ghost text-sm" onClick={clearSavedPlanner}>
              Clear Saved Planner
            </button>
            <button type="button" className="hc-btn hc-btn-primary text-sm" onClick={generatePlanner} disabled={loading}>
              {loading ? "Generating..." : "Refresh Dashboard"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--hc-text-muted)" }}>
              Project Feed
            </label>
            <textarea
              className="min-h-[220px] w-full rounded-2xl px-3 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
              style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}
              placeholder="Paste Notion markdown links or freeform operating notes here."
              value={feedMarkdown}
              onChange={(e) => setFeedMarkdown(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--hc-text-muted)" }}>
                Owner Filter
              </label>
              <input
                className="w-full rounded-2xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
                style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}
                placeholder="Optional user_id"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--hc-text-muted)" }}>
                Seed Plans JSON
              </label>
              <textarea
                className="min-h-[170px] w-full rounded-2xl px-3 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
                style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}
                placeholder={'[{"title":"Thermal Battery Outreach","goal_ids":["GOAL_0001"]}]'}
                value={seedPlansJson}
                onChange={(e) => setSeedPlansJson(e.target.value)}
              />
            </div>
          </div>
        </div>

        {restored && !error && (feedMarkdown.trim() || seedPlansJson.trim() || planningContext) ? (
          <div className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ background: "rgba(46, 92, 180, 0.08)", border: "1px solid rgba(46, 92, 180, 0.18)", color: "var(--hc-text)" }}>
            Planner inputs and the latest generated planner context are saved locally in this browser.
          </div>
        ) : null}

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

      {enteredRows.length > 0 || seedPlans.length > 0 ? (
        <PlannerDatabaseTable
          title="Project Intake"
          subtitle="These are the project rows derived directly from what you entered, before or after dashboard generation."
          items={seedPlans.length > 0 ? seedPlans : enteredRows}
        />
      ) : null}

      {planningContext ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Projects" value={asNumber(plannerStats.total_items)} />
            <MetricCard label="Autogenerated" value={asNumber(plannerStats.generated_items)} />
            <MetricCard label="Imported" value={asNumber(plannerStats.feed_items)} />
            <MetricCard label="Queued" value={asNumber(plannerStats.next_plans)} />
            <MetricCard label="Blocked" value={asNumber(plannerStats.blocked_plans)} />
            <MetricCard label="Links" value={relationships.length} />
          </section>

          {focusNow.length > 0 ? (
            <section className="hc-card p-5">
              <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                Current Focus
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {focusNow.map((planId) => (
                  <span key={planId} className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: "var(--hc-border)", color: "var(--hc-text-muted)", background: "var(--hc-bg-soft)" }}>
                    {planId}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <PlannerDatabaseTable
            title="Master Project Database"
            subtitle="A database-style view of all master project rows returned by the engine, including generated follow-on work."
            items={plannerItems}
          />

          <section className="hc-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                Project Board
              </h3>
              <span className="text-xs" style={{ color: "var(--hc-text-muted)" }}>
                grouped by status
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {boardColumns
                .filter((column) => asStringArray(column.item_ids).length > 0)
                .map((column) => {
                  const itemIds = asStringArray(column.item_ids);
                  return (
                    <div key={asString(column.id, asString(column.title))} className="rounded-3xl p-4" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                          {asString(column.title, "Column")}
                        </h4>
                        <span className="text-[11px]" style={{ color: "var(--hc-text-muted)" }}>
                          {itemIds.length}
                        </span>
                      </div>
                      <div className="mt-3 space-y-3">
                        {itemIds.slice(0, 5).map((planId) => {
                          const item = itemMap.get(planId);
                          if (!item) return null;
                          return <PlannerCard key={planId} item={item} compact />;
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>

          <section className="hc-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                Suggested Next Moves
              </h3>
              <span className="text-xs" style={{ color: "var(--hc-text-muted)" }}>
                {nextPlans.length} queued
              </span>
            </div>
            {nextPlans.length === 0 ? (
              <p className="mt-3 text-sm" style={{ color: "var(--hc-text-muted)" }}>
                No generated next plans yet.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {nextPlans.slice(0, 6).map((item) => (
                  <PlannerCard key={asString(item.plan_id, asString(item.title))} item={item} />
                ))}
              </div>
            )}
          </section>

          <details className="hc-card p-5">
            <summary className="cursor-pointer text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
              Raw Planning Context
            </summary>
            <pre className="mt-4 overflow-x-auto rounded-2xl p-4 text-xs" style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}>
              {JSON.stringify(planningContext, null, 2)}
            </pre>
          </details>
        </>
      ) : (
        <section className="hc-card p-5">
          <p className="text-sm leading-6" style={{ color: "var(--hc-text-muted)" }}>
            Enter your project dashboard data and refresh the dashboard to populate the master database and board.
          </p>
        </section>
      )}
    </div>
  );
}
