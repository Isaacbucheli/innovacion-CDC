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

/** Política de la línea base Azure Policy (GET /policy-catalog, backend .NET, snake_case). */
export interface Policy {
  policy_id: number;
  policy_number: number | null;
  name: string;
  category: string | null;
  policy_type: string | null;
  recommended_effect: string | null;
  mode: string | null;
  key_parameters: string | null;
  description: string | null;
  objective: string | null;
  recommended_scope: string | null;
  rollout: string | null;
  risk: string | null;
  example_parameters: string | null;
  azure_cli: string | null;
  powershell: string | null;
  script_notes: string | null;
  official_source: string | null;
  is_active: boolean;
}

// ---- Asignación de consultores (Gestión CDC, backend .NET, snake_case) ----

export type PersonType = "consultor" | "coordinador" | "comercial";

/** Persona del directorio BIT (GET /consultant-assignments/people). */
export interface Person {
  person_id: number;
  name: string;
  email: string | null;
  person_type: PersonType;
  is_active: boolean;
}

/** Referencia embebida a una persona dentro de una asignación. */
export interface PersonRef {
  person_id: number;
  name: string;
}

/** Asignación cliente×servicio (GET /consultant-assignments). */
export interface ConsultantAssignment {
  assignment_id: number;
  client_name: string;
  service: string | null;
  category: string | null; // ALTO / MEDIO / BAJO
  databases: string | null;
  country: string | null;
  status: string | null;
  access_accounts: string | null;
  account_role: string | null;
  lighthouse: string | null;
  client_contact_name: string | null;
  client_contact_phone: string | null;
  client_contact_email: string | null;
  contract_end: string | null; // "YYYY-MM-DD"
  observations: string | null;
  is_active: boolean;
  principals: PersonRef[];
  backups: PersonRef[];
  coordinator: PersonRef | null;
  comercial: PersonRef | null;
}

/** Body de POST/PUT /consultant-assignments: escalares + ids por rol (los arrays REEMPLAZAN el conjunto). */
export interface AssignmentWrite {
  client_name?: string;
  service?: string | null;
  category?: string | null;
  databases?: string | null;
  country?: string | null;
  status?: string | null;
  access_accounts?: string | null;
  account_role?: string | null;
  lighthouse?: string | null;
  client_contact_name?: string | null;
  client_contact_phone?: string | null;
  client_contact_email?: string | null;
  contract_end?: string | null;
  observations?: string | null;
  principal_ids?: number[];
  backup_ids?: number[];
  coordinator_id?: number | null;
  comercial_id?: number | null;
}

export type ReassignScope = "principal" | "backup" | "coordinador" | "comercial";

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
  sku_name: string | null;
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
  ri_eligibility: string | null;
  power_running_hours: number | null;
  power_uptime_pct: number | null;
  power_period_start: string | null;
  power_period_end: string | null;
  calculation_notes: string | null;
  calculated_at: string | null;
}

// ---- FinOps: Fase 1 (integración FinOps Toolkit) ----
export interface FinOpsLookups {
  regions: Record<string, string>;
  resource_types: Record<string, { display_name: string; service_category: string | null }>;
  service_categories: Record<string, string>;
}

export interface CoverageGap {
  resource_type: string;
  display_name: string | null;
  service_category: string | null;
  count: number;
}

export interface CoverageResult {
  total_resources: number;
  costed_resources: number;
  coverage_pct: number;
  uncovered: CoverageGap[];
}

export interface FinOpsRefreshStatus {
  dataset: string;
  refreshed_at: string | null;
  row_count: number | null;
  status: string | null;
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
  has_logo?: boolean;
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
  display_name: string;
  azure_resource_type: string;
  service_category: string;
  detail_table_name: string | null;
  inserter_key: string;
  calculator_key: string;
  kql_query: string;
  ri_applicable: boolean;
  ri_filter_field: string | null;
  ri_filter_values: string | null;
  ri_exclude_values: string | null;
  ahb_applicable: boolean;
  requires_manual_cost: boolean;
  excel_sheet_name: string | null;
  display_order: number;
  is_active: boolean;
  notes: string | null;
  is_internal: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}
export interface ServiceCreateBody {
  service_key: string;
  display_name: string;
  azure_resource_type: string;
  service_category: string;
  inserter_key: string;
  calculator_key: string;
  kql_query: string;
  detail_table_name?: string | null;
  ri_applicable?: boolean;
  ri_filter_field?: string | null;
  ri_filter_values?: string | null;
  ri_exclude_values?: string | null;
  ahb_applicable?: boolean;
  requires_manual_cost?: boolean;
  excel_sheet_name?: string | null;
  display_order?: number;
  is_active?: boolean;
  notes?: string | null;
}
export type ServiceUpdateBody = Partial<Omit<ServiceCreateBody, "service_key">>;

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

/** Respuesta del POST .../power-history/refresh (202, encolado). */
export interface PowerHistoryEnqueue {
  status: string;
  message?: string;
}

/** Estado del job de encendido/apagado (GET .../power-history/status). */
export interface PowerHistoryJobStatus {
  status: string; // "none" | "running" | "completed" | "failed"
  started_at?: string | null;
  finished_at?: string | null;
  summary?: PowerHistoryResult | null;
  error?: string | null;
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
  remediation_end_date: string | null;
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
  remediation_end_date: string | null;
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
  credential_id?: number;
  credential_name?: string | null;
  last_synced_at?: string | null;
}

// ---- Usuarios y perfiles (Administración) ----
export interface PublicUser {
  user_id: number;
  email: string;
  full_name: string;
  role: string; // admin | consultor | lector
  is_active: boolean;
  created_at?: string | null;
}

// ---- Credenciales Azure (Administración) ----
export interface Credential {
  credential_id: number;
  client_id: number;
  credential_name: string;
  tenant_id: string;
  app_client_id: string;
  is_active: boolean;
  last_validation_status: string | null;
  last_validated_at: string | null;
  secret_expires_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}
export interface CredentialAuthResult { success: boolean; expires_on?: string | null; error?: string | null; }
export interface CredentialAudit { audit_id: number; action: string; actor?: string | null; details?: string | null; occurred_at: string; }
export interface SubscriptionSyncSummary {
  created: number; updated: number; deactivated: number; active_total?: number;
  errors?: { credential_id?: number; credential_name?: string; error?: string }[];
}

// ---- Sesión Azure de usuario (Lighthouse: device code + selección de suscripciones) ----
export interface AzureUserSession {
  status: "none" | "pending_device" | "authenticated" | "failed" | "expired";
  user_code?: string | null;
  verification_url?: string | null;
  azure_upn?: string | null;
  error?: string | null;
}

export interface LighthouseSubscription {
  subscription_id: string;
  display_name?: string | null;
}

export interface LighthouseClientGroup {
  tenant_id: string;
  client_name: string;
  subscriptions: LighthouseSubscription[];
}

export interface LighthouseLinkResult {
  client_id: number;
  credential_id: number;
  subscriptions_linked: number;
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

// ---- WAF: Import Excel (Slice B) ----
export interface WafExcelRow {
  row_number: number;
  pillar_number: number | null;
  excel_code: string | null;
  title: string | null;
  raw_scope: string | null;
  completion_pct: number | null;
  remediation_start_date: string | null;
  execution_log: string | null;
  benefit: string | null;
  actions: string | null;
  impact: string | null;
  projected_bit_effort: string | null;
  resources: string[];
  warnings: string[];
}
export interface WafExcelSuggestedMatch {
  canonical_id: number;
  matrix_code: string | null;
  pillar_number: number | null;
  review_scope_es: string | null;
  advisor_name: string | null;
}
export interface WafExcelPreviewRow {
  row: WafExcelRow;
  status: "matched" | "needs_review" | "new";
  can_create: boolean;
  match_source: string | null;
  confidence: number | null;
  reason: string | null;
  suggested_match: WafExcelSuggestedMatch | null;
}
export interface WafExcelPreview {
  file_name: string;
  client_id: number;
  rows_total: number;
  rows_matched: number;
  rows_needs_review: number;
  ai_enabled: boolean;
  rows: WafExcelPreviewRow[];
}
export interface WafExcelApplyItem {
  row_number: number;
  action: "update" | "create";
  approved: boolean;
  canonical_id?: number;
  completion_pct?: number | null;
  remediation_start_date?: string | null;
  execution_log?: string | null;
  pillar_number?: number | null;
  title?: string | null;
  review_scope?: string | null;
  benefit?: string | null;
  actions?: string | null;
  impact?: string | null;
  projected_bit_effort?: string | null;
  resources?: string[];
}
export interface WafExcelApplyRequest { rows: WafExcelApplyItem[]; }
export interface WafExcelApplyResult {
  message: string;
  client_id: number;
  rows_applied: number;
  rows_created: number;
  rows_skipped: number;
  changed_fields: Record<string, number>;
  errors: { row_number: number; detail: string }[];
}

export interface WafCostItem {
  canonical_id: number;
  matrix_code: string | null;
  review_scope_es: string | null;
  business_impact: string | null;
  resources_total: number;
  resources_matched: number;
  resources_priced: number;
  payg_monthly: number;
  ri_1y_monthly: number;
  ri_3y_monthly: number;
}
export interface WafCostReference {
  client_id: number;
  has_cost_data: boolean;
  disclaimer: string;
  message?: string | null;
  analysis_id?: number | null;
  analysis_name?: string | null;
  totals: {
    payg_monthly: number; ri_1y_monthly: number; ri_3y_monthly: number;
    resources_total: number; resources_matched: number; resources_priced: number;
  };
  items: WafCostItem[];
}
export interface WafIngestionRun {
  run_id: number;
  source_file_name: string | null;
  status: string | null;
  rows_total: number | null;
  rows_processed: number | null;
  new_recommendations: number | null;
  new_findings: number | null;
  resolved_findings: number | null;
  started_at: string;
  completed_at: string | null;
  created_by: string | null;
  error_message: string | null;
}

// ---- WAF admin: validación inteligente (curación IA del catálogo) ----
export interface WafAiConfig { configured: boolean; deployment: string | null; api_version: string | null; has_key: boolean; }
export interface WafCanonical {
  canonical_id: number; advisor_name: string; advisor_category: string; pillar_number: number;
  review_scope_es: string; benefit_es: string; client_action_es: string; bit_action_es: string;
  is_excluded: boolean; exclusion_reason: string | null; consolidates_to_id: number | null;
  ai_review_status: string; ai_decision: string | null; ai_confidence: number | null;
  ai_possible_additional_cost: boolean; ai_cost_reason: string | null; ai_exclusion_reason: string | null;
  ai_duplicate_group_key: string | null; ai_reviewed_at: string | null; created_at: string; updated_at: string;
}
export interface WafAiSuggestion {
  decision: string; possible_additional_cost: boolean; cost_reason: string; duplicate_group_key: string;
  pillar_number: number; review_scope_es: string; benefit_es: string; client_action_es: string;
  bit_action_es: string; exclusion_reason: string; confidence: number; raw_model_text: string;
}
export interface WafCanonicalUpdate {
  pillar_number?: number; review_scope_es?: string; benefit_es?: string; client_action_es?: string;
  bit_action_es?: string; is_excluded?: boolean; exclusion_reason?: string | null; ai_review_status?: string;
}
export interface WafAiBatchResult { total: number; processed: number; applied: number; errors: { canonical_id: number; error: string }[]; }

// ---- Informe de gestión mensual ----
export interface ReportListEntry {
  report_id: number;
  year: number;
  month: number;
  status: string; // completed | generating | failed | pending
  is_partial: boolean;
  generated_by: string | null;
  generated_at: string | null;
}
export interface ReportList { client_id: number; reports: ReportListEntry[]; }

export interface GenerateReportResponse {
  client_id: number; year: number; month: number; status: string; message?: string;
}

export interface ReportPeriod { label?: string; year?: number; month?: number; partial?: boolean; start?: string; end?: string; }
export interface ReportMeta { regiones?: string[]; suscripciones?: string[]; }
export interface ReportVmInventory {
  name: string; ip: string | null; status: string; os: string; size: string;
  vcpu: number; ram_gb: number; disks: number; has_backup: boolean; health?: string;
  subscription?: string; location?: string; resource_group?: string;
}
export interface ReportPerfVm {
  resource_name: string; cpu_avg: number; cpu_max: number; ram_avg: number; ram_max: number;
  subscription_name?: string; daily?: { days?: string[]; cpu_avg?: number[]; ram_avg?: number[] };
}
export interface ReportEstadoRecurso { tipo: string; total: number; disponibles: number; con_alerta: number; obs?: string; }
export interface ReportSla { servicio: string; acordado_h: number; caidas_h: number; disponibilidad: string; }
export interface ReportNarrative {
  resumen_ejecutivo?: string; performance_comentario?: string; backups_comentario?: string;
  disponibilidad_comentario?: string; hallazgos?: string[]; conclusiones?: string[]; recomendaciones?: string[];
}

// ---- Reservas Azure por vencer (Gestión CDC) ----
export interface Reservation {
  reservation_id: string;
  credential_id: number;
  name: string;
  product: string;
  region: string;
  quantity: number;
  term: string;
  term_label: string;
  expires_on: string;
  days_remaining: number;
  expired: boolean;
  expiring: boolean;
  state: string;
  applied_scope_type?: string;
  applied_scopes?: string[];
  utilization_last?: string | null;
  utilization7d?: string | null;
}
export interface ReservationsResponse {
  client_id: number;
  alert_days: number;
  has_credentials: boolean;
  total: number;
  expiring_count: number;
  expired_count: number;
  reservations: Reservation[];
  errors: { credential_id?: number; credential_name?: string }[];
  message?: string;
  generated_at?: string;
}
export interface ReservationConsumer {
  instance_id?: string;
  resource_name: string;
  resource_group?: string | null;
  subscription_id?: string | null;
  subscription_name?: string | null;
  sku_name?: string | null;
  used_hours?: number | null;
  last_seen?: string | null;
  days_seen?: number | null;
}

// ---- Optimización Azure (barrido del tenant) ----
export type FindingState = "abierto" | "en_progreso" | "resuelto" | "ignorado";

/** Hallazgo del barrido (GET /optimization/scans/{id}/findings). */
export interface OptFinding {
  check_id: string;
  category: string; // "cost_waste" | "governance"
  severity: string; // "high" | "medium" | "low"
  subscription_id: string;
  azure_resource_id: string;
  resource_name: string | null;
  resource_type: string | null;
  region: string | null;
  details: Record<string, unknown>;
  estimated_monthly_savings: number | null;
  currency: string;
  fingerprint: string; // hex
  state: FindingState;
  notes: string | null;
}

/** Barrido histórico (GET /optimization/clients/{id}/scans). */
export interface OptScan {
  scan_id: number;
  started_at: string;
  finished_at: string | null;
  status: string; // "running" | "completed" | "failed"
  subscriptions_scanned: number;
  findings_count: number;
  total_estimated_monthly_savings: number | null;
  currency: string;
}

/** Resumen que devuelve POST /optimization/clients/{id}/scan. */
export interface OptScanSummary {
  scan_id: number;
  findings_count: number;
  subscriptions_scanned: number;
  total_estimated_monthly_savings: number;
  errors: unknown[];
  new: number;
  persisting: number;
  auto_resolved: number;
}

// El JSON del informe es amplio; se tipa por secciones a medida que se implementan.
export interface MonthlyReport {
  schema_version?: number;
  client?: { name?: string | null };
  period?: ReportPeriod;
  generated_at?: string;
  meta?: ReportMeta;
  inventario?: ReportVmInventory[];
  performance?: { virtual_machines?: ReportPerfVm[]; app_service_plans?: unknown[] };
  estado_recursos?: ReportEstadoRecurso[];
  backups?: { items?: unknown[]; vaults?: unknown[]; jobs_mes?: Record<string, number> };
  sla?: ReportSla[];
  narrative?: ReportNarrative;
  sections?: Record<string, boolean>;
  [key: string]: unknown;
}
