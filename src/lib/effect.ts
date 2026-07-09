// Normalización del "Efecto recomendado" de Azure Policy (espejo conceptual de severity.ts).
// El badge muestra SIEMPRE el texto original del campo; la clave normalizada solo decide
// colores y orden. "Deny o Audit" contiene "deny" → colorea como deny (se evalúa primero).

export type EffectKey = "deny" | "modify" | "audit" | "other";

export function normalizeEffect(raw: string | null): EffectKey {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("deny")) return "deny";
  if (s.includes("modify")) return "modify";
  if (s.includes("audit")) return "audit";
  return "other"; // DeployIfNotExists, Append, vacío, etc.
}

export const EFFECT_META: Record<EffectKey, { label: string; badge: string; accent: string }> = {
  deny: { label: "Deny", badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200", accent: "#dc2626" },
  modify: { label: "Modify", badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200", accent: "#d97706" },
  audit: { label: "Audit", badge: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200", accent: "#2563eb" },
  other: { label: "Otro", badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200", accent: "#64748b" },
};
