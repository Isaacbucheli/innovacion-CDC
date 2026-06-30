import type { Reservation } from "@/types";

// Estados de Azure que se consideran inactivos (no se calcula utilización ni se muestran por defecto).
export const RES_INACTIVE_STATES = ["cancelled", "canceled", "expired", "failed"];

export function isInactive(r: Pick<Reservation, "state">): boolean {
  return RES_INACTIVE_STATES.includes((r.state ?? "").toLowerCase());
}

// Situación de la reserva respecto al período de aviso elegido.
export function situacion(r: Pick<Reservation, "expired" | "days_remaining">, alertDays: number): "venc" | "por" | "vig" {
  if (r.expired || r.days_remaining < 0) return "venc";
  if (r.days_remaining <= alertDays) return "por";
  return "vig";
}

// Utilización como número 0..100, o null ("n/d" → null, "37%" → 37).
export function utilNum(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const m = String(value).match(/\d+/);
  return m ? Number(m[0]) : null;
}

// Bucket de uso para clasificar/colorear: nd / low (<30) / mid (30-69) / high (>=70).
export function utilBucket(value: string | number | null | undefined): "nd" | "low" | "mid" | "high" {
  const n = utilNum(value);
  if (n === null) return "nd";
  if (n < 30) return "low";
  if (n < 70) return "mid";
  return "high";
}

// Clase de chip por uso.
export function utilChip(value: string | number | null | undefined): string {
  switch (utilBucket(value)) {
    case "low": return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
    case "mid": return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
    case "high": return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200";
    default: return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }
}

// Clase de chip por días restantes (severidad absoluta).
export function daysChip(r: Pick<Reservation, "expired" | "days_remaining">): string {
  if (r.expired || r.days_remaining < 0) return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
  if (r.days_remaining <= 10) return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
  if (r.days_remaining <= 30) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200";
}

export function daysLabel(r: Pick<Reservation, "expired" | "days_remaining">): string {
  if (r.expired || r.days_remaining < 0) return `Vencida (${r.days_remaining})`;
  return `${r.days_remaining} días`;
}

// Clase de chip por estado de Azure.
export function stateChip(state: string | null | undefined): string {
  const s = (state ?? "").toLowerCase();
  if (s === "succeeded") return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200";
  if (s === "expired" || s === "failed") return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
}

function lastSeg(v: string): string {
  const parts = String(v || "").split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : String(v || "");
}

// Texto legible del ámbito de aplicación de la reserva.
export function appliedScopeText(r: Pick<Reservation, "applied_scope_type" | "applied_scopes">): string {
  const type = (r.applied_scope_type ?? "").toLowerCase();
  const scopes = r.applied_scopes ?? [];
  if (type === "shared") return "Compartida (todas las suscripciones del tenant)";
  if (type === "managementgroup") return "Grupo de administración" + (scopes.length ? `: ${scopes.map(lastSeg).join(", ")}` : "");
  if (type === "single" || scopes.length) return "Suscripción específica" + (scopes.length ? `: ${scopes.map(lastSeg).join(", ")}` : "");
  return r.applied_scope_type || "—";
}

// Promedio de utilización 7d (sobre las reservas con dato numérico).
export function avgUtilization7d(rows: { utilization7d?: string | null }[]): number | null {
  const xs = rows.map((r) => utilNum(r.utilization7d)).filter((n): n is number => n !== null);
  if (!xs.length) return null;
  return Math.round(xs.reduce((s, n) => s + n, 0) / xs.length);
}
