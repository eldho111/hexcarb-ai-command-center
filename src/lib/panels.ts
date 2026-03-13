export type PanelSection =
  | "sources"
  | "chat"
  | "diagnostics"
  | "experiments"
  | "dataset_training"
  | "admin";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type QuickCallBody = JsonValue;

export type QuickCall = {
  id: string;
  label: string;
  method: HttpMethod;
  path: string;
  body?: QuickCallBody;
  hint?: string;
};

export type PanelDef = {
  id: string;
  label: string;
  description: string;
  section: PanelSection;
  quickCalls: QuickCall[];
};

export const SECTION_ORDER: PanelSection[] = [
  "sources",
  "chat",
  "diagnostics",
  "experiments",
  "dataset_training",
  "admin",
];

export const SECTION_LABELS: Record<PanelSection, string> = {
  sources: "Sources",
  chat: "Chat",
  diagnostics: "Diagnostics",
  experiments: "Experiments",
  dataset_training: "Dataset / Training",
  admin: "Admin",
};

function qc(
  id: string,
  label: string,
  method: HttpMethod,
  path: string,
  body?: QuickCallBody,
  hint?: string,
): QuickCall {
  return { id, label, method, path, body, hint };
}

function withCommonCalls(calls: QuickCall[]): QuickCall[] {
  return [
    qc("health", "Health", "GET", "/health"),
    qc("ready", "Ready", "GET", "/ready"),
    ...calls,
  ];
}

export const PANELS: PanelDef[] = [
  {
    id: "doc_ingest",
    label: "Ingest Sources",
    description: "Load and index new documents into the evidence store.",
    section: "sources",
    quickCalls: withCommonCalls([
      qc("sources", "List Sources", "GET", "/sources"),
      qc("memory_stats", "Memory Stats", "GET", "/memory/stats"),
      qc(
        "ingest_path",
        "Ingest Path",
        "POST",
        "/ingest_path",
        { path: "/workspace/hexcarb_runtime/docs" },
        "Edit the path to a folder available on the engine host.",
      ),
    ]),
  },
  {
    id: "chat",
    label: "Cited Chat",
    description: "Stream grounded answers with citations.",
    section: "chat",
    quickCalls: withCommonCalls([
      qc("models", "Models", "GET", "/models"),
      qc("chat", "Chat", "POST", "/chat", { message: "Hello from the console." }),
      qc(
        "chat_stream",
        "Chat Stream",
        "POST",
        "/chat_stream",
        { message: "Summarize the latest CNT experiment notes." },
      ),
    ]),
  },
  {
    id: "system_status",
    label: "System Status",
    description: "Runtime health, storage, and model inventory.",
    section: "diagnostics",
    quickCalls: withCommonCalls([
      qc("status", "Status", "GET", "/status"),
      qc("ops_overview", "Ops Overview", "GET", "/ops/overview"),
      qc("engine_health", "Engine Health", "GET", "/engine/health"),
      qc("storage", "Storage Overview", "GET", "/storage/overview"),
    ]),
  },
  {
    id: "telemetry",
    label: "Telemetry",
    description: "Operations events and streaming telemetry.",
    section: "diagnostics",
    quickCalls: withCommonCalls([
      qc("ops_events", "Ops Events", "GET", "/ops/events"),
      qc(
        "ops_stream",
        "Ops Stream (SSE)",
        "GET",
        "/ops/events/stream",
        undefined,
        "Streams server-sent events; cancel to stop.",
      ),
      qc("history", "History Summary", "GET", "/history/summary"),
    ]),
  },
  {
    id: "capabilities",
    label: "Capabilities",
    description: "Model registry, routing, and capability inventory.",
    section: "diagnostics",
    quickCalls: withCommonCalls([
      qc("models", "Models", "GET", "/models"),
      qc("registry", "Model Registry", "GET", "/models/registry"),
      qc("ops", "Ops Overview", "GET", "/ops/overview"),
    ]),
  },
  {
    id: "experiment_drafts",
    label: "Draft Queue",
    description: "Review and approve experiment drafts.",
    section: "experiments",
    quickCalls: withCommonCalls([
      qc("drafts", "List Drafts", "GET", "/experiments/drafts"),
      qc("canonical", "Canonical Experiments", "GET", "/experiments/canonical"),
      qc(
        "draft_from_answer",
        "Draft From Answer",
        "POST",
        "/experiments/draft_from_answer",
        { answer: "Draft an experiment using CNT dispersion data." },
      ),
    ]),
  },
  {
    id: "experiment_form",
    label: "Experiment Form",
    description: "Structured extraction for canonical experiment specs.",
    section: "experiments",
    quickCalls: withCommonCalls([
      qc("canonical", "Canonical Experiments", "GET", "/experiments/canonical"),
      qc(
        "extract",
        "Extract",
        "POST",
        "/experiments/extract",
        { text: "Describe an experiment with CNT catalyst ratios." },
      ),
      qc(
        "bulk_from_sources",
        "Bulk From Sources",
        "POST",
        "/experiments/bulk_from_sources",
        { source_ids: [] },
        "Provide source IDs to extract in bulk.",
      ),
    ]),
  },
  {
    id: "lab_items",
    label: "Lab Items",
    description: "Lab inventory and domain items for experiments.",
    section: "experiments",
    quickCalls: withCommonCalls([
      qc("domains", "Domains", "GET", "/domains"),
      qc("lab_items", "Lab Items", "GET", "/domains/lab/items"),
      qc(
        "lab_ingest",
        "Ingest Lab Items",
        "POST",
        "/domains/lab/ingest",
        { items: [] },
        "Send lab inventory items in the request body.",
      ),
    ]),
  },
  {
    id: "plot",
    label: "Graph Plotter",
    description: "Generate plots from structured experiment data.",
    section: "experiments",
    quickCalls: withCommonCalls([
      qc(
        "plot_run",
        "Plot (Agent)",
        "POST",
        "/agent/plot/run",
        { query: "Plot CNT yield vs temperature from canonical experiments." },
      ),
    ]),
  },
  {
    id: "scout",
    label: "Research Scout",
    description: "External and internal scouting workflows.",
    section: "experiments",
    quickCalls: withCommonCalls([
      qc("scout_list", "Scout List", "GET", "/scout/list"),
      qc("scout_daily", "Run Daily Scout", "POST", "/scout/run_daily", {}),
      qc(
        "scout_ingest",
        "Ingest Doc",
        "POST",
        "/scout/ingest",
        { url: "https://example.com/paper.pdf" },
        "Replace with a URL to ingest.",
      ),
    ]),
  },
  {
    id: "training",
    label: "Dataset & Training",
    description: "Model training, evaluations, and dataset exports.",
    section: "dataset_training",
    quickCalls: withCommonCalls([
      qc("training_evals", "Evals", "GET", "/training/evals"),
      qc("optimizations", "Optimizations", "GET", "/training/optimizations"),
      qc(
        "hf_export",
        "HF Export",
        "POST",
        "/training/datasets/hf_export",
        { dataset_id: "" },
        "Provide a dataset_id from the registry.",
      ),
    ]),
  },
  {
    id: "news",
    label: "News Board",
    description: "Monitor materials research news and alerts.",
    section: "dataset_training",
    quickCalls: withCommonCalls([
      qc("news_list", "News List", "GET", "/news/list"),
      qc("news_refresh", "Refresh", "POST", "/news/refresh", {}),
      qc(
        "news_item",
        "News Item",
        "GET",
        "/news/ITEM_ID",
        undefined,
        "Replace ITEM_ID with a real item id.",
      ),
    ]),
  },
  {
    id: "funding",
    label: "Funding",
    description: "Funding pipelines, decks, and updates.",
    section: "dataset_training",
    quickCalls: withCommonCalls([
      qc("funding_list", "Funding List", "GET", "/funding/list"),
      qc("funding_refresh", "Refresh", "POST", "/funding/refresh", {}),
      qc("funding_decks", "Decks", "GET", "/funding/decks"),
    ]),
  },
  {
    id: "system_state",
    label: "System Config",
    description: "Planning context and system state.",
    section: "diagnostics",
    quickCalls: withCommonCalls([
      qc("state", "State", "GET", "/state"),
      qc("context", "Planning Context", "GET", "/planning/context"),
      qc("constraints", "Planning Constraints", "GET", "/planning/constraints"),
    ]),
  },
  {
    id: "compliance",
    label: "Compliance",
    description: "Compliance workflows and task tracking.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("profile", "Profile", "GET", "/compliance/profile"),
      qc("tasks", "Tasks", "GET", "/compliance/tasks"),
      qc("seed", "Seed Tasks", "POST", "/compliance/tasks/seed", {}),
    ]),
  },
  {
    id: "approvals",
    label: "Approvals",
    description: "Review and approve queued actions.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("approvals", "Approvals", "GET", "/actions/approvals"),
      qc(
        "submit",
        "Submit Action",
        "POST",
        "/actions/submit",
        { action_type: "review", payload: {} },
      ),
      qc(
        "approve",
        "Approve",
        "POST",
        "/actions/approvals/APPROVAL_ID/approve",
        {},
        "Replace APPROVAL_ID.",
      ),
    ]),
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Create and manage notifications.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("list", "List", "GET", "/notifications/list"),
      qc(
        "create",
        "Create",
        "POST",
        "/notifications/create",
        { title: "Alert", message: "Experiment threshold exceeded." },
      ),
      qc(
        "update",
        "Update",
        "POST",
        "/notifications/NOTIFICATION_ID/update",
        { status: "read" },
        "Replace NOTIFICATION_ID.",
      ),
    ]),
  },
  {
    id: "messages",
    label: "Messages",
    description: "Send and review internal messages.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("inbox", "Inbox", "GET", "/messages/inbox"),
      qc("recipients", "Recipients", "GET", "/messages/recipients"),
      qc(
        "send",
        "Send",
        "POST",
        "/messages/send",
        { to: "user@hexcarb", subject: "Update", body: "Status update." },
      ),
    ]),
  },
  {
    id: "overseer",
    label: "HexCarb Overseer",
    description: "Oversight timelines and review runs.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("status", "Oversight Status", "GET", "/oversight/status"),
      qc("timeline", "Timeline", "GET", "/oversight/timeline"),
      qc("review", "Run Review", "POST", "/oversight/review/run", {}),
    ]),
  },
  {
    id: "engine_repair",
    label: "Engine Repair",
    description: "Diagnostics and repair workflows.",
    section: "diagnostics",
    quickCalls: withCommonCalls([
      qc("exec_health", "Execution Health", "GET", "/execution/health"),
      qc(
        "repair",
        "Repair",
        "POST",
        "/agent/repair/run",
        { issue: "Describe the issue to repair." },
      ),
    ]),
  },
  {
    id: "weekly_plan",
    label: "Weekly Plan",
    description: "Weekly planning and goal tracking.",
    section: "experiments",
    quickCalls: withCommonCalls([
      qc("plan", "Weekly Plan", "GET", "/execution/plan/weekly"),
      qc("goals", "Goals", "GET", "/execution/goals"),
      qc("risks", "Risks", "GET", "/execution/risks"),
    ]),
  },
  {
    id: "lead_intel",
    label: "CNT Lead Intel",
    description: "Lead intelligence and run status.",
    section: "diagnostics",
    quickCalls: withCommonCalls([
      qc("lead_status", "Status", "GET", "/lead_intel/status"),
      qc("lead_run", "Run", "POST", "/lead_intel/run", {}),
    ]),
  },
  {
    id: "cloud",
    label: "Cloud Console",
    description: "Storage and infrastructure overview.",
    section: "diagnostics",
    quickCalls: withCommonCalls([
      qc("storage", "Storage", "GET", "/storage/overview"),
      qc("ops", "Ops Overview", "GET", "/ops/overview"),
      qc("migrate", "Migrate Storage", "POST", "/storage/migrate", {}),
    ]),
  },
  {
    id: "domain_hr",
    label: "HR",
    description: "HR domain data and ingestion.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("domains", "Domains", "GET", "/domains"),
      qc("hr_items", "HR Items", "GET", "/domains/hr/items"),
      qc(
        "hr_ingest",
        "HR Ingest",
        "POST",
        "/domains/hr/ingest",
        { items: [] },
        "Provide HR items to ingest.",
      ),
    ]),
  },
  {
    id: "domain_procurement",
    label: "Procurement",
    description: "Procurement pipeline and vendor items.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("proc_items", "Procurement Items", "GET", "/domains/procurement/items"),
      qc(
        "proc_ingest",
        "Procurement Ingest",
        "POST",
        "/domains/procurement/ingest",
        { items: [] },
      ),
    ]),
  },
  {
    id: "domain_assets",
    label: "Assets",
    description: "Asset registry and tracking.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("asset_items", "Asset Items", "GET", "/domains/assets/items"),
      qc(
        "asset_ingest",
        "Asset Ingest",
        "POST",
        "/domains/assets/ingest",
        { items: [] },
      ),
    ]),
  },
  {
    id: "domain_sales",
    label: "Sales",
    description: "Sales domain and pipeline objects.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("sales_items", "Sales Items", "GET", "/domains/sales/items"),
      qc(
        "sales_ingest",
        "Sales Ingest",
        "POST",
        "/domains/sales/ingest",
        { items: [] },
      ),
    ]),
  },
  {
    id: "sales_email_generator",
    label: "Email Generator",
    description: "Generate and refine sales emails.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("email_drafts", "Drafts", "GET", "/sales/email/drafts"),
      qc(
        "email_generate",
        "Generate",
        "POST",
        "/sales/email/generate",
        { prompt: "Draft an email about CNT thermal performance." },
      ),
      qc(
        "email_batch",
        "Generate Batch",
        "POST",
        "/sales/email/generate_batch",
        { prompts: ["Follow up with lab partner."], audience: "partner" },
      ),
    ]),
  },
  {
    id: "domain_accounts",
    label: "Accounts",
    description: "Account data and customer records.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("account_items", "Account Items", "GET", "/domains/accounts/items"),
      qc(
        "account_ingest",
        "Accounts Ingest",
        "POST",
        "/domains/accounts/ingest",
        { items: [] },
      ),
    ]),
  },
  {
    id: "admin_scaffold",
    label: "Scaffold / Coming Soon",
    description: "Admin scaffolding and diagnostics hub.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("diag_rag", "RAG Diagnostics", "GET", "/diag/rag"),
      qc("history", "History Summary", "GET", "/history/summary"),
      qc("ops", "Ops Overview", "GET", "/ops/overview"),
    ]),
  },
];

export function getPanelById(id: string): PanelDef | undefined {
  return PANELS.find((panel) => panel.id === id);
}
