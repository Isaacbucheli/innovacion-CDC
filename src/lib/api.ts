import type {
  Alert,
  AnalysisSummary,
  AssignmentWrite,
  AzureUserSession,
  BoletinView,
  CalculateRequest,
  CalculateResponse,
  ClientAdmin,
  ClientSubscription,
  ClientSummary,
  ConsultantAssignment,
  CostResult,
  CoverageResult,
  FinOpsLookups,
  FinOpsRefreshStatus,
  InventoryRow,
  KqlQuery,
  LighthouseClientGroup,
  LighthouseLinkResult,
  PendienteClienteWrite,
  PendientesPayload,
  PendienteWrite,
  Person,
  Policy,
  PowerHistoryEnqueue,
  PowerHistoryJobStatus,
  ReassignScope,
  RiCoverageResult,
  Role,
  Scenario,
  ServiceCatalogItem,
  ServiceCreateBody,
  ServiceUpdateBody,
  WafAdvisorScore,
  WafAdvisorSyncRequest,
  WafAdvisorSyncResult,
  WafAiBatchResult,
  WafAiConfig,
  WafAiSuggestion,
  WafCanonical,
  WafCanonicalUpdate,
  WafComment,
  WafConsolidateResult,
  WafCostReference,
  WafExcelApplyRequest,
  WafExcelApplyResult,
  WafExcelPreview,
  WafHistoryEntry,
  WafIngestionRun,
  WafRecommendation,
  WafRecommendationDetail,
  WafResource,
  WafScoreHistory,
  WafScoreRefreshResult,
  WafSection,
  WafSubscriptionOption,
  WafSummary,
  WafTrackingUpdate,
  ReportList,
  MonthlyReport,
  ExecutivePayload,
  Semaforo,
  ExecutiveNarrative,
  ActionPlanResponse,
  ActionPlanItem,
  ActionPlanItemWrite,
  GenerateReportResponse,
  ReservationsResponse,
  ReservationConsumer,
  Credential,
  CredentialAuthResult,
  CredentialAudit,
  SubscriptionSyncSummary,
  PublicUser,
  OptFinding,
  OptScan,
  OptScanSummary,
  FindingState,
  AccessReviewResponse,
  AccessReviewRun,
  AccessDecisionItem,
} from "@/types";
import { clearSession, getToken, setEmail, setSession } from "@/lib/auth";

// Backend ÚNICO de la plataforma: la API .NET. En DEV se usa el proxy de Vite (/api → API .NET local).
// En prod el host sale de VITE_API_BASE_URL, cuya fuente ÚNICA es .env.production (ver
// scripts/gen-swa-config.mjs, que usa el mismo valor para el connect-src del CSP). Sin fallback
// hardcodeado a propósito: si faltara, preferimos fallar claro y no apuntar a un host silencioso.
export function apiBase(): string {
  if (import.meta.env.DEV) return "/api";
  const base = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!base) {
    throw new Error(
      "VITE_API_BASE_URL no está definido en el build de producción (revisa .env.production).",
    );
  }
  return base;
}

export async function request<T>(path: string, opts: RequestInit = {}, base: string = apiBase()): Promise<T> {
  const headers = new Headers(opts.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${base}${path}`, { ...opts, headers });
  if (res.status === 401) {
    clearSession();
    if (typeof location !== "undefined") location.reload();
    throw new Error("Sesión expirada");
  }
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try { detail = JSON.parse(text).detail ?? text; } catch { /* texto plano */ }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

function jsonOpts(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

// ---- Auth ----
export interface LoginResult { access_token: string; role: Role; full_name?: string; email?: string; must_change_password?: boolean }
export async function login(email: string, password: string): Promise<LoginResult> {
  const r = await request<LoginResult>("/auth/login", jsonOpts("POST", { username: email, password }));
  setSession(r.access_token, r.role, r.full_name ?? r.email ?? "");
  setEmail(r.email ?? email);
  return r;
}
export interface MeModule { key: string; can_view: boolean; can_edit: boolean }
export const me = () =>
  request<{ role: Role; full_name?: string; email?: string; must_change_password?: boolean; modules?: MeModule[] }>("/auth/me");
// Cambio de contraseña del propio usuario (obligatorio cuando es temporal: must_change_password=1).
export const changePassword = (current_password: string, new_password: string) =>
  request<{ changed: boolean; must_change_password: boolean }>("/auth/change-password", jsonOpts("POST", { current_password, new_password }));

// ---- Permisos por módulo (matriz rol×módulo, solo admin) ----
export interface ModulePermissionRow { module_key: string; can_view: boolean; can_edit: boolean }
export interface ModuleDef { key: string; label: string; group: string }
export interface ModulePermissionsMatrix {
  modules: ModuleDef[];
  permissions: { consultor: ModulePermissionRow[]; lector: ModulePermissionRow[] };
}
export const getModulePermissions = () => request<ModulePermissionsMatrix>("/auth/module-permissions");
export const saveModulePermissions = (permissions: ModulePermissionsMatrix["permissions"]) =>
  request<ModulePermissionsMatrix>("/auth/module-permissions", jsonOpts("PUT", { permissions }));

// ---- Catálogo de alertas ----
export const listAlerts = () => request<Alert[]>("/alert-catalog");
export const createAlert = (p: Partial<Alert>) => request<{ alert_id: number }>("/alert-catalog", jsonOpts("POST", p));
export const updateAlert = (id: number, p: Partial<Alert>) => request("/alert-catalog/" + id, jsonOpts("PUT", p));
export const deleteAlert = (id: number) => request("/alert-catalog/" + id, { method: "DELETE" });

export const listKql = () => request<KqlQuery[]>("/alert-catalog/kql");
export const createKql = (p: Partial<KqlQuery>) => request<{ kql_id: number }>("/alert-catalog/kql", jsonOpts("POST", p));
export const updateKql = (id: number, p: Partial<KqlQuery>) => request("/alert-catalog/kql/" + id, jsonOpts("PUT", p));
export const deleteKql = (id: number) => request("/alert-catalog/kql/" + id, { method: "DELETE" });

// ---- Catálogo de políticas (Azure Policy) ----
export const listPolicies = () => request<Policy[]>("/policy-catalog");
export const createPolicy = (p: Partial<Policy>) => request<{ policy_id: number }>("/policy-catalog", jsonOpts("POST", p));
export const updatePolicy = (id: number, p: Partial<Policy>) => request("/policy-catalog/" + id, jsonOpts("PUT", p));
export const deletePolicy = (id: number) => request("/policy-catalog/" + id, { method: "DELETE" });

// ---- Pendientes y bloqueantes (Gestión CDC) ----
// Área en la ruta: "CDC" o "INFRA". Son dos módulos de permiso distintos en el backend.
// Ojo: este módulo lee y escribe la BD del tablero de Seguimiento CDC (la SWA original sigue viva
// contra los mismos datos), así que un 409 significa "alguien más lo cambió" y toca recargar.
const pendPath = (area: string, rest = "") => `/pendientes/${encodeURIComponent(area)}${rest}`;
const itemPath = (area: string, id: string, rest = "") =>
  pendPath(area, `/items/${encodeURIComponent(id)}${rest}`);

export const getPendientes = (area: string) => request<PendientesPayload>(pendPath(area));
export const createPendiente = (area: string, p: PendienteWrite) =>
  request<{ id: string }>(pendPath(area, "/items"), jsonOpts("POST", p));
export const updatePendiente = (area: string, id: string, p: PendienteWrite) =>
  request(itemPath(area, id), jsonOpts("PUT", p));
export const deletePendiente = (area: string, id: string) =>
  request(itemPath(area, id), { method: "DELETE" });

/** El autor lo pone el backend con el usuario de la sesión: no se manda desde acá. */
export const addPendienteNota = (area: string, id: string, nota: string, fecha?: string | null) =>
  request<{ hist_id: number }>(itemPath(area, id, "/notas"), jsonOpts("POST", { nota, fecha }));
export const deletePendienteNota = (area: string, id: string, histId: number) =>
  request(itemPath(area, id, `/notas/${histId}`), { method: "DELETE" });

export const createPendienteCliente = (area: string, p: PendienteClienteWrite) =>
  request<{ num: number }>(pendPath(area, "/clientes"), jsonOpts("POST", p));
export const updatePendienteCliente = (area: string, num: number, p: PendienteClienteWrite) =>
  request(pendPath(area, `/clientes/${num}`), jsonOpts("PUT", p));
export const deletePendienteCliente = (area: string, num: number) =>
  request(pendPath(area, `/clientes/${num}`), { method: "DELETE" });

// ---- Asignación de consultores (Gestión CDC) ----
export const listAssignments = () => request<ConsultantAssignment[]>("/consultant-assignments");
export const createAssignment = (p: AssignmentWrite) =>
  request<{ assignment_id: number }>("/consultant-assignments", jsonOpts("POST", p));
export const updateAssignment = (id: number, p: AssignmentWrite) =>
  request("/consultant-assignments/" + id, jsonOpts("PUT", p));
export const deleteAssignment = (id: number) =>
  request("/consultant-assignments/" + id, { method: "DELETE" });

export const listPeople = () => request<Person[]>("/consultant-assignments/people");
export const createPerson = (p: Partial<Person>) =>
  request<{ person_id: number }>("/consultant-assignments/people", jsonOpts("POST", p));
export const updatePerson = (id: number, p: Partial<Person>) =>
  request("/consultant-assignments/people/" + id, jsonOpts("PUT", p));
export const deletePerson = (id: number) =>
  request("/consultant-assignments/people/" + id, { method: "DELETE" });

/** Reasignación masiva: reemplaza a la persona origen por la destino en las asignaciones activas. */
export const reassignPerson = (personId: number, body: { to_person_id: number; scopes?: ReassignScope[] }) =>
  request<{ message: string; changed_assignments: number }>(
    `/consultant-assignments/people/${personId}/reassign`, jsonOpts("POST", body),
  );

// ---- Costos: clientes, análisis y catálogo de servicios ----
export const listClients = () => request<ClientSummary[]>("/clients");

// ---- Administración de clientes (GET /clients tipado completo + CRUD + logo) ----
export const listClientsAdmin = () => request<ClientAdmin[]>("/clients");
export const createClient = (name: string) =>
  request<{ message?: string; client_id: number }>("/clients", jsonOpts("POST", { client_name: name }));
export const renameClient = (id: number, name: string) =>
  request<unknown>(`/clients/${id}`, jsonOpts("PUT", { client_name: name }));
export const purgeClient = (id: number, confirmName: string) =>
  request<unknown>(`/clients/${id}/purge`, jsonOpts("POST", { confirm_client_name: confirmName }));
export const deleteClient = (id: number, confirmName: string) =>
  request<unknown>(`/clients/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm_client_name: confirmName }),
  });
export const deleteClientLogo = (id: number) =>
  request<unknown>(`/clients/${id}/logo`, { method: "DELETE" });

/** Sube el logo del cliente (multipart). El browser fija el Content-Type con su boundary. */
export async function uploadClientLogo(id: number, file: File, base: string = apiBase()): Promise<void> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${base}/clients/${id}/logo`, { method: "PUT", headers, body: form });
  if (res.status === 401) {
    clearSession();
    if (typeof location !== "undefined") location.reload();
    throw new Error("Sesión expirada");
  }
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try { detail = JSON.parse(text).detail ?? text; } catch { /* texto plano */ }
    throw new Error(detail || `HTTP ${res.status}`);
  }
}

/** Descarga autenticada del logo y devuelve un objectURL, o null si el cliente no tiene logo (404). */
export async function fetchClientLogoObjectUrl(id: number, base: string = apiBase()): Promise<string | null> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${base}/clients/${id}/logo`, { headers });
  if (res.status === 404) return null;
  if (res.status === 401) {
    clearSession();
    if (typeof location !== "undefined") location.reload();
    throw new Error("Sesión expirada");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ---- Informe: vista gerencial (dashboard ejecutivo) ----
const rpBase = (clientId: number, year: number, month: number) => `/reports/clients/${clientId}/${year}/${month}`;
export const getExecutive = (clientId: number, year: number, month: number) =>
  request<ExecutivePayload>(`${rpBase(clientId, year, month)}/executive`);
export const generateExecutiveNarrative = (clientId: number, year: number, month: number) =>
  request<{ semaforo: Semaforo; narrative: ExecutiveNarrative }>(`${rpBase(clientId, year, month)}/executive/narrative`, { method: "POST" });
export const getActionPlan = (clientId: number, year: number, month: number) =>
  request<ActionPlanResponse>(`${rpBase(clientId, year, month)}/action-plan`);
export const seedActionPlan = (clientId: number, year: number, month: number) =>
  request<{ items: ActionPlanItem[] }>(`${rpBase(clientId, year, month)}/action-plan/seed`, { method: "POST" });
export const createActionItem = (clientId: number, year: number, month: number, body: ActionPlanItemWrite) =>
  request<{ items: ActionPlanItem[] }>(`${rpBase(clientId, year, month)}/action-plan`, jsonOpts("POST", body));
export const updateActionItem = (clientId: number, year: number, month: number, itemId: number, body: ActionPlanItemWrite) =>
  request<{ items: ActionPlanItem[] }>(`${rpBase(clientId, year, month)}/action-plan/${itemId}`, jsonOpts("PUT", body));
export const deleteActionItem = (clientId: number, year: number, month: number, itemId: number) =>
  request<{ items: ActionPlanItem[] }>(`${rpBase(clientId, year, month)}/action-plan/${itemId}`, { method: "DELETE" });

export const listAnalyses = () => request<AnalysisSummary[]>("/analysis");
export const ensureCurrentAnalysis = (clientId: number) =>
  request<AnalysisSummary>(`/analysis/client/${clientId}/current`, { method: "POST" });
export const listActiveServices = () => request<ServiceCatalogItem[]>("/service-catalog/active");

// ---- Catálogo de servicios (Administración, mutaciones solo admin) ----
export const listAllServices = () => request<ServiceCatalogItem[]>("/service-catalog");
export const listInserterKeys = () => request<string[]>("/service-catalog/inserter-keys");
export const createService = (body: ServiceCreateBody) =>
  request<{ message: string; service_key: string }>("/service-catalog", jsonOpts("POST", body));
export const updateService = (serviceKey: string, body: ServiceUpdateBody) =>
  request<{ message: string; service_key: string }>(`/service-catalog/${encodeURIComponent(serviceKey)}`, jsonOpts("PUT", body));
export const deleteService = (serviceKey: string) =>
  request<{ message: string; service_key: string }>(`/service-catalog/${encodeURIComponent(serviceKey)}`, { method: "DELETE" });

// ---- Costos: lecturas ----
export const getCostResults = (analysisId: number, serviceKey?: string) =>
  request<CostResult[]>(
    `/analysis/${analysisId}/results${serviceKey ? `?service_key=${encodeURIComponent(serviceKey)}` : ""}`,
  );
export const getScenarios = (analysisId: number) =>
  request<Scenario[]>(`/analysis/${analysisId}/scenarios`);

// ---- Costos: escrituras y operaciones Azure ----
export const calculateCosts = (analysisId: number, body: CalculateRequest) =>
  request<CalculateResponse>(`/analysis/${analysisId}/calculate`, jsonOpts("POST", body));
export const recalcScenarios = (analysisId: number) =>
  request<unknown>(`/analysis/${analysisId}/scenarios`, { method: "POST" });
export const setManualCost = (
  costResultId: number,
  body: { manual_monthly_cost: number | null; manual_cost_note?: string | null },
) => request<{ cost_result_id: number }>(`/cost-results/${costResultId}/manual-cost`, jsonOpts("PUT", body));
export const refreshRiCoverage = (analysisId: number) =>
  request<RiCoverageResult>(`/analysis/${analysisId}/ri-coverage/refresh`, { method: "POST" });
export const refreshPowerHistory = (analysisId: number) =>
  request<PowerHistoryEnqueue>(`/analysis/${analysisId}/power-history/refresh`, { method: "POST" });
export const getPowerHistoryStatus = (analysisId: number) =>
  request<PowerHistoryJobStatus>(`/analysis/${analysisId}/power-history/status`);
export const clearPriceCache = () =>
  request<{ removed_rows?: number; message?: string }>(`/prices/refresh-all`, { method: "POST" });
/** Entrada de error/warning dentro del resumen por-servicio de una importación de inventario. */
export interface ImportInventoryIssue {
  credential_id?: number;
  error?: string;
  warning?: string;
}

/** Resumen de un servicio dentro de la respuesta de importación de inventario. */
export interface ImportInventoryServiceSummary {
  imported: number;
  insert_errors: number;
  errors?: ImportInventoryIssue[];
  warnings?: ImportInventoryIssue[];
}

/**
 * Respuesta de POST /azure/import/inventory/{analysisId}. `summary` es por servicio (service_key);
 * `warnings` es la única señal de que un recurso (p. ej. una cuenta de storage) quedó FUERA del
 * análisis (permiso ARM, listado truncado, etc.) — nunca debe descartarse silenciosamente.
 */
export interface ImportInventoryResult {
  message: string;
  analysis_id: number;
  summary: Record<string, ImportInventoryServiceSummary>;
}

export const importInventory = (analysisId: number, body: { services: string[]; replace_existing: boolean }) =>
  request<ImportInventoryResult>(`/azure/import/inventory/${analysisId}`, jsonOpts("POST", body));
export const getInventorySummary = (analysisId: number) =>
  request<InventoryRow[]>(`/azure/import/inventory/${analysisId}/summary`);
export const generateExcel = (analysisId: number, marginPct?: number) =>
  request<{ download_url?: string; file_name?: string }>(
    `/excel/generate/${analysisId}`,
    marginPct && marginPct > 0 ? jsonOpts("POST", { margin_pct: marginPct }) : { method: "POST" },
  );

// ---- WAF (Matriz mejoras Azure): lecturas ----
// Filtro por suscripción: se resuelve en el backend (el Excel también lo usa, y duplicar el conteo
// en TypeScript sería la misma lógica escrita dos veces). Sin selección no se manda el parámetro.
export const wafSubsQuery = (subscriptions?: string[]): string =>
  subscriptions && subscriptions.length > 0
    ? `subscriptions=${subscriptions.map(encodeURIComponent).join(",")}`
    : "";
const withSubs = (path: string, subscriptions?: string[]): string => {
  const q = wafSubsQuery(subscriptions);
  if (!q) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${q}`;
};

export const getWafSummary = (clientId: number, subscriptions?: string[]) =>
  request<WafSummary>(withSubs(`/waf/clients/${clientId}/summary`, subscriptions));
export const getWafSections = (clientId: number, subscriptions?: string[]) =>
  request<WafSection[]>(withSubs(`/waf/clients/${clientId}/sections`, subscriptions));
export const getWafSubscriptions = (clientId: number) =>
  request<WafSubscriptionOption[]>(`/waf/clients/${clientId}/subscriptions`);
export const getWafSecurityManagement = (clientId: number) =>
  request<{ managed_externally: boolean; note: string }>(`/waf/clients/${clientId}/security-management`);
export const setWafSecurityManagement = (clientId: number, managed_externally: boolean, note: string) =>
  request<{ message: string }>(`/waf/clients/${clientId}/security-management`, jsonOpts("PUT", { managed_externally, note }));
export const getWafAdvisorScore = (clientId: number, subscriptions?: string[]) =>
  request<WafAdvisorScore>(withSubs(`/waf/clients/${clientId}/advisor-score`, subscriptions));
export const getWafScoreHistory = (clientId: number, granularity: "day" | "week" | "month" = "month") =>
  request<WafScoreHistory>(`/waf/clients/${clientId}/advisor-score/history?granularity=${granularity}`);
export const getWafRecommendations = (clientId: number, pillar?: number, subscriptions?: string[]) =>
  request<WafRecommendation[]>(
    withSubs(`/waf/clients/${clientId}/recommendations${pillar ? `?pillar=${pillar}` : ""}`, subscriptions),
  );
export const getWafRecommendation = (clientId: number, canonicalId: number) =>
  request<WafRecommendationDetail>(`/waf/clients/${clientId}/recommendations/${canonicalId}`);
// Descartar (soft-delete) una recomendación para el cliente. DELETE con motivo opcional.
export const dismissWafRecommendation = (clientId: number, canonicalId: number, reason = "Descartada por decisión del cliente") =>
  request<{ message: string }>(`/waf/clients/${clientId}/recommendations/${canonicalId}`, jsonOpts("DELETE", { reason }));
export const getWafResources = (clientId: number, canonicalId: number) =>
  request<WafResource[]>(`/waf/clients/${clientId}/recommendations/${canonicalId}/resources`);
export const getWafComments = (clientId: number, canonicalId: number) =>
  request<WafComment[]>(`/waf/clients/${clientId}/recommendations/${canonicalId}/comments`);
export const getWafHistory = (clientId: number, canonicalId: number) =>
  request<WafHistoryEntry[]>(`/waf/clients/${clientId}/recommendations/${canonicalId}/history`);
export const getWafCostReference = (clientId: number) =>
  request<WafCostReference>(`/waf/clients/${clientId}/cost-reference`);
export const getWafIngestionRuns = (clientId: number) =>
  request<WafIngestionRun[]>(`/waf/clients/${clientId}/ingestion-runs`);

// ---- WAF: escrituras ----
export const updateWafTracking = (clientId: number, canonicalId: number, body: WafTrackingUpdate) =>
  request<{ message: string }>(
    `/waf/clients/${clientId}/recommendations/${canonicalId}/tracking`, jsonOpts("PUT", body),
  );
export const addWafComment = (clientId: number, canonicalId: number, comment_text: string) =>
  request<{ comment_id: number }>(
    `/waf/clients/${clientId}/recommendations/${canonicalId}/comments`, jsonOpts("POST", { comment_text }),
  );
export const markWafRecommendationRead = (clientId: number, canonicalId: number) =>
  request<void>(`/waf/clients/${clientId}/recommendations/${canonicalId}/read`, { method: "POST" });
export const translateWafTexts = (items: { key: string; text: string }[]) =>
  request<{ items: { key: string; text: string }[] }>("/waf/translate", jsonOpts("POST", { target: "en", items }))
    .then((r) => r.items);

// ---- WAF: acciones (Slice A) ----
export const listClientSubscriptions = (clientId: number) =>
  request<ClientSubscription[]>(`/azure/subscriptions?client_id=${clientId}`);

// ---- Credenciales Azure (Administración) ----
export const listCredentials = (clientId: number) =>
  request<Credential[]>(`/azure/credentials?client_id=${clientId}`);
export const createCredential = (body: { client_id: number; credential_name: string; tenant_id: string; app_client_id: string; client_secret: string; secret_expires_at?: string | null }) =>
  request<{ message: string; credential_id: number; validation: CredentialAuthResult }>(`/azure/credentials`, jsonOpts("POST", body));
export const rotateCredentialSecret = (credentialId: number, body: { client_secret: string; secret_expires_at?: string | null }) =>
  request<{ message: string; validation: CredentialAuthResult }>(`/azure/credentials/${credentialId}/secret`, jsonOpts("PUT", body));
export const updateCredential = (credentialId: number, body: { credential_name?: string; is_active?: boolean }) =>
  request<{ message: string }>(`/azure/credentials/${credentialId}`, jsonOpts("PUT", body));
export const testCredential = (credentialId: number) =>
  request<CredentialAuthResult>(`/azure/credentials/${credentialId}/test`, { method: "POST" });
export const getCredentialAudit = (credentialId: number, limit = 50) =>
  request<CredentialAudit[]>(`/azure/credentials/${credentialId}/audit?limit=${limit}`);
export const updateSubscription = (clientSubscriptionId: number, body: { is_managed?: boolean; is_active?: boolean }) =>
  request<{ message: string }>(`/azure/subscriptions/${clientSubscriptionId}`, jsonOpts("PUT", body));
export const syncSubscriptions = (clientId: number) =>
  request<SubscriptionSyncSummary>(`/azure/subscriptions/sync-client/${clientId}`, { method: "POST" });

// ---- Usuarios y perfiles (Administración, solo admin) ----
export const listUsers = () => request<PublicUser[]>(`/auth/users`);
export const createUser = (body: { email: string; full_name: string; role: string; password: string; client_ids?: number[] }) =>
  request<PublicUser>(`/auth/users`, jsonOpts("POST", body));
export const updateUser = (userId: number, body: { email?: string; full_name?: string; role?: string; password?: string; is_active?: boolean }) =>
  request<PublicUser>(`/auth/users/${userId}`, jsonOpts("PUT", body));
export const deleteUser = (userId: number) =>
  request<{ deleted: boolean; user_id: number; email: string }>(`/auth/users/${userId}`, { method: "DELETE" });
export const getUserClients = (userId: number) =>
  request<{ user_id: number; client_ids: number[] }>(`/auth/users/${userId}/clients`);
export const setUserClients = (userId: number, clientIds: number[]) =>
  request<{ user_id: number; client_ids: number[] }>(`/auth/users/${userId}/clients`, jsonOpts("PUT", { client_ids: clientIds }));
export const runWafAdvisorSync = (clientId: number, body: WafAdvisorSyncRequest) =>
  request<WafAdvisorSyncResult>(`/waf/clients/${clientId}/advisor-sync`, jsonOpts("POST", body));
export const getWafAdvisorSyncStatus = (clientId: number, jobId: number) =>
  request<WafAdvisorSyncResult>(`/waf/clients/${clientId}/advisor-sync/${jobId}`);

/** Sube un CSV de Advisor (multipart, campo "file"). Igual patrón que uploadClientLogo. */
export async function uploadWafIngestion(clientId: number, file: File, base: string = apiBase()): Promise<unknown> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${base}/waf/clients/${clientId}/ingestions`, { method: "POST", headers, body: form });
  if (res.status === 401) {
    clearSession();
    if (typeof location !== "undefined") location.reload();
    throw new Error("Sesión expirada");
  }
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try { detail = JSON.parse(text).detail ?? text; } catch { /* texto plano */ }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return text ? JSON.parse(text) : {};
}

export const consolidateWafDuplicates = (clientId: number, useAi: boolean) =>
  request<WafConsolidateResult>(`/waf/clients/${clientId}/consolidate-duplicates?use_ai=${useAi}`, { method: "POST" });
/**
 * Refresca el score de UN cliente por su ruta propia (no la admin): así un consultor con
 * "Editar" en Recomendaciones puede actualizar los clientes que tiene asignados, y el
 * backend valida el acceso por cliente. El admin también pasa por aquí.
 */
export const refreshWafAdvisorScore = (clientId: number, includeInReports: boolean) =>
  request<WafScoreRefreshResult>(`/waf/clients/${clientId}/advisor-score/refresh`, jsonOpts("POST", { include_in_reports: includeInReports }));
/** Refresca el Advisor Score de TODOS los clientes activos (sin client_id). */
export const refreshWafAdvisorScoreAll = (includeInReports: boolean) =>
  request<WafScoreRefreshResult>(`/waf/admin/advisor-score/refresh`, jsonOpts("POST", { include_in_reports: includeInReports }));

// ---- WAF: acciones (Slice B) — Import Excel ----
/** Preview de la matriz Excel (multipart "file", ?use_ai). */
export async function previewWafExcel(clientId: number, file: File, useAi: boolean, base: string = apiBase()): Promise<WafExcelPreview> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${base}/waf/clients/${clientId}/excel-import/preview?use_ai=${useAi}`, { method: "POST", headers, body: form });
  if (res.status === 401) { clearSession(); if (typeof location !== "undefined") location.reload(); throw new Error("Sesión expirada"); }
  const text = await res.text();
  if (!res.ok) { let d = text; try { d = JSON.parse(text).detail ?? text; } catch { /* texto plano */ } throw new Error(d || `HTTP ${res.status}`); }
  return (text ? JSON.parse(text) : {}) as WafExcelPreview;
}
export const applyWafExcel = (clientId: number, body: WafExcelApplyRequest) =>
  request<WafExcelApplyResult>(`/waf/clients/${clientId}/excel-import/apply`, jsonOpts("POST", body));

// ---- WAF admin: validación inteligente (curación IA del catálogo) ----
export const getWafAiConfig = () => request<WafAiConfig>(`/waf/admin/ai/config`);
export const getWafCatalog = (params?: { review_status?: string; excluded?: boolean }) => {
  const q = new URLSearchParams();
  if (params?.review_status) q.set("review_status", params.review_status);
  if (params?.excluded != null) q.set("excluded", String(params.excluded));
  const qs = q.toString();
  return request<WafCanonical[]>(`/waf/admin/catalog${qs ? `?${qs}` : ""}`);
};
export const analyzeWafCanonical = (canonicalId: number) =>
  request<{ canonical_id: number; suggestion: WafAiSuggestion }>(`/waf/admin/ai/recommendations/${canonicalId}/analyze`, { method: "POST" });
export const analyzeAllWafCanonicals = (body: { limit: number; apply: boolean }) =>
  request<WafAiBatchResult>(`/waf/admin/ai/recommendations/analyze-all`, jsonOpts("POST", body));
export const applyWafSuggestion = (canonicalId: number, suggestion: WafAiSuggestion) =>
  request<{ message: string; canonical_id: number }>(`/waf/admin/ai/recommendations/${canonicalId}/apply`, jsonOpts("PATCH", suggestion));
export const updateWafCanonical = (canonicalId: number, body: WafCanonicalUpdate) =>
  request<{ message: string; canonical_id: number }>(`/waf/admin/catalog/${canonicalId}`, jsonOpts("PUT", body));

// ---- Boletín Azure ----
export function getBoletin(clientId: number): Promise<BoletinView> {
  return request<BoletinView>(`/boletin/clients/${clientId}`);
}
export function syncBoletin(clientId: number): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/boletin/clients/${clientId}/sync`, { method: "POST" });
}

/** Descarga autenticada (blob) desde el backend .NET; usado por la exportación a Excel. */
export async function downloadFromApi(path: string, fileName: string, base: string = apiBase()): Promise<void> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${base}${path}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- FinOps: Fase 1 (integración FinOps Toolkit) ----
export const getFinOpsLookups = () => request<FinOpsLookups>("/finops-data/lookups");
export const getCoverage = (analysisId: number) => request<CoverageResult>(`/analysis/${analysisId}/coverage`);
export const getFinOpsStatus = () => request<FinOpsRefreshStatus[]>("/finops-data/status");
export const refreshFinOpsData = () =>
  request<{ results: { dataset: string; status: string; row_count: number }[] }>("/finops-data/refresh", { method: "POST" });

// ---- Informe de gestión mensual ----
export const listReports = (clientId: number) =>
  request<ReportList>(`/reports/clients/${clientId}`);
export const getMonthlyReport = (clientId: number, year: number, month: number) =>
  request<MonthlyReport>(`/reports/clients/${clientId}/${year}/${month}`);
export const generateReport = (clientId: number, body: { year: number; month: number; include_narrative?: boolean }) =>
  request<GenerateReportResponse>(`/reports/clients/${clientId}/generate`, jsonOpts("POST", body));
/** Descarga el informe en Word (.docx) con autenticación. */
export const downloadReportWord = (clientId: number, year: number, month: number, fileName: string) =>
  downloadFromApi(`/reports/clients/${clientId}/${year}/${month}/export/word`, fileName);

// ---- Optimización Azure (barrido del tenant) ----
export const getOptimizationAccess = () =>
  request<{ allowed: boolean }>("/optimization/access");
export const runOptimizationScan = (clientId: number) =>
  request<OptScanSummary>(`/optimization/clients/${clientId}/scan`, { method: "POST" });
export const listOptimizationScans = (clientId: number) =>
  request<OptScan[]>(`/optimization/clients/${clientId}/scans`);
export const getScanFindings = (scanId: number) =>
  request<OptFinding[]>(`/optimization/scans/${scanId}/findings`);
export const updateFindingState = (fingerprint: string, state: FindingState, notes?: string | null) =>
  request<{ fingerprint: string; state: string }>(
    `/optimization/findings/${fingerprint}/state`, jsonOpts("PUT", { state, notes: notes ?? null }),
  );

/** Descarga el Excel de hallazgos del barrido (states vacío = todos los estados). */
export const downloadOptimizationExcel = (scanId: number, states: FindingState[], fileName: string) =>
  downloadFromApi(
    `/optimization/scans/${scanId}/excel${states.length ? `?states=${states.join(",")}` : ""}`,
    fileName,
  );

// ---- Reservas Azure por vencer (Gestión CDC) ----
export const getReservations = (clientId: number, alertDays = 30, includeUtilization = false) =>
  request<ReservationsResponse>(`/cdc/clients/${clientId}/reservations?alert_days=${alertDays}&include_utilization=${includeUtilization}`);
export const getReservationUtilization = (clientId: number, credentialId: number, reservationId: string) =>
  request<{ utilization_last: string; utilization_7d?: string; utilization7d?: string }>(
    `/cdc/clients/${clientId}/reservation-utilization?credential_id=${credentialId}&reservation_id=${encodeURIComponent(reservationId)}`);
export const getReservationConsumers = (clientId: number, credentialId: number, reservationId: string, days = 30) =>
  request<{ consumers: ReservationConsumer[]; source: string; count: number; days: number }>(
    `/cdc/clients/${clientId}/reservation-consumers?credential_id=${credentialId}&reservation_id=${encodeURIComponent(reservationId)}&days=${days}`);

// ---- Revisión de accesos (Gestión CDC) ----
export const getAccessReview = (clientId: number, inactivityDays = 90) =>
  request<AccessReviewResponse>(`/cdc/clients/${clientId}/access-review?inactivity_days=${inactivityDays}`);
export const syncAccessReview = (clientId: number) =>
  request<{ run_id?: number; status: string }>(`/cdc/clients/${clientId}/access-review/sync`, { method: "POST" });
export const listAccessReviewRuns = (clientId: number) =>
  request<AccessReviewRun[]>(`/cdc/clients/${clientId}/access-review/runs`);
/** Guarda un lote de decisiones (mantener/revocar/justificado) sobre accesos efectivos.
 *  La clave de la decisión la calcula el backend con principal + rol + scope. */
export const saveAccessDecisions = (clientId: number, items: AccessDecisionItem[]) =>
  request<{ saved: number }>(
    `/cdc/clients/${clientId}/access-review/decisions`, jsonOpts("POST", { items }));
/** Acepta un hallazgo de umbral (los que no tienen accesos individuales que marcar). Nota obligatoria. */
export const acceptAccessFinding = (clientId: number, findingKey: string, note: string) =>
  request<{ saved: number }>(
    `/cdc/clients/${clientId}/access-review/findings/${encodeURIComponent(findingKey)}/accept`,
    jsonOpts("POST", { note }));
// Export Excel: usar downloadFromApi(`/cdc/clients/${id}/access-review/export?inactivity_days=${d}`, fileName)

// ---- Sesión Azure de usuario (Lighthouse: device code + selección de suscripciones) ----
export async function startAzureUserSession(): Promise<AzureUserSession> {
  return request<AzureUserSession>("/azure/user-sessions", { method: "POST" });
}

export async function getAzureUserSession(): Promise<AzureUserSession> {
  return request<AzureUserSession>("/azure/user-sessions/current");
}

export async function disconnectAzureUserSession(): Promise<void> {
  await request<unknown>("/azure/user-sessions/current", { method: "DELETE" });
}

export async function getLighthouseClients(refresh = false): Promise<LighthouseClientGroup[]> {
  return request<LighthouseClientGroup[]>(
    `/azure/user-sessions/current/clients${refresh ? "?refresh=true" : ""}`,
  );
}

export async function linkLighthouseSelection(body: {
  client_id?: number;
  new_client_name?: string;
  tenant_id: string;
  subscriptions: { subscription_id: string; display_name?: string | null }[];
}): Promise<LighthouseLinkResult> {
  return request<LighthouseLinkResult>("/azure/user-sessions/current/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
