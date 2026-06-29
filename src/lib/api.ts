import type {
  Alert,
  AnalysisSummary,
  CalculateRequest,
  CalculateResponse,
  ClientAdmin,
  ClientSubscription,
  ClientSummary,
  CostResult,
  InventoryRow,
  KqlQuery,
  PowerHistoryResult,
  RiCoverageResult,
  Role,
  Scenario,
  ServiceCatalogItem,
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
  WafScoreRefreshResult,
  WafSection,
  WafSummary,
  WafTrackingUpdate,
} from "@/types";
import { clearSession, getToken, setSession } from "@/lib/auth";

// Stack nuevo: backend ÚNICO en .NET (B1–B8), conectado a la BD propia
// `sqldb-optimizacion-costos-valida`. Python (prod) se mantiene en paralelo pero el front nuevo
// NO le habla. En DEV se usa el proxy de Vite (/api → .NET local sobre -valida). En prod, la tarea
// I fija VITE_API_BASE_URL al backend del stack nuevo. SIN fallback a prod: NUNCA apuntar al antiguo
// (si VITE_API_BASE_URL no está, las llamadas van al propio origen y fallan ruidosamente, no a prod).
export function apiBase(): string {
  if (import.meta.env.DEV) return "/api";
  // Backend del stack NUEVO: app-optimizacion-costos-api-dotnet (conectado a sqldb-optimizacion-costos-valida).
  // NO es el antiguo: el antiguo es el FastAPI + BD de prod. Override con VITE_API_BASE_URL si cambia el host.
  return (import.meta.env.VITE_API_BASE_URL as string) || "https://app-optimizacion-costos-api-dotnet.azurewebsites.net";
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
export interface LoginResult { access_token: string; role: Role; full_name?: string; email?: string }
export async function login(email: string, password: string): Promise<LoginResult> {
  const r = await request<LoginResult>("/auth/login", jsonOpts("POST", { username: email, password }));
  setSession(r.access_token, r.role, r.full_name ?? r.email ?? "");
  return r;
}
export const me = () => request<{ role: Role; full_name?: string; email?: string }>("/auth/me");

// ---- Catálogo de alertas ----
export const listAlerts = () => request<Alert[]>("/alert-catalog");
export const createAlert = (p: Partial<Alert>) => request<{ alert_id: number }>("/alert-catalog", jsonOpts("POST", p));
export const updateAlert = (id: number, p: Partial<Alert>) => request("/alert-catalog/" + id, jsonOpts("PUT", p));
export const deleteAlert = (id: number) => request("/alert-catalog/" + id, { method: "DELETE" });

export const listKql = () => request<KqlQuery[]>("/alert-catalog/kql");
export const createKql = (p: Partial<KqlQuery>) => request<{ kql_id: number }>("/alert-catalog/kql", jsonOpts("POST", p));
export const updateKql = (id: number, p: Partial<KqlQuery>) => request("/alert-catalog/kql/" + id, jsonOpts("PUT", p));
export const deleteKql = (id: number) => request("/alert-catalog/kql/" + id, { method: "DELETE" });

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
export const listAnalyses = () => request<AnalysisSummary[]>("/analysis");
export const ensureCurrentAnalysis = (clientId: number) =>
  request<AnalysisSummary>(`/analysis/client/${clientId}/current`, { method: "POST" });
export const listActiveServices = () => request<ServiceCatalogItem[]>("/service-catalog/active");

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
  request<PowerHistoryResult>(`/analysis/${analysisId}/power-history/refresh`, { method: "POST" });
export const clearPriceCache = () =>
  request<{ removed_rows?: number; message?: string }>(`/prices/refresh-all`, { method: "POST" });
export const importInventory = (analysisId: number, body: { services: string[]; replace_existing: boolean }) =>
  request<unknown>(`/azure/import/inventory/${analysisId}`, jsonOpts("POST", body));
export const getInventorySummary = (analysisId: number) =>
  request<InventoryRow[]>(`/azure/import/inventory/${analysisId}/summary`);
export const generateExcel = (analysisId: number) =>
  request<{ download_url?: string; file_name?: string }>(`/excel/generate/${analysisId}`, { method: "POST" });

// ---- WAF (Matriz mejoras Azure): lecturas ----
export const getWafSummary = (clientId: number) =>
  request<WafSummary>(`/waf/clients/${clientId}/summary`);
export const getWafSections = (clientId: number) =>
  request<WafSection[]>(`/waf/clients/${clientId}/sections`);
export const getWafAdvisorScore = (clientId: number) =>
  request<WafAdvisorScore>(`/waf/clients/${clientId}/advisor-score`);
export const getWafRecommendations = (clientId: number, pillar?: number) =>
  request<WafRecommendation[]>(
    `/waf/clients/${clientId}/recommendations${pillar ? `?pillar=${pillar}` : ""}`,
  );
export const getWafRecommendation = (clientId: number, canonicalId: number) =>
  request<WafRecommendationDetail>(`/waf/clients/${clientId}/recommendations/${canonicalId}`);
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

// ---- WAF: acciones (Slice A) ----
export const listClientSubscriptions = (clientId: number) =>
  request<ClientSubscription[]>(`/azure/subscriptions?client_id=${clientId}`);
export const runWafAdvisorSync = (clientId: number, body: WafAdvisorSyncRequest) =>
  request<WafAdvisorSyncResult>(`/waf/clients/${clientId}/advisor-sync`, jsonOpts("POST", body));

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
export const refreshWafAdvisorScore = (clientId: number, includeInReports: boolean) =>
  request<WafScoreRefreshResult>(`/waf/admin/advisor-score/refresh`, jsonOpts("POST", { client_id: clientId, include_in_reports: includeInReports }));

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
