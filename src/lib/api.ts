import type {
  Alert,
  AnalysisSummary,
  CalculateRequest,
  CalculateResponse,
  ClientSummary,
  CostResult,
  InventoryRow,
  KqlQuery,
  PowerHistoryResult,
  RiCoverageResult,
  Role,
  Scenario,
  ServiceCatalogItem,
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
