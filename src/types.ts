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
  // Seguridad gestionada externamente (Gestión de Vulnerabilidades): la tarjeta conserva el score
  // pero oculta el conteo y muestra esta nota.
  managed_externally?: boolean;
  managed_note?: string | null;
}

export interface WafRecommendation {
  canonical_id: number;
  matrix_code: string;
  pillar_number: number;
  review_scope_es: string | null;
  // Título tal cual viene de Azure Advisor. null = no hay original (canónica de Excel/legacy, o
  // cliente que aún no corre un sync): ahí el modo inglés cae a la traducción con IA.
  advisor_name_en: string | null;
  business_impact: string | null;
  resource_count: number;
  completion_pct: number;
  remediation_end_date: string | null;
  is_new: boolean;
  source: string | null;
}

/** Opción del filtro por suscripción; sale de los hallazgos, no de las suscripciones registradas. */
export interface WafSubscriptionOption {
  subscription_id: string;
  subscription_name: string;
  recommendations: number;
  resources: number;
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
  /** Solo con filtro de suscripciones: false = el snapshot no trae breakdown y el score es global. */
  filter_applied?: boolean;
}

/** Historial del Advisor Score (GET /waf/clients/{id}/advisor-score/history). */
export interface WafScoreHistoryPoint {
  date: string;
  global: number | null;
  pillars: Record<string, number | null>;
}
export interface WafScoreHistory {
  granularity: string;
  series: WafScoreHistoryPoint[];
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
  must_change_password?: boolean; // contraseña temporal pendiente de cambio en el primer login
  is_super_admin?: boolean; // protegido (SUPERADMIN_EMAILS): no editable/eliminable por otros
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

/** Estado persistido del trabajo de sincronización con Advisor. */
export interface WafAdvisorSyncResult {
  active: boolean;
  created?: boolean;
  job_id: number;
  client_id: number;
  run_id: number | null;
  status: string;
  subscriptions_total: number;
  subscriptions_queued: number;
  subscriptions_processed: number;
  subscriptions_failed: number;
  current_subscription?: string | null;
  new_recommendations: number;
  new_findings: number;
  resolved_findings: number;
  warnings?: unknown[];
  error?: string | null;
  started_at?: string;
  completed_at?: string | null;
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
/** Resultado del sync de Advisor para una suscripción (dentro de una corrida). */
export interface SubscriptionSyncResult {
  subscription_id: string;
  subscription_name: string;
  credential_name?: string | null;
  status: "ok" | "partial" | "error";
  error?: string | null;
  // Fidelidad con el portal de Advisor (2026-07-21). Ausentes en corridas antiguas.
  defender_check?: "ok" | "unavailable" | null;
  defender_resolved_skipped?: number | null;
  suppressed_skipped?: number | null;
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
  /** Detalle por suscripción del sync de Advisor; null en corridas antiguas o CSV. */
  subscription_results?: SubscriptionSyncResult[] | null;
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

// ---- Informe: vista gerencial (dashboard ejecutivo) ----
export interface SemaforoDomain {
  dominio: string; etiqueta: string; estado: string; lectura: string; criterio: string;
  detalle?: Record<string, unknown>;
}
export interface Semaforo {
  umbral_presion: number; estado_general: string; dominios: SemaforoDomain[];
}
export interface ExecutiveNarrative {
  titular?: string; sintesis?: string; lectura_dominios?: Record<string, string>;
  generated_at?: string; generated_by?: string;
}
export interface ExecutivePayload {
  client?: { name?: string | null }; period?: ReportPeriod;
  semaforo?: Semaforo; narrative?: ExecutiveNarrative | null; status?: string;
}
export interface ActionPlanItem {
  item_id?: number; prioridad: string; hallazgo: string; accion?: string | null;
  responsable?: string | null; estado: string; orden?: number; updated_by?: string | null;
}
export interface ActionPlanItemWrite {
  prioridad: string; hallazgo: string; accion: string | null;
  responsable: string | null; estado: string; orden: number;
}
export interface ActionPlanResponse {
  items: ActionPlanItem[]; defaults: ActionPlanItem[]; can_edit: boolean;
  estados: string[]; prioridades: string[];
}

// ── Revisión de accesos (Gestión CDC) ──────────────────────
export interface AccessReviewKpis {
  total_asignaciones: number;
  global_admins: number;
  global_admins_sin_mfa: number;
  internos_sin_mfa: number;
  cuentas_deshabilitadas: number;
  cuentas_inactivas: number;
  guests_total: number;
  guests_inactivos: number;
  guests_inactivos_con_permisos: number;
  service_principals: number;
  // Los de privilegio solo dependen de ARM (se miden siempre); los de externos dependen de Graph.
  cuentas_unicas: number;
  asignaciones_elevadas: number;
  pct_elevadas: number;
  owners: number;
  cuentas_externas: number;
  owners_externos: number;
  roles_personalizados: number;
  /** Accesos con alerta y sin decisión registrada: la cola de trabajo real del módulo.
   *  Solo depende de ARM + decisiones, así que se mide aunque la fase Graph haya fallado. */
  pendientes_de_revisar: number;
}

/** Decisión registrada sobre un acceso efectivo (o sobre un hallazgo de umbral). */
export type AccessDecisionValue = "mantener" | "revocar" | "justificado";

/** Ítem del lote que se manda a guardar. La clave de la decisión la calcula el backend a partir de
 *  principal + rol + scope: el front nunca la deriva. */
export interface AccessDecisionItem {
  principal_object_id: string;
  role_definition_id: string;
  scope: string;
  decision: AccessDecisionValue;
  note?: string | null;
}

/** owner | otorga_accesos | escritura_total | escritura_servicio | lectura, o null si no se pudo clasificar. */
export type AccessRoleClass =
  | "owner" | "otorga_accesos" | "escritura_total" | "escritura_servicio" | "lectura" | null;

/** ARM devuelve más tipos que estos tres; el `(string & {})` evita que un tipo nuevo rompa el build. */
export type AccessPrincipalType =
  | "User" | "Group" | "ServicePrincipal" | "ForeignGroup" | "Device" | "Unknown" | (string & {});

export type AccessFindingSeverity = "critica" | "alta" | "media" | "informativa";

/** Hallazgo de una corrida. `evaluable: false` = la regla depende de datos que no se midieron;
 *  en ese caso los conteos van en 0 y NO deben leerse como "sin hallazgos". */
export interface AccessFinding {
  key: string;
  severity: AccessFindingSeverity;
  title: string;
  detail: string;
  recommendation: string;
  evaluable: boolean;
  not_evaluable_reason: string | null;
  affected_accounts: number;
  affected_assignments: number;
  /** Ids de principal afectados: el front filtra la tabla de Cuentas por esta lista. Vacío en las
   *  reglas de práctica (porcentajes), que no tienen culpables individuales. */
  affected_principals: string[];
  /** Aceptación a nivel de hallazgo: solo para las reglas de umbral, que no tienen accesos
   *  individuales que marcar. Un hallazgo aceptado deja de estar abierto. */
  accepted: boolean;
  accepted_note: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  /** Porcentaje del tenant que la regla pudo evaluar. Solo lo trae la regla de segregación de
   *  ambientes, que depende de inferir el ambiente del nombre de la suscripción; null en el resto. */
  coverage_pct: number | null;
}

/** Una cuenta (principal) con sus asignaciones efectivas agregadas — la agregación la hace el backend. */
export interface AccessAccount {
  principal_object_id: string;
  principal_type: AccessPrincipalType;
  display_name: string | null;
  login: string | null;
  user_type: string | null;
  /** null = no medido (sin Graph, o tipo sin UPN que mirar). */
  is_external: boolean | null;
  total_assignments: number;
  owner: number;
  otorga_accesos: number;
  escritura_total: number;
  escritura_servicio: number;
  lectura: number;
  sin_clasificar: number;
  subscriptions: number;
  broadest_scope_level: string;
  via: "directo" | "grupo" | "ambos";
  account_enabled: boolean | null;
  last_sign_in: string | null;
  mfa_status: "enabled" | "disabled" | "unavailable" | null;
  orphan: boolean;
  /** Resumen de decisiones de los accesos de esta cuenta (lo agrega el backend). */
  decision_pendientes: number;
  decision_mantener: number;
  decision_revocar: number;
  decision_justificado: number;
}

export interface AccessCredentialStatus {
  credential_id: number;
  credential_name: string | null;
  arm_status: "ok" | "error";
  graph_status: "ok" | "sin_consent" | "sin_licencia_p1" | "error" | "no_aplica";
  detail: string | null;
}

export interface AccessAssignment {
  subscription_id: string;
  subscription_name: string | null;
  /** Suscripciones que alcanza este acceso: >1 solo en asignaciones heredadas (MG o root). */
  subscriptions_reached?: number;
  scope: string;
  scope_level: "management_group" | "subscription" | "resource_group" | "resource" | "root";
  role_name: string;
  role_definition_id: string;
  role_class: AccessRoleClass;
  is_custom_role: boolean;
  is_elevated: boolean;
  /** null = no medido (sin Graph, o tipo sin UPN que mirar). */
  is_external: boolean | null;
  principal_object_id: string;
  principal_type: AccessPrincipalType;
  display_name: string | null;
  login: string | null;
  user_type: "Member" | "Guest" | null;
  via_group_id: string | null;
  via_group_name: string | null;
  account_enabled: boolean | null;
  last_sign_in: string | null;
  mfa_status: "enabled" | "disabled" | "unavailable" | null;
  /** Decisión vigente sobre este acceso (vive por cliente, no por corrida: sobrevive a la
   *  re-sincronización). null = pendiente. */
  decision: AccessDecisionValue | null;
  decision_note: string | null;
  decision_decided_by: string | null;
  decision_decided_at: string | null;
  /** Corridas transcurridas desde que se decidió. 0 = se decidió en la corrida actual. */
  decision_runs_since: number | null;
  /** produccion | preproduccion | desarrollo | desconocido. Inferido del nombre de la suscripción
   *  por el backend: el front no clasifica ambientes, solo presenta. */
  environment: string;
  /** El acceso no existía en la corrida anterior (lo decide el delta del backend). */
  is_new: boolean;
}

export interface AccessGuest {
  object_id: string;
  display_name: string | null;
  email: string | null;
  external_domain: string | null;
  account_enabled: boolean;
  external_state: string | null;
  created_at_azure: string | null;
  last_sign_in: string | null;
  roles_in_subs: string | null;
  mfa_status: "enabled" | "disabled" | "unavailable" | null;
}

export interface AccessGlobalAdmin {
  object_id: string;
  display_name: string | null;
  upn: string | null;
  user_type: string | null;
  account_enabled: boolean | null;
  last_sign_in: string | null;
  mfa_status: "enabled" | "disabled" | "unavailable" | null;
}

export interface AccessReviewRun {
  run_id: number;
  status: "queued" | "running" | "ok" | "partial" | "error";
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  requested_by: string | null;
}

/** Cambios respecto de la corrida anterior. Lo calcula el backend comparando snapshots completos:
 *  el front no diferencia nada, solo presenta. `has_previous: false` es la primera corrida del
 *  cliente — no hay novedad que mostrar, que no es lo mismo que "no cambió nada". */
export interface AccessReviewDelta {
  has_previous: boolean;
  previous_run_id: number | null;
  previous_finished_at: string | null;
  /**
   * Cada eje se compara solo si su insumo se leyó completo en LAS DOS corridas. Cuando es false los
   * campos del eje vienen en null: es "no comparable", que no es lo mismo que "no cambió". Comparar
   * contra una corrida parcial hacía que la franja afirmara altas y bajas que nadie hizo.
   * Opcionales porque una corrida servida por una API anterior a este cambio no los trae.
   */
  accesos_comparables?: boolean;
  directorio_comparable?: boolean;
  nuevos_accesos: number | null;
  accesos_removidos: number | null;
  nuevos_global_admins: string[] | null;
  global_admins_removidos: string[] | null;
  nuevos_guests: number | null;
  guests_removidos: number | null;
  /** Principals con al menos un acceso nuevo: para filtrar la pestaña Cuentas. */
  nuevos_principals: string[];
}

export interface AccessReviewResponse {
  status: "none" | "queued" | "running" | "ok" | "partial" | "error";
  run_id?: number;
  started_at?: string | null;
  finished_at?: string | null;
  inactivity_days?: number;
  /** Lo decide el backend: si la fase Graph se leyó completa para todas las credenciales. */
  graph_complete?: boolean;
  delta?: AccessReviewDelta;
  kpis?: AccessReviewKpis;
  findings?: AccessFinding[];
  credentials?: AccessCredentialStatus[];
  accounts?: AccessAccount[];
  assignments?: AccessAssignment[];
  guests?: AccessGuest[];
  global_admins?: AccessGlobalAdmin[];
}

// ---- Pendientes y bloqueantes (Gestión CDC) ----
// El dato vive en la BD del tablero "Seguimiento CDC", no en la de la plataforma: la SWA original
// sigue escribiendo las mismas tablas. De ahí `actualizado`, que viaja de vuelta en la edición como
// token de concurrencia optimista.

export type PendienteArea = "CDC" | "INFRA";
export type PendienteTipo = "PENDIENTE" | "BLOQUEANTE";
export type PendientePrioridad = "ALTA" | "MEDIA" | "BAJA";
/** Con guion bajo: es el valor exacto de la BD, aunque la UI muestre "En progreso". */
export type PendienteEstado = "ABIERTO" | "EN_PROGRESO" | "CERRADO";

export interface PendienteNota {
  hist_id: number;
  fecha: string | null;
  nota: string;
  autor: string | null;
  /** Orden de inserción: el timeline se rige por esto, NO por la fecha. */
  orden: number;
}

export interface PendienteCliente {
  num: number;
  cliente: string;
  servicio: string | null;
  categoria: string | null;
  pais: string | null;
  coordinador: string | null;
  consultor: string | null;
}

export interface PendienteItem {
  id: string;
  cliente_num: number;
  /** Vacío en casi todos los registros reales: la descripción es el contenido. */
  titulo: string | null;
  descripcion: string | null;
  tipo: PendienteTipo | null;
  prioridad: PendientePrioridad | null;
  estado: PendienteEstado | null;
  responsable: string | null;
  fecha_creacion: string | null;
  actualizado: string;
  historial: PendienteNota[];
}

export interface PendientesPayload {
  area: string;
  clientes: PendienteCliente[];
  pendientes: PendienteItem[];
}

export interface PendienteWrite {
  cliente_num: number;
  titulo?: string | null;
  descripcion?: string | null;
  tipo?: string | null;
  prioridad?: string | null;
  estado?: string | null;
  responsable?: string | null;
  /** Obligatorio al editar: el `actualizado` que traía la fila leída. */
  actualizado?: string | null;
}

export interface PendienteClienteWrite {
  cliente: string;
  servicio?: string | null;
  categoria?: string | null;
  pais?: string | null;
  coordinador?: string | null;
  consultor?: string | null;
}

// ---- Boletín Azure ----
export interface BoletinResource {
  fingerprint: string;
  subscription_id: string;
  resource_id: string | null;
  resource_name: string;
  resource_type: string;
}
export interface BoletinGroup {
  source: "advisor" | "service_health";
  announcement_key: string;
  title: string;
  retiring_feature: string;
  retirement_date: string | null; // yyyy-MM-dd
  urgency: "retirado" | "proximo" | "programado" | "sin_fecha";
  recommended_action: string | null;
  learn_more_url: string | null;
  summary: string | null;
  resource_count: number;
  subscription_ids: string[];
  resources: BoletinResource[];
}
export interface BoletinKpis {
  announcements: number;
  due_soon: number;
  already_retired: number;
  resources: number;
  subscriptions_impacted: number;
  subscriptions_total: number;
}
export interface BoletinSyncInfo {
  id: number;
  status: string;
  started_at: string;
  finished_at: string | null;
  subscriptions_scanned: number;
  advisor_items: number;
  health_items: number;
  error: string | null;
}
export interface BoletinSubscription {
  subscription_id: string;
  name: string;
}
export interface BoletinView {
  last_sync: BoletinSyncInfo | null;
  kpis: BoletinKpis;
  groups: BoletinGroup[];
  subscriptions: BoletinSubscription[];
}
