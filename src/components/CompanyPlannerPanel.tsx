"use client";

import { useState } from "react";

import { engineFetch } from "@/lib/useEngine";

type JsonRecord = Record<string, unknown>;

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

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}
    >
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
    <article
      className="rounded-2xl p-4"
      style={{ background: "var(--hc-card-bg)", border: "1px solid var(--hc-border)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
            {title}
          </h3>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
            <span
              className="rounded-full border px-2 py-0.5 font-medium"
              style={{ background: tone.background, color: tone.color, borderColor: tone.border }}
            >
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

export function CompanyPlannerPanel() {
  const [ownerId, setOwnerId] = useState("");
  const [feedMarkdown, setFeedMarkdown] = useState("");
  const [seedPlansJson, setSeedPlansJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [planningContext, setPlanningContext] = useState<JsonRecord | null>(null);

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

  const plannerStats = isRecord(planningContext?.planner_stats) ? planningContext.planner_stats : {};
  const plannerItems = asRecordArray(planningContext?.planner_items);
  const nextPlans = asRecordArray(planningContext?.next_generated_plans);
  const board = isRecord(planningContext?.planner_board) ? planningContext.planner_board : {};
  const boardColumns = asRecordArray(board.columns);
  const relationships = asRecordArray(planningContext?.planner_relationships);
  const itemMap = new Map(plannerItems.map((item) => [asString(item.plan_id), item]));
  const focusNow = asStringArray(planningContext?.focus_now);

  return (
    <div className="space-y-6">
      <section className="hc-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--hc-heading)" }}>
              Notion-style Company Planner
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6" style={{ color: "var(--hc-text-muted)" }}>
              Paste your Notion links or operating notes and the planner will turn them into linked company plans,
              generated next steps, and a board grouped by status.
            </p>
          </div>
          <button type="button" className="hc-btn hc-btn-primary text-sm" onClick={generatePlanner} disabled={loading}>
            {loading ? "Generating..." : "Generate Company Planner"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--hc-text-muted)" }}>
              Planner Feed
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

        {error ? (
          <div
            className="mt-4 rounded-2xl px-4 py-3 text-sm"
            style={{ background: "rgba(245,100,84,0.08)", border: "1px solid var(--hc-active)", color: "var(--hc-active)" }}
          >
            {error}
          </div>
        ) : null}
      </section>

      {planningContext ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Plans" value={asNumber(plannerStats.total_items)} />
            <MetricCard label="Generated" value={asNumber(plannerStats.generated_items)} />
            <MetricCard label="Feed" value={asNumber(plannerStats.feed_items)} />
            <MetricCard label="Next" value={asNumber(plannerStats.next_plans)} />
            <MetricCard label="Blocked" value={asNumber(plannerStats.blocked_plans)} />
            <MetricCard label="Links" value={relationships.length} />
          </section>

          {focusNow.length > 0 ? (
            <section className="hc-card p-5">
              <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                Focus Now
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {focusNow.map((planId) => (
                  <span
                    key={planId}
                    className="rounded-full border px-3 py-1 text-xs"
                    style={{ borderColor: "var(--hc-border)", color: "var(--hc-text-muted)", background: "var(--hc-bg-soft)" }}
                  >
                    {planId}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="hc-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                Next Generated Plans
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

          <section className="hc-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
                Planner Board
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
                    <div
                      key={asString(column.id, asString(column.title))}
                      className="rounded-3xl p-4"
                      style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)" }}
                    >
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

          <details className="hc-card p-5">
            <summary className="cursor-pointer text-sm font-semibold" style={{ color: "var(--hc-heading)" }}>
              Raw Planning Context
            </summary>
            <pre
              className="mt-4 overflow-x-auto rounded-2xl p-4 text-xs"
              style={{ background: "var(--hc-bg-soft)", border: "1px solid var(--hc-border)", color: "var(--hc-text)" }}
            >
              {JSON.stringify(planningContext, null, 2)}
            </pre>
          </details>
        </>
      ) : (
        <section className="hc-card p-5">
          <p className="text-sm leading-6" style={{ color: "var(--hc-text-muted)" }}>
            Generate the planner to see linked feed pages, generated next plans, and a board of company work.
          </p>
        </section>
      )}
    </div>
  );
}
