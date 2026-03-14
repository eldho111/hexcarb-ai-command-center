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
  dataset_training: "Training & Data",
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
  /* ════════════════════════════════════════════════════════════
     SOURCES
     ════════════════════════════════════════════════════════════ */
  {
    id: "doc_ingest",
    label: "Ingest Sources",
    description: "Load and index new documents into the evidence store.",
    section: "sources",
    quickCalls: withCommonCalls([
      qc("sources", "List Sources", "GET", "/sources"),
      qc("memory_stats", "Memory Stats", "GET", "/memory/stats"),
      qc("index_status", "Index Status", "GET", "/experiments/index_status"),
      qc(
        "ingest_path",
        "Ingest Path",
        "POST",
        "/ingest_path",
        { path: "/workspace/hexcarb_runtime/docs" },
        "Edit the path to a folder available on the engine host.",
      ),
      qc(
        "ingest_files",
        "Ingest Files",
        "POST",
        "/ingest_files",
        { paths: [] },
        "Provide a list of file paths on the engine host.",
      ),
      qc(
        "ingest_files",
        "Ingest Files",
        "POST",
        "/ingest_files",
        { files: [] },
        "Provide file paths or multipart uploads to ingest.",
      ),
      qc(
        "ingest_path",
        "Ingest Path",
        "POST",
        "/ingest_path",
        { path: "/data/papers" },
        "Ingest all documents under a filesystem path.",
      ),
    ]),
  },

  /* ════════════════════════════════════════════════════════════
     CHAT
     ════════════════════════════════════════════════════════════ */
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

  /* ════════════════════════════════════════════════════════════
     DIAGNOSTICS
     ════════════════════════════════════════════════════════════ */
  {
    id: "system_status",
    label: "System Status",
    description: "Runtime health, storage, and model inventory.",
    section: "diagnostics",
    quickCalls: withCommonCalls([
      qc("status", "Status", "GET", "/status"),
      qc("ops_overview", "Ops Overview", "GET", "/ops/overview"),
      qc("engine_health", "Engine Health", "GET", "/engine/health"),
      qc("state", "State", "GET", "/state"),
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
      qc(
        "installed",
        "Ops Overview",
        "GET",
        "/ops/overview",
        undefined,
        "Includes installed models and runtime profile.",
      ),
      qc("sources", "Sources", "GET", "/sources"),
    ]),
  },
  {
    id: "cognition",
    label: "Cognition",
    description: "Staleness, attention, and ranking diagnostics.",
    section: "diagnostics",
    quickCalls: withCommonCalls([
      qc(
        "staleness",
        "Staleness Check",
        "POST",
        "/cognition/staleness",
        {},
        "Check data staleness across knowledge domains.",
      ),
      qc(
        "attention",
        "Attention Map",
        "POST",
        "/cognition/attention",
        {},
        "Compute attention distribution over indexed sources.",
      ),
      qc(
        "rank",
        "Rank",
        "POST",
        "/cognition/rank",
        {},
        "Rank sources by relevance and recency.",
      ),
    ]),
  },

  /* ════════════════════════════════════════════════════════════
     EXPERIMENTS
     ════════════════════════════════════════════════════════════ */
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
      qc(
        "create_draft",
        "Create Draft",
        "POST",
        "/experiments/drafts",
        { title: "New experiment draft", description: "" },
        "Create a new experiment draft. Edit body fields as needed.",
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
        "ingest_experiment",
        "Ingest Experiment",
        "POST",
        "/experiments/ingest",
        { experiment: {} },
        "Ingest a structured experiment record.",
      ),
      qc(
        "validate_experiment",
        "Validate Experiment",
        "POST",
        "/experiments/validate",
        { experiment: {} },
        "Validate an experiment record against the schema.",
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
      qc(
        "scout_ingest",
        "Scout Ingest",
        "POST",
        "/scout/ingest",
        { urls: [] },
        "Ingest specific URLs or references into scout index.",
      ),
    ]),
  },
  {
    id: "measurements",
    label: "Measurements",
    description: "Ingest and query experimental measurements.",
    section: "experiments",
    quickCalls: withCommonCalls([
      qc("list_measurements", "List Measurements", "GET", "/measurements"),
      qc(
        "ingest_measurements",
        "Ingest Measurements",
        "POST",
        "/measurements/ingest",
        { measurements: [] },
        "Upload measurement data. Provide array of measurement objects.",
      ),
    ]),
  },
  {
    id: "reasoning",
    label: "Reasoning",
    description: "RAG-powered experiment reasoning queries.",
    section: "experiments",
    quickCalls: withCommonCalls([
      qc(
        "reason_experiments",
        "Reason over Experiments",
        "POST",
        "/reasoning/experiments",
        { query: "What CNT growth conditions maximize yield?" },
        "RAG query over experiment corpus. Edit the query.",
      ),
    ]),
  },

  /* ════════════════════════════════════════════════════════════
     TRAINING & DATA
     ════════════════════════════════════════════════════════════ */
  {
    id: "training",
    label: "Dataset & Training",
    description: "Model training, evaluations, and dataset exports.",
    section: "dataset_training",
    quickCalls: withCommonCalls([
      qc("training_status", "Training Status", "GET", "/training/status"),
      qc(
        "training_readiness",
        "Training Readiness",
        "GET",
        "/training/readiness",
      ),
      qc("models_registry", "Models Registry", "GET", "/models/registry"),
      qc(
        "register_dataset",
        "Register Dataset",
        "POST",
        "/model_registry/dataset",
        { name: "", version: "1.0" },
        "Register a new dataset in the model registry.",
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
    ]),
  },
  {
    id: "funding",
    label: "Funding",
    description: "Funding pipelines, decks, and updates.",
    section: "dataset_training",
    quickCalls: withCommonCalls([
      qc("funding_list", "Funding List", "GET", "/funding/list"),
      qc(
        "funding_refresh",
        "Refresh Funding",
        "POST",
        "/funding/refresh",
        {},
        "Triggers external fetch; may take a bit.",
      ),
      qc("funding_decks", "Funding Decks", "GET", "/funding/decks"),
    ]),
  },

  /* ════════════════════════════════════════════════════════════
     ADMIN
     ════════════════════════════════════════════════════════════ */
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
      qc(
        "seed_tasks",
        "Seed Tasks",
        "POST",
        "/compliance/tasks/seed",
        {},
        "Seed default compliance tasks. Use with care.",
      ),
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
        "submit_action",
        "Submit Action",
        "POST",
        "/actions/submit",
        { action: "", payload: {} },
        "Submit an action for approval. Edit body as needed.",
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
        "create_notification",
        "Create Notification",
        "POST",
        "/notifications/create",
        { title: "", body: "", level: "info" },
        "Create a new notification. Edit body fields.",
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
        "send_message",
        "Send Message",
        "POST",
        "/messages/send",
        { to: "", subject: "", body: "" },
        "Send a message. Fill in recipient and content.",
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
      qc("exec_tasks", "Execution Tasks", "GET", "/execution/tasks"),
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
      qc("tasks", "Execution Tasks", "GET", "/execution/tasks"),
      qc(
        "risks",
        "Report Risks",
        "POST",
        "/execution/risks",
        { risks: [] },
        "Submit execution risks. Provide array of risk objects.",
      ),
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
      qc("domains", "Domains", "GET", "/domains"),
      qc("domain_sales", "Sales Domain", "GET", "/domains/sales"),
      qc(
        "generate_email",
        "Generate Sales Email",
        "POST",
        "/sales/email/generate",
        {
          prompt: "Draft an outreach email about our CNT capabilities.",
          tone: "direct",
        },
        "Generate a sales email from evidence.",
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
        "POST",
        "/domains/accounts/ingest",
        { items: [] },
      ),
    ]),
  },
  {
    id: "quality",
    label: "Quality",
    description: "Quality tracking items and summary reports.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("quality_items", "Quality Items", "GET", "/quality/items"),
      qc("quality_summary", "Quality Summary", "GET", "/quality/summary"),
      qc(
        "create_quality_item",
        "Create Quality Item",
        "POST",
        "/quality/items",
        { title: "", category: "", severity: "medium" },
        "Create a new quality tracking item.",
      ),
    ]),
  },
  {
    id: "decisions",
    label: "Decisions",
    description: "Decision log and search.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("list_decisions", "List Decisions", "GET", "/decisions"),
      qc(
        "create_decision",
        "Create Decision",
        "POST",
        "/decisions",
        { title: "", rationale: "", outcome: "" },
        "Log a new decision. Edit body fields as needed.",
      ),
      qc(
        "search_decisions",
        "Search Decisions",
        "POST",
        "/decisions/search",
        { query: "" },
        "Semantic search over decision history.",
      ),
    ]),
  },
  {
    id: "narratives",
    label: "Narratives",
    description: "Company narratives and generation.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("list_narratives", "List Narratives", "GET", "/narratives"),
      qc(
        "generate_narrative",
        "Generate Narrative",
        "POST",
        "/narratives/generate",
        { context: "" },
        "Generate a new narrative from current data.",
      ),
      qc(
        "latest_company",
        "Latest Company Narrative",
        "GET",
        "/narratives/latest/company",
      ),
    ]),
  },
  {
    id: "planning",
    label: "Planning",
    description: "Strategic planning context and recomputation.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc(
        "planning_context",
        "Planning Context",
        "POST",
        "/planning/context",
        {},
        "Fetch or compute current planning context.",
      ),
      qc(
        "recompute",
        "Recompute Plan",
        "POST",
        "/planning/recompute",
        {},
        "Trigger full planning recomputation.",
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

export function getPanelById(panelId: string): PanelDef | null {
  const found = PANELS.find((p) => p.id === panelId);
  return found || null;
}

export function getPanelsBySection(): Record<PanelSection, PanelDef[]> {
  const out: Record<PanelSection, PanelDef[]> = {
    sources: [],
    chat: [],
    diagnostics: [],
    experiments: [],
    dataset_training: [],
    admin: [],
  };
  for (const panel of PANELS) out[panel.section].push(panel);
  return out;
}

/** @deprecated Use getPanelsBySection instead */
export function panelsBySection(): Record<PanelSection, PanelDef[]> {
  return getPanelsBySection();
}
