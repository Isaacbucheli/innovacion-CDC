import type { SubscriptionSyncResult } from "@/types";

export type SyncStatus = "ok" | "partial" | "error";
export type SyncTone = "ok" | "warn" | "error";

/** Etiqueta corta y amigable del estado de una suscripción. */
export function subStatusLabel(status: SyncStatus): string {
  switch (status) {
    case "ok": return "Sincronizada";
    case "partial": return "Parcial";
    case "error": return "Con error";
  }
}

/** Tono/color asociado al estado (para pintar chips). */
export function subStatusTone(status: SyncStatus): SyncTone {
  switch (status) {
    case "ok": return "ok";
    case "partial": return "warn";
    case "error": return "error";
  }
}

/**
 * Traduce el resultado (y su error crudo) a un mensaje en español para el
 * usuario, sin exponer el stack/tipo técnico. Los errores se clasifican por
 * patrones conocidos; el resto se recorta a ~160 caracteres.
 */
export function humanizeSyncError(status: SyncStatus, error?: string | null): string {
  if (status === "ok") return "Sincronización completa.";
  if (status === "partial") {
    return "Azure Advisor no entregó todas las páginas de recomendaciones; se trajo la información disponible y se reintentará en la próxima sincronización.";
  }
  const raw = (error ?? "").trim();
  const lower = raw.toLowerCase();
  if (lower.includes("404") || lower.includes("temporarily unavailable") || lower.includes("not found")) {
    return "Azure Advisor no respondió para esta suscripción (resultado no disponible); se reintentará.";
  }
  if (
    lower.includes("401") || lower.includes("403") ||
    lower.includes("unauthorized") || lower.includes("forbidden") || lower.includes("auth")
  ) {
    return "Falló el acceso a Azure para esta suscripción (revisar credencial o permisos).";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "La consulta a Advisor tardó demasiado; se reintentará.";
  }
  if (!raw) return "Error desconocido.";
  return raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
}

/**
 * Estado global de una corrida a partir del detalle por suscripción:
 * cualquier error domina; si no, cualquier parcial; si no, todo ok.
 */
export function overallSyncStatus(results: SubscriptionSyncResult[]): SyncStatus {
  if (results.some((r) => r.status === "error")) return "error";
  if (results.some((r) => r.status === "partial")) return "partial";
  return "ok";
}
