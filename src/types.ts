export type Role = "admin" | "consultor" | "lector";

export interface Alert {
  alert_id: number;
  alert_number: number | null;
  name: string;
  resource: string | null;
  alert_type: string | null;
  description: string | null;
  severity: string | null;
  origin: string | null;
  detail: string | null;
  action_group: string | null;
  kql_code: string | null;
  technical_requirement: string | null;
  is_active: boolean;
}

export interface KqlQuery {
  kql_id: number;
  name: string;
  description: string | null;
  kql_query: string | null;
  is_active: boolean;
}

// ---- Módulo de costos (servido por el backend .NET del stack nuevo) ----

/** Una fila de resultado de costo. Refleja CostResultRow del backend .NET (snake_case). */
export interface CostResult {
  cost_result_id: number;
  resource_id: number;
  service_key: string | null;
  resource_name: string | null;
  resource_type: string | null;
  location: string | null;
  subscription_name: string | null;
  resource_group: string | null;
  azure_resource_id: string | null;
  payg_hourly: number | null;
  payg_monthly: number | null;
  ri_1y_monthly: number | null;
  ri_3y_monthly: number | null;
  savings_1y_pct: number | null;
  savings_3y_pct: number | null;
  savings_1y_monthly: number | null;
  savings_3y_monthly: number | null;
  sql_addon_monthly: number | null;
  ahb_discount_monthly: number | null;
  storage_monthly: number | null;
  calculation_status: string | null;
  is_variable_pricing: boolean | null;
  is_manual_cost: boolean | null;
  manual_monthly_cost: number | null;
  manual_cost_note: string | null;
  ri_applies: boolean | null;
  ri_not_applicable_reason: string | null;
  ri_coverage: string | null;
  ri_reservation_name: string | null;
  ri_term: string | null;
  power_running_hours: number | null;
  power_uptime_pct: number | null;
  power_period_start: string | null;
  power_period_end: string | null;
  calculation_notes: string | null;
  calculated_at: string | null;
}

export interface ScenarioConfig {
  use_ri_1y: boolean;
  use_ri_3y: boolean;
  eliminate_stopped_vm_disks: boolean;
  eliminate_orphan_disks: boolean;
  eliminate_orphan_ips: boolean;
}

export interface ScenarioBreakdown {
  service_key: string | null;
  line_label: string | null;
  monthly_cost: number;
  note: string | null;
}

/** Un escenario calculado. Refleja ScenarioReadDto del backend .NET. */
export interface Scenario {
  scenario_id: number;
  number: number;
  name: string | null;
  description: string | null;
  total_monthly: number;
  total_annual: number;
  savings_monthly: number;
  savings_annual: number;
  savings_pct: number;
  config: ScenarioConfig;
  calculated_at: string | null;
  breakdown: ScenarioBreakdown[];
}

/** Cliente (GET /clients, backend .NET). */
export interface ClientSummary {
  client_id: number;
  client_name: string;
}

/** Cliente con metadatos de administración (GET /clients, backend .NET). */
export interface ClientAdmin {
  client_id: number;
  client_name: string;
  tax_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  is_active: boolean;
  created_at: string | null;
  has_logo: boolean;
}

/** Análisis/evaluación (GET /analysis y POST /analysis/client/{id}/current, backend .NET). */
export interface AnalysisSummary {
  analysis_id: number;
  analysis_name: string;
  client_id?: number;
}

/** Servicio del catálogo activo (GET /service-catalog/active, backend .NET). */
export interface ServiceCatalogItem {
  service_key: string;
  service_name?: string | null;
  is_internal?: boolean | null;
}

// ---- Escrituras de costos (backend .NET) ----

export interface CalculateRequest {
  service_keys?: string[];
  auto_build_scenarios?: boolean;
  resource_offset?: number;
  resource_limit?: number;
  replace_existing?: boolean;
}

export interface CalculateResponse {
  analysis_id: number;
  summary?: Record<string, { has_more?: boolean }>;
  error?: string;
  scenarios_error?: string;
}

export interface RiCoverageResult {
  confirmed_count?: number;
  estimated?: { estimated_units?: number }[];
  source?: string;
}

export interface PowerHistoryResult {
  updated_count?: number;
  vms_with_events?: number;
  period_start?: string;
  source?: string;
}

/** Fila del resumen de inventario (GET /azure/import/inventory/{id}/summary). */
export interface InventoryRow {
  service_category: string | null;
  resource_type: string | null;
  count: number | null;
}

// ---- WAF (Matriz mejoras Azure) ----
export interface WafSummary {
  client_id: number;
  recommendations: number;
  active_recommendations: number;
  cost_recommendations: number;
  active_findings: number;
  latest_ingestion: { source_file_name?: string | null; completed_at?: string | null; status?: string | null } | null;
}

export interface WafSection {
  section_num: number;
  section_name: string;
  total_recs: number;
  total_resources: number;
  avg_progress: number;
  high_recs: number;
  medium_recs: number;
}

export interface WafRecommendation {
  canonical_id: number;
  matrix_code: string;
  pillar_number: number;
  review_scope_es: string | null;
  business_impact: string | null;
  resource_count: number;
  completion_pct: number;
}

export interface WafRecommendationDetail extends WafRecommendation {
  benefit_es: string | null;
  client_action_es: string | null;
  bit_action_es: string | null;
  remediation_start_date: string | null;
  projected_bit_effort: string | null;
  execution_log: string | null;
  priority_override: number | null;
  internal_notes: string | null;
}

export interface WafResource {
  finding_id: number;
  resource_name: string;
  resource_type: string | null;
  resource_group: string | null;
  subscription_name: string | null;
  status: string;
}

export interface WafComment {
  comment_id: number;
  user_display: string;
  comment_text: string;
  created_at: string;
}

export interface WafHistoryEntry {
  history_id: number;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface WafTrackingUpdate {
  completion_pct: number;
  remediation_start_date: string | null;
  projected_bit_effort: string | null;
  execution_log: string | null;
  priority_override: number | null;
  internal_notes: string | null;
}

/** Advisor Score por pilar (GET /waf/clients/{id}/advisor-score, backend .NET). */
export interface WafAdvisorScore {
  has_connection: boolean;
  pillars: Record<string, number>;
}

/** Suscripción del cliente (GET /azure/subscriptions?client_id=, backend .NET). */
export interface ClientSubscription {
  client_subscription_id: number;
  subscription_id: string;
  subscription_name: string | null;
  is_active: boolean;
  is_managed: boolean;
}

/** Request de sync con Azure Advisor (POST /waf/clients/{id}/advisor-sync). */
export interface WafAdvisorSyncRequest {
  subscriptions: string[];
  timeout_seconds_per_subscription?: number;
}

/** Resultado (síncrono) del sync con Advisor. */
export interface WafAdvisorSyncResult {
  run_id: number;
  status: string;
  subscriptions_queued: number;
  subscriptions_processed: number;
  subscriptions_failed: number;
  new_recommendations: number;
  new_findings: number;
  resolved_findings: number;
  warnings?: string[];
}

/** Resultado de consolidar duplicados (POST /waf/clients/{id}/consolidate-duplicates). */
export interface WafConsolidateResult {
  message: string;
  client_id: number;
  merged: number;
  ai_calls: number;
}

/** Resultado de refrescar Advisor Score (POST /waf/admin/advisor-score/refresh). */
export interface WafScoreRefreshResult {
  message: string;
  clients_total: number;
  clients_refreshed: number;
  clients_failed: number;
  results: { client_id: number; status: string; snapshot_date: string | null; captured_at: string | null; subscriptions_scored: number }[];
}
