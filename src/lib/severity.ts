export type SeverityKey = "critical" | "high" | "medium" | "low" | "info";

export function severityKey(sev: string | null): SeverityKey {
  const s = (sev ?? "").toUpperCase();
  if (s.includes("CRÍT") || s.includes("CRIT")) return "critical";
  if (s.startsWith("ALT") || s.startsWith("HIGH")) return "high";
  if (s.startsWith("MED")) return "medium"; // MEDIA (es) y MEDIUM (en) empiezan por MED
  if (s.startsWith("BAJ") || s.startsWith("LOW")) return "low";
  return "info";
}

export const SEVERITY_META: Record<SeverityKey, { label: string; badge: string; accent: string }> = {
  critical: { label: "Crítica", badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200", accent: "#dc2626" },
  high: { label: "Alta", badge: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200", accent: "#ea580c" },
  medium: { label: "Media", badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200", accent: "#d97706" },
  low: { label: "Baja", badge: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200", accent: "#16a34a" },
  info: { label: "Info", badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200", accent: "#64748b" },
};
