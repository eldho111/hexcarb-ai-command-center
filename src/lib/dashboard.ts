export type DashboardTone = "info" | "success" | "warning" | "critical";
export type DashboardRange = "30d" | "90d" | "365d";
export type DashboardAnalyticsState = "ready" | "empty" | "needs_data";

export type DashboardAlert = {
  id: string;
  title: string;
  detail?: string;
  severity: DashboardTone;
  href?: string;
};

export type DashboardListItem = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  status?: string;
  href?: string;
  tone?: DashboardTone;
};

export type DashboardModuleState = {
  ok: boolean;
  endpoint_count: number;
  success_count: number;
  error: string | null;
};

export type DashboardSeriesPoint = {
  key: string;
  label: string;
  start_at: string;
  end_at: string;
};

export type DashboardFinancePoint = DashboardSeriesPoint & {
  income: number;
  expense: number;
  net: number;
};

export type DashboardSalesPoint = DashboardSeriesPoint & {
  inquiries: number;
  qualified_pipeline: number;
  revenue: number;
};

export type DashboardRndPoint = DashboardSeriesPoint & {
  experiments: number;
  measurements: number;
};

export type DashboardPilotPlantPoint = DashboardSeriesPoint & {
  quantity: number;
  run_count: number;
  unit: string;
};

export type DashboardStageCount = {
  stage: string;
  count: number;
};

export type DashboardInventoryBucket = {
  label: string;
  unit: string;
  quantity: number;
  item_count: number;
  low_stock_count: number;
};

export type DashboardDataQuality = {
  invalidFinance: number;
  invalidSalesRevenue: number;
  invalidSalesInquiries: number;
  untaggedInventory: number;
  mixedUnitNanotubeGroups: number;
  invalidProductionRuns: number;
};

export type DashboardInboxSummary = {
  unread_count: number;
  urgent_count: number;
  approvals_count: number;
  notifications_count: number;
  messages_count: number;
  approvals: DashboardListItem[];
  notifications: DashboardListItem[];
  messages: DashboardListItem[];
};

export type CompanyStatusLane = {
  tone: DashboardTone;
  headline: string;
  item_count: number;
  top_items: string[];
};

export type CompanyStatusBet = {
  title: string;
  tone: DashboardTone;
  headline: string;
  item_count: number;
  item_ids: string[];
  top_items: string[];
  lifecycles: string[];
};

export type CompanyStatusSummary = {
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

export type DashboardFilters = {
  selected_range: DashboardRange;
  available_ranges: DashboardRange[];
};

export type DashboardFinanceSummary = {
  state: DashboardAnalyticsState;
  currency: "INR";
  income_total: number;
  expense_total: number;
  net_total: number;
  trend: DashboardFinancePoint[];
  recent_entries: DashboardListItem[];
};

export type DashboardSalesSummary = {
  state: DashboardAnalyticsState;
  revenue_state: DashboardAnalyticsState;
  inquiries_total: number;
  pipeline_total: number;
  qualified_total: number;
  revenue_total: number;
  momentum: DashboardSalesPoint[];
  stage_mix: DashboardStageCount[];
  recent_inquiries: DashboardListItem[];
  recent_pipeline: DashboardListItem[];
};

export type DashboardProductionSummary = {
  state: DashboardAnalyticsState;
  tagged_item_count: number;
  nanotube_units: DashboardInventoryBucket[];
  low_stock_items: DashboardListItem[];
};

export type DashboardPilotPlantSummary = {
  state: DashboardAnalyticsState;
  run_count: number;
  total_quantity: number;
  units: string[];
  trend: DashboardPilotPlantPoint[];
  recent_runs: DashboardListItem[];
};

export type DashboardRndPulseSummary = {
  state: DashboardAnalyticsState;
  experiments_total: number;
  measurements_total: number;
  drafts_total: number;
  sources_total: number;
  training_ready: boolean;
  training_state: string;
  momentum: DashboardRndPoint[];
};

export interface CompanyDashboardSnapshot {
  ok: true;
  generated_at: string;
  company_name: string;
  filters: DashboardFilters;
  modules: Record<string, DashboardModuleState>;
  hero: {
    company_name: string;
    subtitle: string;
    engine_status: string;
    module_errors: number;
  };
  company_status: CompanyStatusSummary | null;
  kpis: {
    active_projects: number;
    overdue_tasks: number;
    stalled_tasks: number;
    approvals_pending: number;
    compliance_due_soon: number;
    funding_opportunities: number;
    unread_notifications: number;
    indexed_chunks: number;
  };
  alerts: DashboardAlert[];
  today: {
    focus_now: string[];
    next_plans: DashboardListItem[];
    blocked_items: DashboardListItem[];
    risk_items: DashboardListItem[];
  };
  execution: {
    weekly_tasks: DashboardListItem[];
    goals_count: number;
    tasks_count: number;
    project_count: number;
    overdue_count: number;
    stalled_count: number;
  };
  operations: {
    compliance_due: DashboardListItem[];
    approvals: DashboardListItem[];
    notifications: DashboardListItem[];
    finance_count: number;
    quality: {
      open_deviations: number;
      overdue_actions: number;
      total_items: number;
      counts_by_status: Record<string, number>;
    };
  };
  inbox: DashboardInboxSummary;
  finance: DashboardFinanceSummary;
  growth: {
    lead_status: {
      available: boolean;
      row_count: number;
      focus: string;
      exported_at: string | null;
      warning: string | null;
    };
    funding_count: number;
    latest_funding: DashboardListItem[];
    news_count: number;
    latest_news: DashboardListItem[];
    sales_count: number;
  };
  sales: DashboardSalesSummary;
  production: DashboardProductionSummary;
  pilotPlant: DashboardPilotPlantSummary;
  rnd: {
    experiments_count: number;
    draft_count: number;
    measurement_count: number;
    training_ready: boolean;
    training_state: string;
    indexed_chunks: number;
    source_count: number;
  };
  rndPulse: DashboardRndPulseSummary;
  dataQuality: DashboardDataQuality;
  engine: {
    mode: string;
    gpu_available: boolean;
    compute_mode: string;
    ollama_reachable: boolean;
    embedding_model_present: boolean;
    available_ram_gb: number | null;
    memory_used_percent: number | null;
    current_serving_model: string | null;
    base_model: string | null;
    adapter_version: string | null;
    adapted_model_active: boolean;
    missing_adapters: number;
    registry_warning: string | null;
    recovery_hint: string | null;
    dependency_states: DashboardListItem[];
    recent_failures: DashboardListItem[];
    tools_health: DashboardListItem[];
    module_errors: string[];
  };
  activity: {
    decisions: DashboardListItem[];
    narratives: DashboardListItem[];
    messages: DashboardListItem[];
    notifications: DashboardListItem[];
  };
}
