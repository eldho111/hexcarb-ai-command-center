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

export type PanelAvailability = "live" | "planned";

export type PanelDef = {
  id: string;
  label: string;
  description: string;
  section: PanelSection;
  availability: PanelAvailability;
  availabilityNote?: string;
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

const SAMPLE_INGEST_B64 = "SGVsbG8gZnJvbSBIZXhDYXJiLg==";
const SAMPLE_EXTRACT_B64 = "U2FtcGxlIGV4cGVyaW1lbnQgbm90ZXMgaGVscCB2ZXJpZnkgdGhlIGNvbnNvbGUu";
const SAMPLE_PLANNING_CONTEXT = {
  context_id: "PLAN_SAMPLE",
  scope: "weekly",
  user_id: "web-admin",
  active_goals: [],
  constraints: [],
  assumptions: [],
  proposed_tasks: [],
  risks: [],
  confidence_score: 0.85,
  updated_at: "2026-03-14T00:00:00Z",
  source_objects: [],
};

type LivePanelInput = Omit<PanelDef, "availability">;
type PlannedPanelInput = Omit<PanelDef, "availability" | "quickCalls"> & {
  availabilityNote: string;
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

function livePanel(panel: LivePanelInput): PanelDef {
  return { ...panel, availability: "live" };
}

function plannedPanel(panel: PlannedPanelInput): PanelDef {
  return {
    ...panel,
    availability: "planned",
    quickCalls: [],
  };
}

export const PANELS: PanelDef[] = [
  livePanel({
    id: "doc_ingest",
    label: "Ingest Sources",
    description: "Load and index new documents into the evidence store.",
    section: "sources",
    quickCalls: withCommonCalls([
      qc("sources", "List Sources", "GET", "/sources"),
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
        {
          items: [
            {
              name: "notes.txt",
              content_b64: SAMPLE_INGEST_B64,
            },
          ],
        },
        "Provide base64-encoded files instead of engine-local paths.",
      ),
    ]),
  }),
  livePanel({
    id: "chat",
    label: "Cited Chat",
    description: "Stream grounded answers with citations and fall back to JSON chat when needed.",
    section: "chat",
    quickCalls: withCommonCalls([
      qc("models", "Models", "GET", "/models"),
      qc(
        "chat_stream",
        "Chat Stream",
        "POST",
        "/chat_stream",
        { message: "Summarize the latest CNT experiment notes." },
      ),
      qc(
        "chat",
        "Chat",
        "POST",
        "/chat",
        { message: "Hello from the command center." },
      ),
    ]),
  }),
  livePanel({
    id: "system_status",
    label: "System Status",
    description: "Runtime health and model inventory for the current engine build.",
    section: "diagnostics",
    quickCalls: withCommonCalls([
      qc("status", "Status", "GET", "/status"),
      qc("engine_health", "Engine Health", "GET", "/engine/health"),
    ]),
  }),
  plannedPanel({
    id: "telemetry",
    label: "Telemetry",
    description: "Operations events and streaming telemetry.",
    section: "diagnostics",
    availabilityNote: "Ops and telemetry routes are not exposed by the current engine build.",
  }),
  livePanel({
    id: "capabilities",
    label: "Capabilities",
    description: "Model registry, routing, and capability inventory.",
    section: "diagnostics",
    quickCalls: withCommonCalls([
      qc("models", "Models", "GET", "/models"),
      qc("registry", "Model Registry", "GET", "/models/registry"),
      qc(
        "set_model",
        "Set Model",
        "POST",
        "/set_model",
        { role: "light", model: "qwen2.5:14b" },
      ),
    ]),
  }),
  livePanel({
    id: "experiment_drafts",
    label: "Draft Queue",
    description: "Review and approve experiment drafts.",
    section: "experiments",
    quickCalls: withCommonCalls([
      qc("drafts", "List Drafts", "GET", "/experiments/drafts"),
    ]),
  }),
  livePanel({
    id: "experiment_form",
    label: "Experiment Form",
    description: "Structured extraction for canonical experiment specs.",
    section: "experiments",
    quickCalls: withCommonCalls([
      qc(
        "extract",
        "Extract",
        "POST",
        "/experiments/extract",
        { text: "Describe an experiment with CNT catalyst ratios." },
      ),
      qc(
        "extract_text",
        "Extract Text",
        "POST",
        "/experiments/extract_text",
        {
          name: "sample-notes.txt",
          content_b64: SAMPLE_EXTRACT_B64,
        },
      ),
      qc("readiness", "Readiness", "GET", "/experiments/readiness"),
      qc("index_status", "Index Status", "GET", "/experiments/index_status"),
    ]),
  }),
  plannedPanel({
    id: "lab_items",
    label: "Lab Items",
    description: "Lab inventory and domain items for experiments.",
    section: "experiments",
    availabilityNote: "The lab domain is not registered in the current engine build.",
  }),
  plannedPanel({
    id: "plot",
    label: "Graph Plotter",
    description: "Generate plots from structured experiment data.",
    section: "experiments",
    availabilityNote: "Plot agent routes are not exposed by the current engine build.",
  }),
  livePanel({
    id: "scout",
    label: "Research Scout",
    description: "External and internal scouting workflows.",
    section: "experiments",
    quickCalls: withCommonCalls([
      qc("scout_list", "Scout List", "GET", "/scout/list"),
      qc(
        "scout_ingest",
        "Ingest Doc",
        "POST",
        "/scout/ingest",
        {
          text: "Carbon nanotube dispersions improved conductivity after solvent refinement.",
          source_url: "https://example.com/research-note",
          title: "CNT dispersion note",
          tags: ["cnt", "dispersion"],
          notes: "Console smoke payload",
        },
        "Replace the text and URL with the item you want to index.",
      ),
    ]),
  }),
  livePanel({
    id: "training",
    label: "Dataset & Training",
    description: "Model training, evaluations, and dataset exports.",
    section: "dataset_training",
    quickCalls: withCommonCalls([
      qc("training_status", "Training Status", "GET", "/training/status"),
      qc("training_readiness", "Training Readiness", "GET", "/training/readiness"),
    ]),
  }),
  livePanel({
    id: "news",
    label: "News Board",
    description: "Monitor materials research news and alerts.",
    section: "dataset_training",
    quickCalls: withCommonCalls([
      qc("news_list", "News List", "GET", "/news/list"),
      qc("news_refresh", "Refresh", "POST", "/news/refresh", {}),
    ]),
  }),
  livePanel({
    id: "funding",
    label: "Funding",
    description: "Funding pipelines, decks, and updates.",
    section: "dataset_training",
    quickCalls: withCommonCalls([
      qc("funding_list", "Funding List", "GET", "/funding/list"),
      qc("funding_refresh", "Refresh", "POST", "/funding/refresh", {}),
      qc("funding_decks", "Decks", "GET", "/funding/decks"),
    ]),
  }),
  livePanel({
    id: "system_state",
    label: "System Config",
    description: "Planning context and system state.",
    section: "diagnostics",
    quickCalls: withCommonCalls([
      qc("state", "State", "GET", "/state"),
      qc(
        "planning_context",
        "Planning Context",
        "POST",
        "/planning/context",
        { scope: "weekly", user_id: "web-admin" },
      ),
      qc(
        "planning_constraints",
        "Planning Constraints",
        "POST",
        "/planning/constraints",
        {
          planning_context: SAMPLE_PLANNING_CONTEXT,
          user_input: "Prioritize weekly CNT experiment follow-through.",
        },
        "Use a real planning_context from the previous call for meaningful results.",
      ),
    ]),
  }),
  livePanel({
    id: "compliance",
    label: "Compliance",
    description: "Compliance workflows and task tracking.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("profile", "Profile", "GET", "/compliance/profile"),
      qc("tasks", "Tasks", "GET", "/compliance/tasks"),
      qc("seed", "Seed Tasks", "POST", "/compliance/tasks/seed", {}),
    ]),
  }),
  livePanel({
    id: "approvals",
    label: "Approvals",
    description: "Review and approve queued actions.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("actions", "List Actions", "GET", "/actions"),
      qc("approvals", "Approvals", "GET", "/actions/approvals"),
      qc(
        "submit",
        "Submit Action",
        "POST",
        "/actions/submit",
        {
          action: "backup_canonical",
          payload: {},
          reason: "Manual backup requested from the command center.",
        },
      ),
    ]),
  }),
  livePanel({
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
        {
          title: "Alert",
          body: "Experiment threshold exceeded.",
          severity: "info",
          category: "ops",
          target: "all",
        },
      ),
    ]),
  }),
  livePanel({
    id: "messages",
    label: "Messages",
    description: "Send and review internal messages.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("inbox", "Inbox", "GET", "/messages/inbox"),
      qc(
        "send",
        "Send",
        "POST",
        "/messages/send",
        { to_user: "ops-lead", body: "Status update from the command center." },
      ),
    ]),
  }),
  plannedPanel({
    id: "overseer",
    label: "HexCarb Overseer",
    description: "Oversight timelines and review runs.",
    section: "admin",
    availabilityNote: "Oversight routes are not exposed by the current engine build.",
  }),
  livePanel({
    id: "engine_repair",
    label: "Engine Repair",
    description: "Diagnostics and repair workflows.",
    section: "diagnostics",
    quickCalls: withCommonCalls([
      qc(
        "exec_health",
        "Execution Health",
        "POST",
        "/execution/health",
        { period: "7d" },
      ),
      qc("exec_tasks", "Execution Tasks", "GET", "/execution/tasks"),
    ]),
  }),
  livePanel({
    id: "weekly_plan",
    label: "Weekly Plan",
    description: "Weekly planning and goal tracking.",
    section: "experiments",
    quickCalls: withCommonCalls([
      qc(
        "plan",
        "Weekly Plan",
        "POST",
        "/execution/plan/weekly",
        { scope: "weekly", user_id: "web-admin" },
      ),
      qc("goals", "Goals", "GET", "/execution/goals"),
      qc(
        "risks",
        "Risks",
        "POST",
        "/execution/risks",
        { scope: "weekly", user_id: "web-admin" },
      ),
    ]),
  }),
  livePanel({
    id: "lead_intel",
    label: "CNT Lead Intel",
    description: "Read-only SWCNT-first lead intelligence backed by the exported lead set.",
    section: "diagnostics",
    availabilityNote: "Read-only export-backed view. Generate the lead export offline on the engine host when data is missing or stale.",
    quickCalls: withCommonCalls([
      qc("lead_status", "Lead Status", "GET", "/lead_intel/status"),
      qc(
        "lead_swcnt",
        "SWCNT Leads",
        "GET",
        "/lead_intel/leads?focus=swcnt&limit=25",
      ),
      qc(
        "lead_all",
        "All CNT Leads",
        "GET",
        "/lead_intel/leads?focus=all&limit=25",
      ),
    ]),
  }),
  plannedPanel({
    id: "cloud",
    label: "Cloud Console",
    description: "Storage and infrastructure overview.",
    section: "diagnostics",
    availabilityNote: "Storage and ops routes are not exposed by the current engine build.",
  }),
  livePanel({
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
        {
          payload: {
            employee_id: "EMP-1001",
            name: "Sample User",
            status: "active",
          },
        },
        "Provide the HR object inside payload.",
      ),
    ]),
  }),
  livePanel({
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
        {
          payload: {
            request_id: "PR-1001",
            vendor: "Acme Labs",
            status: "open",
          },
        },
      ),
    ]),
  }),
  livePanel({
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
        {
          payload: {
            asset_id: "AST-1001",
            name: "CNT Reactor",
            status: "active",
          },
        },
      ),
    ]),
  }),
  livePanel({
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
        {
          payload: {
            opportunity_id: "SALE-1001",
            account: "Pilot Lab",
            stage: "qualified",
          },
        },
      ),
    ]),
  }),
  plannedPanel({
    id: "sales_email_generator",
    label: "Email Generator",
    description: "Generate and refine sales emails.",
    section: "admin",
    availabilityNote: "Sales email routes are not exposed by the current engine build.",
  }),
  plannedPanel({
    id: "domain_accounts",
    label: "Accounts",
    description: "Account data and customer records.",
    section: "admin",
    availabilityNote: "The accounts domain is not registered in the current engine build.",
  }),
  livePanel({
    id: "admin_scaffold",
    label: "Scaffold / Coming Soon",
    description: "Admin scaffolding and diagnostics hub.",
    section: "admin",
    quickCalls: withCommonCalls([
      qc("diag_rag", "RAG Diagnostics", "GET", "/diag/rag?q=cnt&k=3"),
    ]),
  }),
];

export function getPanelById(id: string): PanelDef | undefined {
  return PANELS.find((panel) => panel.id === id);
}

export function isPanelLive(panel: PanelDef): boolean {
  return panel.availability === "live";
}

export function isPanelPlanned(panel: PanelDef): boolean {
  return panel.availability === "planned";
}
