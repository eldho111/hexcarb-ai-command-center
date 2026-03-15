import type { NextRequest } from "next/server";

import type {
  CompanyDashboardSnapshot,
  DashboardAlert,
  DashboardListItem,
  DashboardModuleState,
  DashboardTone,
} from "@/lib/dashboard";
import { engineFetchJson } from "@/lib/server/engineGateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

type EndpointResult<T = unknown> = {
  ok: boolean;
  data: T | null;
  error: string | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null;
}

function asRecordArray(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0);
}

function asTone(value: unknown, fallback: DashboardTone = "info"): DashboardTone {
  const tone = asString(value, fallback);
  return ["info", "success", "warning", "critical"].includes(tone) ? (tone as DashboardTone) : fallback;
}

function normalizeCompanyStatus(value: unknown): CompanyDashboardSnapshot["company_status"] {
  const record = asRecord(value);
  if (!record) return null;

  const rawLanes = asRecord(record.lanes) ?? {};
  const lanes = Object.fromEntries(
    Object.entries(rawLanes).map(([lane, payload]) => {
      const laneRecord = asRecord(payload) ?? {};
      return [
        lane,
        {
          tone: asTone(laneRecord.tone),
          headline: asString(laneRecord.headline),
          item_count: asNumber(laneRecord.item_count),
          top_items: asStringArray(laneRecord.top_items),
        },
      ];
    }),
  );

  const topBets = asRecordArray(record.top_bets).map((item) => ({
    title: asString(item.title, "Strategic bet"),
    tone: asTone(item.tone),
    headline: asString(item.headline),
    item_count: asNumber(item.item_count),
    item_ids: asStringArray(item.item_ids),
    top_items: asStringArray(item.top_items),
    lifecycles: asStringArray(item.lifecycles),
  }));

  return {
    phase: asString(record.phase, "operating_execution"),
    summary: asString(record.summary),
    operating_mode: asString(record.operating_mode),
    mapping_mode: asString(record.mapping_mode, "default_heuristic"),
    override_count: asNumber(record.override_count),
    lanes,
    top_bets: topBets,
    top_risks: asStringArray(record.top_risks),
    top_catalysts: asStringArray(record.top_catalysts),
    strategic_bets: asStringArray(record.strategic_bets),
    as_of: asString(record.as_of),
  };
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function daysUntil(value: unknown): number | null {
  const date = parseDate(value);
  if (!date) return null;
  const deltaMs = date.getTime() - Date.now();
  return Math.floor(deltaMs / 86400000);
}

function severityFromStatus(status: string): DashboardTone {
  const normalized = status.trim().toLowerCase();
  if (["done", "ok", "approved", "healthy", "active"].includes(normalized)) return "success";
  if (["blocked", "critical", "overdue", "down", "failed", "rejected"].includes(normalized)) return "critical";
  if (["planned", "pending", "review", "warning", "unread", "open"].includes(normalized)) return "warning";
  return "info";
}

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function byCreatedDesc(a: JsonRecord, b: JsonRecord): number {
  const aDate = parseDate(a.updated_at ?? a.created_at ?? a.published_at)?.getTime() ?? 0;
  const bDate = parseDate(b.updated_at ?? b.created_at ?? b.published_at)?.getTime() ?? 0;
  return bDate - aDate;
}

function takeLatest(items: JsonRecord[], limit: number): JsonRecord[] {
  return [...items].sort(byCreatedDesc).slice(0, limit);
}

function makeItem(input: {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  status?: string;
  href?: string;
  tone?: DashboardTone;
}): DashboardListItem {
  return {
    id: input.id,
    title: input.title,
    subtitle: input.subtitle,
    meta: input.meta,
    status: input.status,
    href: input.href,
    tone: input.tone ?? (input.status ? severityFromStatus(input.status) : "info"),
  };
}

function fallbackId(prefix: string, values: unknown[]): string {
  const basis = values
    .map((value) => asString(value))
    .filter(Boolean)
    .join("|");

  if (!basis) return `${prefix}-unknown`;

  let hash = 0;
  for (let index = 0; index < basis.length; index += 1) {
    hash = (hash * 31 + basis.charCodeAt(index)) >>> 0;
  }
  return `${prefix}-${hash.toString(16)}`;
}

function taskItem(task: JsonRecord, href = "/panel/weekly_plan"): DashboardListItem {
  const due = formatDate(task.due_date);
  const owner = asString(task.owner_id || task.assigned_to, "Unassigned");
  return makeItem({
    id: asString(
      task.task_id || task.object_id || task.title,
      fallbackId("task", [task.title, task.description, task.owner_id, task.due_date]),
    ),
    title: asString(task.description || task.title || task.task_id, "Untitled task"),
    subtitle: `${owner} • ${due}`,
    meta: [asString(task.priority, "medium"), asString(task.related_goal_id)].filter(Boolean).join(" • "),
    status: asString(task.status, "open"),
    href,
  });
}

function planningItem(item: JsonRecord, href = "/panel/projects"): DashboardListItem {
  return makeItem({
    id: asString(item.plan_id, asString(item.title, "plan")),
    title: asString(item.title, "Untitled project"),
    subtitle: [asString(item.kind), asString(item.horizon)].filter(Boolean).join(" • "),
    meta: [asString(item.priority), asString(item.origin)].filter(Boolean).join(" • "),
    status: asString(item.status, "planned"),
    href,
  });
}

function approvalItem(item: JsonRecord): DashboardListItem {
  return makeItem({
    id: asString(item.approval_id || item.action, "approval"),
    title: asString(item.action || item.title || item.approval_id, "Approval request"),
    subtitle: [asString(item.requested_by), formatDate(item.created_at)].filter(Boolean).join(" • "),
    meta: asString(item.reason),
    status: asString(item.status, "pending"),
    href: "/panel/approvals",
  });
}

function complianceItem(item: JsonRecord): DashboardListItem {
  const due = daysUntil(item.due_date);
  const dueMeta = due === null ? "No due date" : due < 0 ? `${Math.abs(due)}d overdue` : `${due}d remaining`;
  return makeItem({
    id: asString(item.task_id, asString(item.title, "compliance")),
    title: asString(item.title, "Compliance task"),
    subtitle: [asString(item.category), formatDate(item.due_date)].filter(Boolean).join(" • "),
    meta: dueMeta,
    status: asString(item.status, "pending"),
    href: "/panel/compliance",
  });
}

function notificationItem(item: JsonRecord): DashboardListItem {
  return makeItem({
    id: asString(item.notification_id, asString(item.title, "notification")),
    title: asString(item.title, "Notification"),
    subtitle: [asString(item.category), formatDate(item.created_at)].filter(Boolean).join(" • "),
    meta: asString(item.body),
    status: asString(item.status, "unread"),
    href: "/panel/notifications",
  });
}

function feedItem(item: JsonRecord, href: string, fallbackTitle: string): DashboardListItem {
  return makeItem({
    id: asString(item.id || item.object_id || item.message_id || item.narrative_id || item.decision_id, fallbackTitle),
    title: asString(item.title || item.name || item.decision || item.body || item.summary, fallbackTitle),
    subtitle: [asString(item.source_name || item.from_user || item.scope), formatDate(item.published_at || item.created_at)].filter(Boolean).join(" • "),
    meta: asString(item.summary || item.body || item.category || item.period),
    status: asString(item.status, "active"),
    href,
  });
}

function moduleState(results: EndpointResult[]): DashboardModuleState {
  const errors = results.map((result) => result.error).filter((value): value is string => Boolean(value));
  const successCount = results.filter((result) => result.ok).length;
  return {
    ok: errors.length === 0,
    endpoint_count: results.length,
    success_count: successCount,
    error: errors[0] ?? null,
  };
}

async function safeEngine<T = unknown>(
  req: NextRequest,
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    searchParams?: Record<string, string | number | boolean | null | undefined>;
  },
): Promise<EndpointResult<T>> {
  try {
    const data = await engineFetchJson<T>(path, {
      req,
      method: options?.method,
      body: options?.body,
      searchParams: options?.searchParams,
    });
    return { ok: true, data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, data: null, error: message };
  }
}

export async function GET(req: NextRequest) {
  const [
    healthRes,
    statusRes,
    stateRes,
    modelsRegistryRes,
    domainsRes,
    executionHealthRes,
    weeklyPlanRes,
    riskRes,
    goalsRes,
    tasksRes,
    planningRes,
    complianceRes,
    approvalsRes,
    notificationsRes,
    qualityRes,
    leadStatusRes,
    fundingRes,
    newsRes,
    salesRes,
    financeRes,
    experimentsRes,
    draftsRes,
    measurementsRes,
    trainingStatusRes,
    trainingReadinessRes,
    sourcesRes,
    decisionsRes,
    narrativesRes,
    messagesRes,
  ] = await Promise.all([
    safeEngine(req, "/health"),
    safeEngine(req, "/status"),
    safeEngine(req, "/state"),
    safeEngine(req, "/models/registry"),
    safeEngine(req, "/domains"),
    safeEngine(req, "/execution/health", { method: "POST", body: { period: "weekly" } }),
    safeEngine(req, "/execution/plan/weekly", { method: "POST", body: { scope: "company" } }),
    safeEngine(req, "/execution/risks", { method: "POST", body: { scope: "company" } }),
    safeEngine(req, "/execution/goals"),
    safeEngine(req, "/execution/tasks"),
    safeEngine(req, "/planning/company", { method: "POST", body: {} }),
    safeEngine(req, "/compliance/tasks"),
    safeEngine(req, "/actions/approvals", { searchParams: { status: "pending" } }),
    safeEngine(req, "/notifications/list", { searchParams: { limit: 12 } }),
    safeEngine(req, "/quality/summary"),
    safeEngine(req, "/lead_intel/status"),
    safeEngine(req, "/funding/list"),
    safeEngine(req, "/news/list"),
    safeEngine(req, "/domains/sales/items"),
    safeEngine(req, "/domains/finance/items"),
    safeEngine(req, "/experiments/list"),
    safeEngine(req, "/experiments/drafts"),
    safeEngine(req, "/measurements"),
    safeEngine(req, "/training/status"),
    safeEngine(req, "/training/readiness"),
    safeEngine(req, "/sources"),
    safeEngine(req, "/decisions"),
    safeEngine(req, "/narratives"),
    safeEngine(req, "/messages/inbox", { searchParams: { limit: 12 } }),
  ]);

  const planningResponse = asRecord(planningRes.data);
  const planningContext = asRecord(planningResponse?.planning_context);
  const planningNextRes = planningContext
    ? await safeEngine(req, "/planning/next", {
        method: "POST",
        body: { planning_context: planningContext, limit: 10 },
      })
    : ({ ok: true, data: { next_generated_plans: [] }, error: null } satisfies EndpointResult);

  const health = asRecord(healthRes.data) ?? {};
  const status = asRecord(statusRes.data) ?? {};
  const state = asRecord(asRecord(stateRes.data)?.state) ?? {};
  const executionHealth = asRecord(executionHealthRes.data) ?? {};
  const weeklyPlan = asRecord(weeklyPlanRes.data) ?? {};
  const riskPayload = asRecord(riskRes.data) ?? {};
  const trainingStatus = asRecord(trainingStatusRes.data) ?? {};
  const trainingReadiness = asRecord(asRecord(trainingReadinessRes.data)?.readiness) ?? {};
  const quality = asRecord(qualityRes.data) ?? {};
  const leadStatus = asRecord(leadStatusRes.data) ?? {};

  const goals = asRecordArray(asRecord(goalsRes.data)?.goals);
  const tasks = asRecordArray(asRecord(tasksRes.data)?.tasks);
  const weeklyTasks = asRecordArray(weeklyPlan.tasks);
  const risks = asRecordArray(riskPayload.risks);
  const complianceTasks = asRecordArray(asRecord(complianceRes.data)?.tasks);
  const approvals = asRecordArray(asRecord(approvalsRes.data)?.approvals);
  const notifications = asRecordArray(asRecord(notificationsRes.data)?.items);
  const fundingItems = asRecordArray(asRecord(fundingRes.data)?.items);
  const newsItems = asRecordArray(asRecord(newsRes.data)?.items);
  const salesItems = asRecordArray(asRecord(salesRes.data)?.items);
  const financeItems = asRecordArray(asRecord(financeRes.data)?.items);
  const experiments = asRecordArray(asRecord(experimentsRes.data)?.experiments);
  const drafts = asRecordArray(asRecord(draftsRes.data)?.drafts);
  const measurements = asRecordArray(asRecord(measurementsRes.data)?.measurements);
  const sources = asRecordArray(asRecord(sourcesRes.data)?.sources);
  const decisions = asRecordArray(asRecord(decisionsRes.data)?.decisions);
  const narratives = asRecordArray(asRecord(narrativesRes.data)?.narratives);
  const messages = asRecordArray(asRecord(messagesRes.data)?.items);

  const plannerStats = asRecord(planningContext?.planner_stats) ?? {};
  const companyStatus = normalizeCompanyStatus(planningContext?.company_status);
  const plannerItems = asRecordArray(planningContext?.planner_items);
  const plannerLookup = new Map(plannerItems.map((item) => [asString(item.plan_id), item]));
  const nextGeneratedPayload = asRecord(planningNextRes.data);
  const nextPlans = asRecordArray(nextGeneratedPayload?.next_generated_plans ?? planningContext?.next_generated_plans);
  const blockedPlans = plannerItems.filter((item) => asString(item.status) === "blocked");
  const focusIds = asStringArray(planningContext?.focus_now);
  const focusNow = dedupeStrings(
    focusIds
      .map((planId) => asString(plannerLookup.get(planId)?.title))
      .filter((item) => item.length > 0),
  ).slice(0, 6);

  const overdueTaskIds = asStringArray(executionHealth.overdue_tasks);
  const stalledTaskIds = asStringArray(executionHealth.stalled_tasks);
  const taskLookup = new Map(tasks.map((task) => [asString(task.task_id), task]));

  const complianceDue = [...complianceTasks]
    .filter((task) => {
      const statusText = asString(task.status).toLowerCase();
      if (["done", "closed", "resolved"].includes(statusText)) return false;
      const days = daysUntil(task.due_date);
      return days !== null && days <= 30;
    })
    .sort((a, b) => {
      const aDays = daysUntil(a.due_date) ?? 9999;
      const bDays = daysUntil(b.due_date) ?? 9999;
      return aDays - bDays;
    })
    .slice(0, 5)
    .map(complianceItem);

  const unreadNotifications = notifications.filter((item) => asString(item.status, "unread") !== "read");
  const recentNotifications = takeLatest(notifications, 5).map(notificationItem);
  const recentMessages = takeLatest(messages, 5).map((item) =>
    makeItem({
      id: asString(item.message_id, "message"),
      title: `${asString(item.from_user, "Unknown")} -> ${asString(item.to_user, "all")}`,
      subtitle: formatDate(item.created_at),
      meta: asString(item.body),
      status: asString((Array.isArray(item.read_by) && item.read_by.length > 0) ? "read" : "unread", "unread"),
      href: "/panel/messages",
    }),
  );

  const projectCount = asNumber(plannerStats.seed_items) || plannerItems.filter((item) => asString(item.origin) !== "generated").length;
  const activeProjects = plannerItems.filter(
    (item) => asString(item.origin) !== "generated" && !["done", "archived"].includes(asString(item.status).toLowerCase()),
  ).length || projectCount;

  const engineStatus = !healthRes.ok && !statusRes.ok
    ? "down"
    : (!healthRes.ok || !statusRes.ok || !asBoolean(health.ollama_reachable, true) || !asBoolean(health.embedding_model_present, true))
      ? "degraded"
      : "ok";

  const recentFailures = asRecordArray(asRecord(state.capability_state)?.last_failures)
    .slice(-4)
    .reverse()
    .map((failure, index) =>
      makeItem({
        id: asString(failure.ts, `failure-${index}`),
        title: asString(failure.action, "Engine anomaly"),
        subtitle: formatDate(failure.ts),
        meta: asString(asRecord(failure.error)?.message, "No details"),
        status: "critical",
        href: "/panel/system_state",
      }),
    );

  const toolsHealth = asRecordArray(asRecord(state.capability_state)?.tools_health).map((tool, index) =>
    makeItem({
      id: asString(tool.name, `tool-${index}`),
      title: asString(tool.name || tool.title, "Tool health"),
      subtitle: asString(tool.detail),
      status: asString(tool.status, "unknown"),
      href: "/panel/system_state",
    }),
  );

  const engineErrors = [healthRes, statusRes, stateRes, modelsRegistryRes, domainsRes]
    .map((result) => result.error)
    .filter((value): value is string => Boolean(value));

  const modules: CompanyDashboardSnapshot["modules"] = {
    engine: moduleState([healthRes, statusRes, stateRes, modelsRegistryRes, domainsRes]),
    execution: moduleState([executionHealthRes, weeklyPlanRes, riskRes, goalsRes, tasksRes]),
    projects: moduleState([planningRes, planningNextRes]),
    operations: moduleState([complianceRes, approvalsRes, notificationsRes, qualityRes]),
    growth: moduleState([leadStatusRes, fundingRes, newsRes, salesRes, financeRes]),
    rnd: moduleState([experimentsRes, draftsRes, measurementsRes, trainingStatusRes, trainingReadinessRes, sourcesRes]),
    activity: moduleState([decisionsRes, narrativesRes, messagesRes]),
  };

  const alerts: DashboardAlert[] = [];
  if (engineStatus !== "ok") {
    alerts.push({
      id: "engine-status",
      title: "Engine attention required",
      detail: engineErrors[0] ?? "One or more engine dependencies are degraded.",
      severity: "critical",
      href: "/panel/system_status",
    });
  }
  if (overdueTaskIds.length > 0) {
    alerts.push({
      id: "overdue-tasks",
      title: `${overdueTaskIds.length} overdue execution tasks`,
      detail: "Weekly execution needs attention.",
      severity: "warning",
      href: "/panel/weekly_plan",
    });
  }
  if (blockedPlans.length > 0) {
    alerts.push({
      id: "blocked-projects",
      title: `${blockedPlans.length} blocked project items`,
      detail: "Projects workspace contains blocked work that needs intervention.",
      severity: "warning",
      href: "/panel/projects",
    });
  }
  if (approvals.length > 0) {
    alerts.push({
      id: "pending-approvals",
      title: `${approvals.length} pending approvals`,
      detail: "Queued actions are waiting for review.",
      severity: "warning",
      href: "/panel/approvals",
    });
  }
  if (complianceDue.length > 0) {
    alerts.push({
      id: "compliance-due",
      title: `${complianceDue.length} compliance items due soon`,
      detail: "Upcoming compliance deadlines are approaching.",
      severity: "warning",
      href: "/panel/compliance",
    });
  }

  const snapshot: CompanyDashboardSnapshot = {
    ok: true,
    generated_at: new Date().toISOString(),
    company_name: "HexCarb AI Engine",
    modules,
    hero: {
      company_name: "HexCarb",
      subtitle: asString(asRecord(state.objectives)?.summary, "Founder cockpit for company operations, execution, R&D, and engine health."),
      engine_status: engineStatus,
      module_errors: Object.values(modules).filter((module) => !module.ok).length,
    },
    company_status: companyStatus,
    kpis: {
      active_projects: activeProjects,
      overdue_tasks: overdueTaskIds.length,
      stalled_tasks: stalledTaskIds.length,
      approvals_pending: approvals.length,
      compliance_due_soon: complianceDue.length,
      funding_opportunities: fundingItems.length,
      unread_notifications: unreadNotifications.length,
      indexed_chunks: asNumber(health.active_collection_count),
    },
    alerts: alerts.slice(0, 6),
    today: {
      focus_now: focusNow,
      next_plans: nextPlans.slice(0, 5).map((item) => planningItem(item)),
      blocked_items: blockedPlans.slice(0, 5).map((item) => planningItem(item)),
      risk_items: risks.slice(0, 5).map((risk) => {
        const task = taskLookup.get(asString(risk.task_id));
        return makeItem({
          id: asString(risk.task_id, "risk"),
          title: task ? asString(task.description || task.title, asString(risk.task_id, "Execution risk")) : `Risk: ${asString(risk.task_id, "unknown")}`,
          subtitle: task ? formatDate(task.due_date) : "Execution risk",
          meta: `${asNumber(risk.days_overdue)}d overdue`,
          status: "overdue",
          href: "/panel/weekly_plan",
        });
      }),
    },
    execution: {
      weekly_tasks: weeklyTasks.slice(0, 5).map((task) => taskItem(task)),
      goals_count: goals.length,
      tasks_count: tasks.length,
      project_count: projectCount,
      overdue_count: overdueTaskIds.length,
      stalled_count: stalledTaskIds.length,
    },
    operations: {
      compliance_due: complianceDue,
      approvals: approvals.slice(0, 5).map(approvalItem),
      notifications: recentNotifications,
      quality: {
        open_deviations: asNumber(quality.open_deviations),
        overdue_actions: asNumber(quality.overdue_actions),
        total_items: asNumber(quality.total_items),
        counts_by_status: isRecord(quality.counts_by_status)
          ? Object.fromEntries(Object.entries(quality.counts_by_status).map(([key, value]) => [key, asNumber(value)]))
          : {},
      },
    },
    growth: {
      lead_status: {
        available: asBoolean(leadStatus.available),
        row_count: asNumber(leadStatus.row_count),
        focus: asString(leadStatus.focus, "swcnt"),
        exported_at: asString(leadStatus.exported_at) || null,
        warning: asString(leadStatus.warning) || null,
      },
      funding_count: fundingItems.length,
      latest_funding: takeLatest(fundingItems, 4).map((item) => feedItem(item, "/panel/funding", "Funding opportunity")),
      news_count: newsItems.length,
      latest_news: takeLatest(newsItems, 4).map((item) => feedItem(item, "/panel/news", "News item")),
      sales_count: salesItems.length,
      finance_count: financeItems.length,
    },
    rnd: {
      experiments_count: experiments.length,
      draft_count: drafts.length,
      measurement_count: measurements.length,
      training_ready: asBoolean(trainingReadiness.ready),
      training_state: asString(trainingStatus.state, "idle"),
      indexed_chunks: asNumber(health.active_collection_count),
      source_count: sources.length,
    },
    engine: {
      gpu_available: asBoolean(health.gpu_available),
      compute_mode: asString(health.compute_mode, "unknown"),
      ollama_reachable: asBoolean(health.ollama_reachable),
      embedding_model_present: asBoolean(health.embedding_model_present),
      available_ram_gb: isRecord(status.memory) ? asNumber(status.memory.available_gb, NaN) : NaN,
      memory_used_percent: isRecord(status.memory) ? asNumber(status.memory.used_percent, NaN) : NaN,
      recent_failures: recentFailures,
      tools_health: toolsHealth,
      module_errors: engineErrors,
    },
    activity: {
      decisions: takeLatest(decisions, 4).map((item) => feedItem(item, "/panel/decisions", "Decision")),
      narratives: takeLatest(narratives, 4).map((item) => feedItem(item, "/panel/narratives", "Narrative")),
      messages: recentMessages,
      notifications: recentNotifications,
    },
  };

  if (!Number.isFinite(snapshot.engine.available_ram_gb ?? NaN)) {
    snapshot.engine.available_ram_gb = null;
  }
  if (!Number.isFinite(snapshot.engine.memory_used_percent ?? NaN)) {
    snapshot.engine.memory_used_percent = null;
  }

  return Response.json(snapshot, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
