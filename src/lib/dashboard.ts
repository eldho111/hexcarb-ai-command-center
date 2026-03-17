export type DashboardTone = "info" | "success" | "warning" | "critical";

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

export interface CompanyDashboardSnapshot {
  ok: true;
  generated_at: string;
  company_name: string;
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
  rnd: {
    experiments_count: number;
    draft_count: number;
    measurement_count: number;
    training_ready: boolean;
    training_state: string;
    indexed_chunks: number;
    source_count: number;
  };
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
