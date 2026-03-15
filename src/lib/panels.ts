import type { ListDetailConfig } from "@/components/views/ListDetailView";
import type { DashboardConfig } from "@/components/views/DashboardView";
import type { FormActionConfig } from "@/components/views/FormActionView";
import type { WorkflowConfig } from "@/components/views/WorkflowView";
import type { CrudConfig } from "@/components/views/CrudView";
import type { RelatedLinkDef } from "@/components/widgets/RelatedLinks";

/* ── Core types ────────────────────────────────────────────────── */

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

export type ViewType = "chat" | "lead-intel" | "list-detail" | "dashboard" | "form-action" | "workflow" | "crud" | "runner";

export type ViewConfig =
  | ListDetailConfig
  | DashboardConfig
  | FormActionConfig
  | WorkflowConfig
  | CrudConfig;

export type PanelDef = {
  id: string;
  label: string;
  description: string;
  section: PanelSection;
  quickCalls: QuickCall[];
  viewType: ViewType;
  viewConfig?: ViewConfig;
  instructions: string;
  tips?: string[];
  relatedPanels?: RelatedLinkDef[];
};

/* ── Constants ─────────────────────────────────────────────────── */

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

/* ── Helpers ───────────────────────────────────────────────────── */

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

/* ══════════════════════════════════════════════════════════════════
   PANEL DEFINITIONS
   ══════════════════════════════════════════════════════════════════ */

export const PANELS: PanelDef[] = [

  /* ── SOURCES ─────────────────────────────────────────────────── */
  {
    id: "doc_ingest",
    label: "Ingest Sources",
    description: "Load and index new documents into the evidence store.",
    section: "sources",
    viewType: "form-action",
    instructions: "Ingest research papers, PDFs, and text files into the knowledge base. Ingested documents become searchable by Chat and RAG Reasoning. Check index status to see how many chunks are indexed.",
    tips: [
      "Use 'Ingest Path' to bulk-ingest a folder on the engine host.",
      "Files are chunked, embedded, and stored in ChromaDB automatically.",
      "After ingesting, use the Chat panel to query your new documents.",
    ],
    viewConfig: {
      submitEndpoint: "/ingest_path",
      fields: [
        { key: "path", label: "Folder Path (on engine host)", type: "text", required: true, placeholder: "/workspace/hexcarb_runtime/docs", hint: "Path to a folder on the RunPod instance containing documents to ingest." },
      ],
      submitLabel: "Ingest Documents",
    } satisfies FormActionConfig,
    relatedPanels: [
      { panelId: "chat", label: "Cited Chat", description: "Query ingested documents" },
      { panelId: "reasoning", label: "Reasoning", description: "RAG reasoning over experiments" },
      { panelId: "scout", label: "Research Scout", description: "Ingest external research" },
    ],
    quickCalls: withCommonCalls([
      qc("sources", "List Sources", "GET", "/sources"),
      qc("memory_stats", "Memory Stats", "GET", "/memory/stats"),
      qc("index_status", "Index Status", "GET", "/experiments/index_status"),
      qc("ingest_path", "Ingest Path", "POST", "/ingest_path", { path: "/workspace/hexcarb_runtime/docs" }),
    ]),
  },

  /* ── CHAT ────────────────────────────────────────────────────── */
  {
    id: "chat",
    label: "Cited Chat",
    description: "Stream grounded answers with citations.",
    section: "chat",
    viewType: "chat",
    instructions: "Ask questions about carbon nanotube research. AI responses include citations from your ingested documents and experiments. Choose a model hint for quality/speed tradeoffs.",
    tips: [
      "Responses are streamed in real-time with NDJSON.",
      "Citations link back to the source documents in your knowledge base.",
      "Use Shift+Enter for multi-line messages.",
    ],
    relatedPanels: [
      { panelId: "doc_ingest", label: "Ingest Sources", description: "Add more documents to the knowledge base" },
      { panelId: "reasoning", label: "Reasoning", description: "RAG queries over experiments" },
      { panelId: "capabilities", label: "Capabilities", description: "View available models" },
    ],
    quickCalls: withCommonCalls([
      qc("models", "Models", "GET", "/models"),
      qc("chat", "Chat", "POST", "/chat", { message: "Hello from the console." }),
    ]),
  },

  /* ── DIAGNOSTICS ─────────────────────────────────────────────── */
  {
    id: "system_status",
    label: "System Status",
    description: "Runtime health, storage, and model inventory.",
    section: "diagnostics",
    viewType: "dashboard",
    instructions: "Monitor engine health in real-time. Data refreshes every 15 seconds. Check GPU utilization, memory usage, and model availability.",
    tips: [
      "Green status = healthy, Red = needs attention.",
      "GPU stats show VRAM usage and power draw from nvidia-smi.",
      "Use 'Warmup Model' to pre-load models into GPU memory.",
    ],
    viewConfig: {
      endpoints: [
        { key: "health", endpoint: "/health", label: "Engine Health", metrics: [
          { key: "version", label: "Version" },
          { key: "gpu_available", label: "GPU Available", format: "status" },
          { key: "compute_mode", label: "Compute Mode" },
          { key: "ollama_reachable", label: "Ollama", format: "status" },
          { key: "active_collection_count", label: "Indexed Chunks", format: "number" },
          { key: "embedding_model_present", label: "Embedding Model", format: "status" },
        ]},
        { key: "status", endpoint: "/status", label: "System Resources", metrics: [
          { key: "memory.total_gb", label: "Total RAM (GB)", format: "number" },
          { key: "memory.used_percent", label: "RAM Used", format: "percent" },
          { key: "memory.process_rss_gb", label: "Process RSS (GB)", format: "number" },
          { key: "engine.gpu_available", label: "GPU", format: "status" },
        ]},
      ],
      refreshInterval: 15000,
      actions: [
        { label: "Warmup Models", endpoint: "/warmup", method: "POST" },
      ],
    } satisfies DashboardConfig,
    relatedPanels: [
      { panelId: "telemetry", label: "Telemetry" },
      { panelId: "capabilities", label: "Capabilities" },
      { panelId: "engine_repair", label: "Engine Repair" },
    ],
    quickCalls: withCommonCalls([
      qc("status", "Status", "GET", "/status"),
      qc("engine_health", "Engine Health", "GET", "/engine/health"),
      qc("state", "State", "GET", "/state"),
    ]),
  },
  {
    id: "telemetry",
    label: "Telemetry",
    description: "Operations events and streaming telemetry.",
    section: "diagnostics",
    viewType: "dashboard",
    instructions: "View engine health metrics, approval backlog, and event log growth. Monitors retrieval performance and citation success rates.",
    viewConfig: {
      endpoints: [
        { key: "engine_health", endpoint: "/engine/health", label: "Engine Metrics" },
        { key: "ops", endpoint: "/ops/overview", label: "Operations Overview" },
      ],
      refreshInterval: 15000,
    } satisfies DashboardConfig,
    relatedPanels: [
      { panelId: "system_status", label: "System Status" },
      { panelId: "capabilities", label: "Capabilities" },
    ],
    quickCalls: withCommonCalls([
      qc("ops_events", "Ops Events", "GET", "/ops/events"),
      qc("ops_stream", "Ops Stream (SSE)", "GET", "/ops/events/stream", undefined, "Streams server-sent events; cancel to stop."),
    ]),
  },
  {
    id: "capabilities",
    label: "Capabilities",
    description: "Model registry, routing, and capability inventory.",
    section: "diagnostics",
    viewType: "dashboard",
    instructions: "View all available LLM models and their role assignments (deep, light, coder, fast, cheap). Check available data sources and tools.",
    viewConfig: {
      endpoints: [
        { key: "models", endpoint: "/models", label: "Model Assignments" },
        { key: "sources", endpoint: "/sources", label: "Data Sources" },
      ],
    } satisfies DashboardConfig,
    relatedPanels: [
      { panelId: "training", label: "Training" },
      { panelId: "system_status", label: "System Status" },
    ],
    quickCalls: withCommonCalls([
      qc("models", "Models", "GET", "/models"),
      qc("sources", "Sources", "GET", "/sources"),
    ]),
  },
  {
    id: "cognition",
    label: "Cognition",
    description: "Staleness, attention, and ranking diagnostics.",
    section: "diagnostics",
    viewType: "form-action",
    instructions: "Check staleness of objects (experiments, tasks, decisions). Flag items needing attention. Rank attention priorities by scope.",
    tips: [
      "Enter an object ID to check its staleness score.",
      "Use 'Rank' with a scope like 'rnd' to see what needs attention most.",
    ],
    viewConfig: {
      submitEndpoint: "/cognition/staleness",
      fields: [
        { key: "object_id", label: "Object ID", type: "text", required: true, placeholder: "Enter an experiment, task, or decision ID" },
      ],
      submitLabel: "Check Staleness",
    } satisfies FormActionConfig,
    relatedPanels: [
      { panelId: "experiment_form", label: "Experiments" },
      { panelId: "decisions", label: "Decisions" },
    ],
    quickCalls: withCommonCalls([
      qc("staleness", "Staleness Check", "POST", "/cognition/staleness", {}, "Enter object_id in body."),
      qc("attention", "Attention Map", "POST", "/cognition/attention", {}),
      qc("rank", "Rank", "POST", "/cognition/rank", {}),
    ]),
  },
  {
    id: "engine_repair",
    label: "Engine Repair",
    description: "Diagnostics and repair workflows.",
    section: "diagnostics",
    viewType: "form-action",
    instructions: "Describe an issue with the engine and the AI will diagnose and attempt to repair it. Also view execution health and task status.",
    viewConfig: {
      submitEndpoint: "/agent/repair/run",
      fields: [
        { key: "issue", label: "Describe the Issue", type: "textarea", required: true, placeholder: "e.g. 'Ollama is not responding' or 'RAG queries returning empty results'" },
      ],
      submitLabel: "Run Repair Agent",
    } satisfies FormActionConfig,
    relatedPanels: [
      { panelId: "system_status", label: "System Status" },
      { panelId: "telemetry", label: "Telemetry" },
    ],
    quickCalls: withCommonCalls([
      qc("exec_health", "Execution Health", "GET", "/execution/health"),
      qc("repair", "Repair", "POST", "/agent/repair/run", { issue: "Describe the issue to repair." }),
    ]),
  },
  {
    id: "lead_intel",
    label: "CNT Lead Intel",
    description: "Read-only SWCNT-first lead intelligence backed by the exported lead set.",
    section: "diagnostics",
    viewType: "lead-intel",
    instructions: "Browse CNT lead intelligence data. Filter by SWCNT focus, minimum score, geography, and more. Data is backed by the pre-exported lead set on the engine host.",
    tips: [
      "Default view shows SWCNT-first ranked leads.",
      "Use filters to narrow by score, Kerala-only, or India-only.",
      "Data refreshes when you change filters and click Apply.",
    ],
    relatedPanels: [
      { panelId: "scout", label: "Research Scout", description: "Ingest external research" },
      { panelId: "news", label: "News Board", description: "Materials research news" },
    ],
    quickCalls: withCommonCalls([
      qc("lead_status", "Lead Status", "GET", "/lead_intel/status"),
      qc("lead_swcnt", "SWCNT Leads", "GET", "/lead_intel/leads?focus=swcnt&limit=25"),
      qc("lead_all", "All CNT Leads", "GET", "/lead_intel/leads?focus=all&limit=25"),
    ]),
  },
  {
    id: "cloud",
    label: "Cloud Console",
    description: "Storage and infrastructure overview.",
    section: "diagnostics",
    viewType: "dashboard",
    instructions: "View storage usage and infrastructure overview. Monitor cloud resources and trigger storage migrations.",
    viewConfig: {
      endpoints: [
        { key: "storage", endpoint: "/storage/overview", label: "Storage" },
        { key: "ops", endpoint: "/ops/overview", label: "Operations" },
      ],
    } satisfies DashboardConfig,
    relatedPanels: [
      { panelId: "system_status", label: "System Status" },
    ],
    quickCalls: withCommonCalls([
      qc("storage", "Storage", "GET", "/storage/overview"),
      qc("ops", "Ops Overview", "GET", "/ops/overview"),
    ]),
  },
  {
    id: "system_state",
    label: "System Config",
    description: "Planning context and system state.",
    section: "diagnostics",
    viewType: "dashboard",
    instructions: "View the current system state, planning context, and constraint configuration.",
    viewConfig: {
      endpoints: [
        { key: "state", endpoint: "/state", label: "System State" },
      ],
    } satisfies DashboardConfig,
    relatedPanels: [
      { panelId: "planning", label: "Planning" },
      { panelId: "system_status", label: "System Status" },
    ],
    quickCalls: withCommonCalls([
      qc("state", "State", "GET", "/state"),
    ]),
  },

  /* ── EXPERIMENTS ─────────────────────────────────────────────── */
  {
    id: "experiment_drafts",
    label: "Draft Queue",
    description: "Review and approve experiment drafts.",
    section: "experiments",
    viewType: "workflow",
    instructions: "Review pending experiment submissions. Drafts must be approved before becoming canonical records. Approve to add to the experiment database, or reject with a reason.",
    tips: [
      "Click a draft to expand and see full details.",
      "Approved drafts are automatically added to the canonical experiment store.",
      "Rejected drafts are kept in history with the rejection reason.",
    ],
    viewConfig: {
      listEndpoint: "/experiments/drafts",
      listKey: "drafts",
      idField: "draft_id",
      statusField: "status",
      titleField: "source_name",
      filters: ["all", "pending", "approved", "rejected"],
      detailEndpoint: "/experiments/drafts/{id}",
      actions: [
        { label: "Approve", endpoint: "/experiments/drafts/{id}/approve", variant: "primary", confirmMessage: "Approve this draft? It will become a canonical experiment." },
        { label: "Reject", endpoint: "/experiments/drafts/{id}/reject", variant: "accent", needsReason: true },
      ],
    } satisfies WorkflowConfig,
    relatedPanels: [
      { panelId: "experiment_form", label: "Experiments", description: "Browse canonical experiments" },
      { panelId: "measurements", label: "Measurements" },
    ],
    quickCalls: withCommonCalls([
      qc("drafts", "List Drafts", "GET", "/experiments/drafts"),
      qc("create_draft", "Create Draft", "POST", "/experiments/drafts", { experiment: {}, source_name: "Manual entry" }),
    ]),
  },
  {
    id: "experiment_form",
    label: "Experiment Form",
    description: "Structured extraction for canonical experiment specs.",
    section: "experiments",
    viewType: "list-detail",
    instructions: "Browse all nanotube experiments. Search by material type, solvent, dispersant, or conductivity range. Click any row to see full details.",
    tips: [
      "Use Search to filter by nanotube type, solvent, or minimum conductivity.",
      "Use 'Extract from Text' in the Advanced API Runner to have the AI extract experiment data from a research paper passage.",
      "Each experiment is indexed into the vector database for RAG queries.",
    ],
    viewConfig: {
      listEndpoint: "/experiments/list",
      listKey: "experiments",
      idField: "experiment_id",
      detailEndpoint: "/experiments/{id}",
      columns: [
        { key: "experiment_id", label: "ID", width: "100px" },
        { key: "nanotube_type", label: "Nanotube Type" },
        { key: "solvent", label: "Solvent" },
        { key: "dispersant", label: "Dispersant" },
        { key: "conductivity_s_cm", label: "Conductivity (S/cm)" },
        { key: "tags", label: "Tags" },
      ],
      createEndpoint: "/experiments/ingest",
      createLabel: "Add Experiment",
      createFields: [
        { key: "experiment", label: "Experiment Data (JSON)", type: "json", required: true, placeholder: '{\n  "nanotube_type": "MWCNT",\n  "solvent": "water",\n  "dispersant": "SDS",\n  "conductivity_s_cm": 150\n}' },
      ],
      searchEndpoint: "/experiments/search",
      searchResultKey: "experiments",
      searchFields: [
        { key: "nanotube_type", label: "Nanotube Type", type: "text", placeholder: "e.g. MWCNT, SWCNT" },
        { key: "solvent", label: "Solvent", type: "text", placeholder: "e.g. water, ethanol" },
        { key: "dispersant", label: "Dispersant", type: "text", placeholder: "e.g. SDS, CTAB" },
        { key: "min_conductivity_s_cm", label: "Min Conductivity (S/cm)", type: "number" },
      ],
    } satisfies ListDetailConfig,
    relatedPanels: [
      { panelId: "experiment_drafts", label: "Draft Queue" },
      { panelId: "measurements", label: "Measurements" },
      { panelId: "reasoning", label: "Reasoning" },
      { panelId: "training", label: "Training" },
      { panelId: "quality", label: "Quality" },
    ],
    quickCalls: withCommonCalls([
      qc("canonical", "Canonical Experiments", "GET", "/experiments/list"),
      qc("extract", "Extract", "POST", "/experiments/extract", { text: "Describe an experiment with CNT catalyst ratios." }),
      qc("ingest_experiment", "Ingest Experiment", "POST", "/experiments/ingest", { experiment: {} }),
    ]),
  },
  {
    id: "lab_items",
    label: "Lab Items",
    description: "Lab inventory and domain items for experiments.",
    section: "experiments",
    viewType: "list-detail",
    instructions: "Browse lab inventory items. Ingest new lab equipment, materials, or samples.",
    viewConfig: {
      listEndpoint: "/domains/lab/items",
      listKey: "items",
      idField: "object_id",
      columns: [
        { key: "object_id", label: "ID", width: "100px" },
        { key: "name", label: "Name" },
        { key: "type", label: "Type" },
        { key: "status", label: "Status" },
      ],
      createEndpoint: "/domains/lab/ingest",
      createLabel: "Add Lab Item",
      createFields: [
        { key: "payload", label: "Item Data (JSON)", type: "json", required: true, placeholder: '{\n  "name": "MWCNT Sample A",\n  "type": "sample"\n}' },
      ],
    } satisfies ListDetailConfig,
    relatedPanels: [
      { panelId: "experiment_form", label: "Experiments" },
      { panelId: "measurements", label: "Measurements" },
    ],
    quickCalls: withCommonCalls([
      qc("lab_items", "Lab Items", "GET", "/domains/lab/items"),
    ]),
  },
  {
    id: "plot",
    label: "Graph Plotter",
    description: "Generate plots from structured experiment data.",
    section: "experiments",
    viewType: "form-action",
    instructions: "Generate charts and plots from experiment data. Describe what you want to plot in natural language.",
    viewConfig: {
      submitEndpoint: "/agent/plot/run",
      fields: [
        { key: "query", label: "Plot Description", type: "textarea", required: true, placeholder: "Plot CNT yield vs temperature from canonical experiments." },
      ],
      submitLabel: "Generate Plot",
    } satisfies FormActionConfig,
    relatedPanels: [
      { panelId: "experiment_form", label: "Experiments" },
      { panelId: "measurements", label: "Measurements" },
    ],
    quickCalls: withCommonCalls([
      qc("plot_run", "Plot (Agent)", "POST", "/agent/plot/run", { query: "Plot CNT yield vs temperature." }),
    ]),
  },
  {
    id: "scout",
    label: "Research Scout",
    description: "External and internal scouting workflows.",
    section: "experiments",
    viewType: "list-detail",
    instructions: "Ingest external research papers and competitive intelligence. Items are indexed as 'external' trust level in the knowledge base.",
    tips: ["Provide the full text of a research paper or abstract.", "Include a source URL for traceability.", "Tags help with filtering and retrieval later."],
    viewConfig: {
      listEndpoint: "/scout/list",
      listKey: "items",
      idField: "doc_id",
      detailEndpoint: "/scout/{id}",
      columns: [
        { key: "doc_id", label: "ID", width: "100px" },
        { key: "title", label: "Title" },
        { key: "source_url", label: "Source" },
        { key: "tags", label: "Tags" },
      ],
      createEndpoint: "/scout/ingest",
      createLabel: "Ingest Research",
      createFields: [
        { key: "text", label: "Full Text / Abstract", type: "textarea", required: true, placeholder: "Paste the research paper text or abstract here…" },
        { key: "title", label: "Title", type: "text", placeholder: "Paper title" },
        { key: "source_url", label: "Source URL", type: "text", placeholder: "https://..." },
        { key: "notes", label: "Notes", type: "text" },
      ],
    } satisfies ListDetailConfig,
    relatedPanels: [
      { panelId: "doc_ingest", label: "Ingest Sources" },
      { panelId: "news", label: "News Board" },
      { panelId: "funding", label: "Funding" },
    ],
    quickCalls: withCommonCalls([
      qc("scout_list", "Scout List", "GET", "/scout/list"),
      qc("scout_ingest", "Ingest Doc", "POST", "/scout/ingest", { text: "", title: "" }),
    ]),
  },
  {
    id: "measurements",
    label: "Measurements",
    description: "Ingest and query experimental measurements.",
    section: "experiments",
    viewType: "list-detail",
    instructions: "Upload CSV measurement data (conductivity, XRD, TGA, SEM). Link measurements to experiments for traceability.",
    viewConfig: {
      listEndpoint: "/measurements",
      listKey: "measurements",
      idField: "measurement_id",
      detailEndpoint: "/measurements/{id}",
      columns: [
        { key: "measurement_id", label: "ID", width: "100px" },
        { key: "name", label: "Name" },
        { key: "measurement_type", label: "Type" },
        { key: "linked_experiment_id", label: "Experiment" },
      ],
      createEndpoint: "/measurements/ingest",
      createLabel: "Upload Measurement",
      createFields: [
        { key: "file", label: "CSV File", type: "file", required: true },
        { key: "measurement_type", label: "Measurement Type", type: "select", options: [
          { value: "conductivity", label: "Conductivity" }, { value: "xrd", label: "XRD" },
          { value: "tga", label: "TGA" }, { value: "sem", label: "SEM" },
          { value: "raman", label: "Raman" }, { value: "generic", label: "Generic" },
        ]},
        { key: "linked_experiment_id", label: "Linked Experiment ID", type: "text", placeholder: "Optional" },
        { key: "notes", label: "Notes", type: "text" },
      ],
    } satisfies ListDetailConfig,
    relatedPanels: [
      { panelId: "experiment_form", label: "Experiments" },
      { panelId: "quality", label: "Quality" },
    ],
    quickCalls: withCommonCalls([
      qc("list_measurements", "List Measurements", "GET", "/measurements"),
    ]),
  },
  {
    id: "reasoning",
    label: "Reasoning",
    description: "RAG-powered experiment reasoning queries.",
    section: "experiments",
    viewType: "form-action",
    instructions: "Ask questions answered using your experiment data as context (RAG). The AI retrieves relevant experiments and generates evidence-based answers.",
    viewConfig: {
      submitEndpoint: "/reasoning/experiments",
      fields: [
        { key: "query", label: "Research Question", type: "textarea", required: true, placeholder: "What CNT growth conditions maximize yield?" },
        { key: "k", label: "Experiments to retrieve", type: "number", defaultValue: 5 },
      ],
      submitLabel: "Run RAG Query",
    } satisfies FormActionConfig,
    relatedPanels: [
      { panelId: "experiment_form", label: "Experiments" },
      { panelId: "chat", label: "Cited Chat" },
    ],
    quickCalls: withCommonCalls([
      qc("reason", "Reason over Experiments", "POST", "/reasoning/experiments", { query: "What CNT growth conditions maximize yield?" }),
    ]),
  },
  {
    id: "weekly_plan",
    label: "Weekly Plan",
    description: "Weekly planning and goal tracking.",
    section: "experiments",
    viewType: "form-action",
    instructions: "Generate an AI-driven weekly plan based on current goals, tasks, and risks. Set scope to focus on specific areas.",
    viewConfig: {
      submitEndpoint: "/execution/plan/weekly",
      fields: [
        { key: "scope", label: "Scope", type: "text", required: true, placeholder: "e.g. rnd, compliance, all", defaultValue: "rnd" },
        { key: "user_id", label: "User ID (optional)", type: "text" },
      ],
      submitLabel: "Generate Weekly Plan",
    } satisfies FormActionConfig,
    relatedPanels: [
      { panelId: "compliance", label: "Compliance" },
      { panelId: "decisions", label: "Decisions" },
      { panelId: "planning", label: "Planning" },
    ],
    quickCalls: withCommonCalls([
      qc("plan", "Weekly Plan", "POST", "/execution/plan/weekly", { scope: "rnd" }),
      qc("goals", "Goals", "GET", "/execution/goals"),
      qc("tasks", "Execution Tasks", "GET", "/execution/tasks"),
    ]),
  },

  /* ── TRAINING & DATA ─────────────────────────────────────────── */
  {
    id: "training",
    label: "Dataset & Training",
    description: "Model training, evaluations, and dataset exports.",
    section: "dataset_training",
    viewType: "dashboard",
    instructions: "Monitor ML model training status and readiness. Check if enough experiment data exists to train.",
    viewConfig: {
      endpoints: [
        { key: "status", endpoint: "/training/status", label: "Training Status", metrics: [
          { key: "state", label: "State", format: "status" },
          { key: "current_job", label: "Current Job" },
          { key: "hardware", label: "Hardware" },
          { key: "dataset_size", label: "Dataset Size", format: "number" },
        ]},
        { key: "readiness", endpoint: "/training/readiness", label: "Training Readiness" },
        { key: "registry", endpoint: "/models/registry", label: "Model Registry" },
      ],
    } satisfies DashboardConfig,
    relatedPanels: [
      { panelId: "experiment_form", label: "Experiments" },
      { panelId: "capabilities", label: "Capabilities" },
    ],
    quickCalls: withCommonCalls([
      qc("training_status", "Training Status", "GET", "/training/status"),
      qc("training_readiness", "Training Readiness", "GET", "/training/readiness"),
      qc("models_registry", "Models Registry", "GET", "/models/registry"),
    ]),
  },
  {
    id: "news",
    label: "News Board",
    description: "Monitor materials research news and alerts.",
    section: "dataset_training",
    viewType: "list-detail",
    instructions: "Monitor industry news about carbon nanotubes, advanced materials, and related sectors. Refresh to scout for latest articles.",
    viewConfig: {
      listEndpoint: "/news/list", listKey: "items", idField: "item_id", detailEndpoint: "/news/{id}",
      columns: [
        { key: "title", label: "Title" }, { key: "category", label: "Category" },
        { key: "source", label: "Source" }, { key: "published_at", label: "Published" },
      ],
      refreshEndpoint: "/news/refresh",
    } satisfies ListDetailConfig,
    relatedPanels: [{ panelId: "scout", label: "Research Scout" }, { panelId: "funding", label: "Funding" }],
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
    viewType: "list-detail",
    instructions: "Track funding opportunities (grants, VC, government schemes). Upload pitch decks. Refresh to scout for new opportunities.",
    viewConfig: {
      listEndpoint: "/funding/list", listKey: "items", idField: "item_id", detailEndpoint: "/funding/{id}",
      columns: [
        { key: "title", label: "Title" }, { key: "category", label: "Category" },
        { key: "source", label: "Source" }, { key: "deadline", label: "Deadline" },
      ],
      refreshEndpoint: "/funding/refresh",
    } satisfies ListDetailConfig,
    relatedPanels: [{ panelId: "news", label: "News Board" }, { panelId: "scout", label: "Research Scout" }, { panelId: "compliance", label: "Compliance" }],
    quickCalls: withCommonCalls([
      qc("funding_list", "Funding List", "GET", "/funding/list"),
      qc("funding_refresh", "Refresh Funding", "POST", "/funding/refresh", {}),
      qc("funding_decks", "Funding Decks", "GET", "/funding/decks"),
    ]),
  },

  /* ── ADMIN ───────────────────────────────────────────────────── */
  {
    id: "compliance",
    label: "Compliance",
    description: "Compliance workflows and task tracking.",
    section: "admin",
    viewType: "crud",
    instructions: "Manage company compliance calendar. Seed default Indian startup tasks (GST, ROC, annual return). Update company profile. Track due dates and mark tasks complete.",
    tips: ["Use 'Seed Defaults' to populate standard compliance tasks.", "Edit the company profile to keep registration details up to date.", "Update task status to 'done' when a filing is completed."],
    viewConfig: {
      listEndpoint: "/compliance/tasks", listKey: "tasks", idField: "task_id",
      columns: [
        { key: "task_id", label: "ID", width: "80px" }, { key: "title", label: "Task" },
        { key: "category", label: "Category" }, { key: "due_date", label: "Due Date" },
        { key: "status", label: "Status" }, { key: "assigned_to", label: "Assigned To" },
      ],
      createEndpoint: "/compliance/tasks", createLabel: "Add Task",
      createFields: [
        { key: "title", label: "Title", type: "text", required: true, placeholder: "e.g. GST Return Q1" },
        { key: "category", label: "Category", type: "select", options: [
          { value: "gst", label: "GST" }, { value: "roc", label: "ROC" },
          { value: "annual_return", label: "Annual Return" }, { value: "tax", label: "Tax" }, { value: "other", label: "Other" },
        ]},
        { key: "due_date", label: "Due Date", type: "date" },
        { key: "assigned_to", label: "Assigned To", type: "text" },
        { key: "notes", label: "Notes", type: "textarea" },
      ],
      updateEndpoint: "/compliance/tasks/{id}/update",
      updateFields: [
        { key: "status", label: "Status", type: "select", options: [
          { value: "pending", label: "Pending" }, { value: "in_progress", label: "In Progress" },
          { value: "done", label: "Done" }, { value: "overdue", label: "Overdue" },
        ]},
        { key: "due_date", label: "Due Date", type: "date" },
        { key: "assigned_to", label: "Assigned To", type: "text" },
        { key: "notes", label: "Notes", type: "textarea" },
      ],
      seedEndpoint: "/compliance/tasks/seed", seedLabel: "Seed Default Tasks",
      profileEndpoint: "/compliance/profile", profileUpdateEndpoint: "/compliance/profile",
      profileFields: [
        { key: "company_name", label: "Company Name", type: "text" },
        { key: "company_type", label: "Company Type", type: "text", placeholder: "e.g. Private Limited" },
        { key: "incorporated_on", label: "Incorporated On", type: "date" },
        { key: "directors_count", label: "Directors Count", type: "number" },
        { key: "startup", label: "DPIIT Startup", type: "checkbox" },
        { key: "gst_number", label: "GST Number", type: "text" },
        { key: "registered_address", label: "Registered Address", type: "textarea" },
        { key: "roc", label: "ROC", type: "text" },
      ],
    } satisfies CrudConfig,
    relatedPanels: [{ panelId: "notifications", label: "Notifications" }, { panelId: "weekly_plan", label: "Weekly Plan" }],
    quickCalls: withCommonCalls([
      qc("profile", "Profile", "GET", "/compliance/profile"),
      qc("tasks", "Tasks", "GET", "/compliance/tasks"),
      qc("seed_tasks", "Seed Tasks", "POST", "/compliance/tasks/seed", {}),
    ]),
  },
  {
    id: "approvals",
    label: "Approvals",
    description: "Review and approve queued actions.",
    section: "admin",
    viewType: "workflow",
    instructions: "Review pending action requests. Approve or reject with a reason. All sensitive actions go through this approval gate.",
    viewConfig: {
      listEndpoint: "/actions/approvals", listKey: "approvals", idField: "approval_id",
      statusField: "status", titleField: "action",
      filters: ["all", "pending", "approved", "rejected"],
      detailEndpoint: "/actions/approvals/{id}",
      actions: [
        { label: "Approve", endpoint: "/actions/approvals/{id}/approve", variant: "primary" },
        { label: "Reject", endpoint: "/actions/approvals/{id}/reject", variant: "accent", needsReason: true },
      ],
    } satisfies WorkflowConfig,
    relatedPanels: [{ panelId: "notifications", label: "Notifications" }],
    quickCalls: withCommonCalls([
      qc("approvals", "Approvals", "GET", "/actions/approvals"),
      qc("submit_action", "Submit Action", "POST", "/actions/submit", { action: "", payload: {} }),
    ]),
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Create and manage notifications.",
    section: "admin",
    viewType: "list-detail",
    instructions: "View and manage system notifications. Create custom notifications with severity levels.",
    viewConfig: {
      listEndpoint: "/notifications/list", listKey: "items", idField: "notification_id",
      columns: [
        { key: "title", label: "Title" }, { key: "severity", label: "Severity" },
        { key: "category", label: "Category" }, { key: "status", label: "Status" },
      ],
      createEndpoint: "/notifications/create", createLabel: "Create Notification",
      createFields: [
        { key: "title", label: "Title", type: "text", required: true },
        { key: "body", label: "Body", type: "textarea" },
        { key: "severity", label: "Severity", type: "select", options: [
          { value: "info", label: "Info" }, { value: "warning", label: "Warning" }, { value: "critical", label: "Critical" },
        ]},
        { key: "category", label: "Category", type: "text" },
      ],
    } satisfies ListDetailConfig,
    relatedPanels: [{ panelId: "messages", label: "Messages" }, { panelId: "compliance", label: "Compliance" }],
    quickCalls: withCommonCalls([qc("list", "List", "GET", "/notifications/list")]),
  },
  {
    id: "messages",
    label: "Messages",
    description: "Send and review internal messages.",
    section: "admin",
    viewType: "list-detail",
    instructions: "Internal messaging. View your inbox, send messages to other users, and mark messages as read.",
    viewConfig: {
      listEndpoint: "/messages/inbox", listKey: "items", idField: "message_id",
      columns: [
        { key: "from", label: "From" }, { key: "body", label: "Message" },
        { key: "read", label: "Read" }, { key: "created_at", label: "Time" },
      ],
      createEndpoint: "/messages/send", createLabel: "Send Message",
      createFields: [
        { key: "to_user", label: "To", type: "text", placeholder: "Recipient user ID" },
        { key: "body", label: "Message", type: "textarea", required: true },
      ],
    } satisfies ListDetailConfig,
    relatedPanels: [{ panelId: "notifications", label: "Notifications" }],
    quickCalls: withCommonCalls([qc("inbox", "Inbox", "GET", "/messages/inbox")]),
  },
  {
    id: "overseer",
    label: "HexCarb Overseer",
    description: "Oversight timelines and review runs.",
    section: "admin",
    viewType: "dashboard",
    instructions: "View oversight status, review timelines, and trigger oversight review runs.",
    viewConfig: {
      endpoints: [
        { key: "status", endpoint: "/oversight/status", label: "Oversight Status" },
        { key: "timeline", endpoint: "/oversight/timeline", label: "Timeline" },
      ],
      actions: [{ label: "Run Review", endpoint: "/oversight/review/run", method: "POST" }],
    } satisfies DashboardConfig,
    relatedPanels: [{ panelId: "approvals", label: "Approvals" }, { panelId: "compliance", label: "Compliance" }],
    quickCalls: withCommonCalls([
      qc("status", "Oversight Status", "GET", "/oversight/status"),
      qc("timeline", "Timeline", "GET", "/oversight/timeline"),
    ]),
  },
  {
    id: "domain_hr", label: "HR", description: "HR domain data and ingestion.", section: "admin",
    viewType: "list-detail", instructions: "Manage HR domain objects — employee records, policies, and documents.",
    viewConfig: {
      listEndpoint: "/domains/hr/items", listKey: "items", idField: "object_id",
      columns: [{ key: "object_id", label: "ID", width: "100px" }, { key: "name", label: "Name" }, { key: "type", label: "Type" }],
      createEndpoint: "/domains/hr/ingest", createLabel: "Add HR Item",
      createFields: [{ key: "payload", label: "Item Data (JSON)", type: "json", required: true }],
    } satisfies ListDetailConfig,
    relatedPanels: [{ panelId: "compliance", label: "Compliance" }],
    quickCalls: withCommonCalls([qc("hr_items", "HR Items", "GET", "/domains/hr/items")]),
  },
  {
    id: "domain_procurement", label: "Procurement", description: "Procurement pipeline and vendor items.", section: "admin",
    viewType: "list-detail", instructions: "Manage procurement domain — vendor records, purchase orders, and inventory.",
    viewConfig: {
      listEndpoint: "/domains/procurement/items", listKey: "items", idField: "object_id",
      columns: [{ key: "object_id", label: "ID", width: "100px" }, { key: "name", label: "Name" }, { key: "type", label: "Type" }, { key: "status", label: "Status" }],
      createEndpoint: "/domains/procurement/ingest", createLabel: "Add Item",
      createFields: [{ key: "payload", label: "Item Data (JSON)", type: "json", required: true }],
    } satisfies ListDetailConfig,
    relatedPanels: [{ panelId: "domain_assets", label: "Assets" }],
    quickCalls: withCommonCalls([qc("proc_items", "Procurement Items", "GET", "/domains/procurement/items")]),
  },
  {
    id: "domain_assets", label: "Assets", description: "Asset registry and tracking.", section: "admin",
    viewType: "list-detail", instructions: "Manage company assets — equipment, licenses, and physical assets.",
    viewConfig: {
      listEndpoint: "/domains/assets/items", listKey: "items", idField: "object_id",
      columns: [{ key: "object_id", label: "ID", width: "100px" }, { key: "name", label: "Name" }, { key: "type", label: "Type" }, { key: "status", label: "Status" }],
      createEndpoint: "/domains/assets/ingest", createLabel: "Add Asset",
      createFields: [{ key: "payload", label: "Asset Data (JSON)", type: "json", required: true }],
    } satisfies ListDetailConfig,
    relatedPanels: [{ panelId: "domain_procurement", label: "Procurement" }],
    quickCalls: withCommonCalls([qc("asset_items", "Asset Items", "GET", "/domains/assets/items")]),
  },
  {
    id: "domain_sales", label: "Sales", description: "Sales domain and pipeline objects.", section: "admin",
    viewType: "list-detail", instructions: "Manage sales pipeline — leads, opportunities, and customer contacts.",
    viewConfig: {
      listEndpoint: "/domains/sales/items", listKey: "items", idField: "object_id",
      columns: [{ key: "object_id", label: "ID", width: "100px" }, { key: "name", label: "Name" }, { key: "type", label: "Type" }, { key: "status", label: "Status" }],
    } satisfies ListDetailConfig,
    relatedPanels: [{ panelId: "sales_email_generator", label: "Email Generator" }, { panelId: "lead_intel", label: "Lead Intel" }],
    quickCalls: withCommonCalls([qc("domain_sales", "Sales Domain", "GET", "/domains/sales/items")]),
  },
  {
    id: "sales_email_generator", label: "Email Generator", description: "Generate and refine sales emails.", section: "admin",
    viewType: "form-action", instructions: "Generate evidence-backed sales emails using AI. Provide a prompt describing the email's purpose, tone, and audience.",
    viewConfig: {
      submitEndpoint: "/sales/email/generate",
      fields: [
        { key: "prompt", label: "Email Prompt", type: "textarea", required: true, placeholder: "Draft an outreach email about our CNT capabilities." },
        { key: "tone", label: "Tone", type: "select", options: [
          { value: "direct", label: "Direct" }, { value: "friendly", label: "Friendly" },
          { value: "formal", label: "Formal" }, { value: "technical", label: "Technical" },
        ], defaultValue: "direct" },
      ],
      submitLabel: "Generate Email",
    } satisfies FormActionConfig,
    relatedPanels: [{ panelId: "domain_sales", label: "Sales" }],
    quickCalls: withCommonCalls([
      qc("email_drafts", "Drafts", "GET", "/sales/email/drafts"),
      qc("email_generate", "Generate", "POST", "/sales/email/generate", { prompt: "Draft an email about CNT thermal performance." }),
    ]),
  },
  {
    id: "domain_accounts", label: "Accounts", description: "Account data and customer records.", section: "admin",
    viewType: "list-detail", instructions: "Manage financial accounts and records.",
    viewConfig: {
      listEndpoint: "/domains/accounts/items", listKey: "items", idField: "object_id",
      columns: [{ key: "object_id", label: "ID", width: "100px" }, { key: "name", label: "Name" }, { key: "type", label: "Type" }],
      createEndpoint: "/domains/accounts/ingest", createLabel: "Add Account",
      createFields: [{ key: "payload", label: "Account Data (JSON)", type: "json", required: true }],
    } satisfies ListDetailConfig,
    relatedPanels: [{ panelId: "compliance", label: "Compliance" }],
    quickCalls: withCommonCalls([qc("account_items", "Account Items", "GET", "/domains/accounts/items")]),
  },
  {
    id: "quality", label: "Quality", description: "Quality tracking items and summary reports.", section: "admin",
    viewType: "list-detail", instructions: "Track quality checks on experiments and processes. Create PDCA/CAPA items. View overall quality summary.",
    viewConfig: {
      listEndpoint: "/quality/items", listKey: "items", idField: "object_id", detailEndpoint: "/quality/items/{id}",
      columns: [
        { key: "object_id", label: "ID", width: "100px" }, { key: "title", label: "Title" },
        { key: "category", label: "Category" }, { key: "status", label: "Status" }, { key: "severity", label: "Severity" },
      ],
      createEndpoint: "/quality/items", createLabel: "Create Quality Item",
      createFields: [{ key: "payload", label: "Quality Item Data (JSON)", type: "json", required: true, placeholder: '{\n  "title": "...",\n  "category": "PDCA"\n}' }],
    } satisfies ListDetailConfig,
    relatedPanels: [{ panelId: "experiment_form", label: "Experiments" }, { panelId: "measurements", label: "Measurements" }],
    quickCalls: withCommonCalls([
      qc("quality_items", "Quality Items", "GET", "/quality/items"),
      qc("quality_summary", "Quality Summary", "GET", "/quality/summary"),
    ]),
  },
  {
    id: "decisions", label: "Decisions", description: "Decision log and search.", section: "admin",
    viewType: "list-detail", instructions: "Log important decisions with context and rationale. Search similar past decisions to learn from history.",
    tips: ["Every major decision should be logged here.", "Use semantic search to find past decisions relevant to a new one."],
    viewConfig: {
      listEndpoint: "/decisions", listKey: "decisions", idField: "decision_id", detailEndpoint: "/decisions/{id}",
      columns: [
        { key: "decision_id", label: "ID", width: "100px" }, { key: "title", label: "Title" },
        { key: "outcome", label: "Outcome" }, { key: "created_at", label: "Date" },
      ],
      createEndpoint: "/decisions", createLabel: "Log Decision",
      createFields: [{ key: "decision", label: "Decision Data (JSON)", type: "json", required: true, placeholder: '{\n  "title": "Selected MWCNT supplier",\n  "rationale": "Best price-quality"\n}' }],
      searchEndpoint: "/decisions/search", searchResultKey: "results",
      searchFields: [
        { key: "query", label: "Search Query", type: "text", required: true, placeholder: "Describe the decision you're looking for…" },
        { key: "k", label: "Max Results", type: "number", defaultValue: 5 },
      ],
    } satisfies ListDetailConfig,
    relatedPanels: [{ panelId: "narratives", label: "Narratives" }, { panelId: "weekly_plan", label: "Weekly Plan" }, { panelId: "planning", label: "Planning" }],
    quickCalls: withCommonCalls([
      qc("list_decisions", "List Decisions", "GET", "/decisions"),
      qc("search_decisions", "Search Decisions", "POST", "/decisions/search", { query: "" }),
    ]),
  },
  {
    id: "narratives", label: "Narratives", description: "Company narratives and generation.", section: "admin",
    viewType: "form-action", instructions: "Generate AI-powered narrative reports summarizing company activity by scope and period.",
    viewConfig: {
      submitEndpoint: "/narratives/generate",
      fields: [
        { key: "scope", label: "Scope", type: "text", required: true, placeholder: "e.g. company, rnd", defaultValue: "company" },
        { key: "period", label: "Period", type: "text", required: true, placeholder: "e.g. weekly, monthly", defaultValue: "weekly" },
      ],
      submitLabel: "Generate Narrative",
    } satisfies FormActionConfig,
    relatedPanels: [{ panelId: "decisions", label: "Decisions" }, { panelId: "weekly_plan", label: "Weekly Plan" }],
    quickCalls: withCommonCalls([
      qc("list_narratives", "List Narratives", "GET", "/narratives"),
      qc("generate_narrative", "Generate Narrative", "POST", "/narratives/generate", { scope: "company", period: "weekly" }),
    ]),
  },
  {
    id: "planning", label: "Planning", description: "Strategic planning context and recomputation.", section: "admin",
    viewType: "form-action", instructions: "Build strategic planning context. Update constraints, recompute plans, and record assumption changes.",
    viewConfig: {
      submitEndpoint: "/planning/context",
      fields: [
        { key: "scope", label: "Planning Scope", type: "text", required: true, placeholder: "e.g. rnd, company", defaultValue: "rnd" },
        { key: "user_id", label: "User ID (optional)", type: "text" },
      ],
      submitLabel: "Build Planning Context",
    } satisfies FormActionConfig,
    relatedPanels: [{ panelId: "weekly_plan", label: "Weekly Plan" }, { panelId: "decisions", label: "Decisions" }, { panelId: "cognition", label: "Cognition" }],
    quickCalls: withCommonCalls([
      qc("planning_context", "Planning Context", "POST", "/planning/context", {}),
      qc("recompute", "Recompute Plan", "POST", "/planning/recompute", {}),
    ]),
  },
  {
    id: "admin_scaffold", label: "Scaffold / Coming Soon", description: "Admin scaffolding and diagnostics hub.", section: "admin",
    viewType: "runner", instructions: "Advanced diagnostics and scaffolding tools. Use the API Runner below to access RAG diagnostics, history summaries, and operations overview.",
    relatedPanels: [{ panelId: "system_status", label: "System Status" }, { panelId: "telemetry", label: "Telemetry" }],
    quickCalls: withCommonCalls([
      qc("diag_rag", "RAG Diagnostics", "GET", "/diag/rag"),
      qc("history", "History Summary", "GET", "/history/summary"),
      qc("ops", "Ops Overview", "GET", "/ops/overview"),
    ]),
  },
];

/* ── Lookup helpers ────────────────────────────────────────────── */

export function getPanelById(panelId: string): PanelDef | null {
  return PANELS.find((p) => p.id === panelId) || null;
}

export function getPanelsBySection(): Record<PanelSection, PanelDef[]> {
  const out: Record<PanelSection, PanelDef[]> = {
    sources: [], chat: [], diagnostics: [], experiments: [], dataset_training: [], admin: [],
  };
  for (const panel of PANELS) out[panel.section].push(panel);
  return out;
}

/** @deprecated Use getPanelsBySection instead */
export function panelsBySection(): Record<PanelSection, PanelDef[]> {
  return getPanelsBySection();
}
