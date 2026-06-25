export type SeverityKey = "critical" | "high" | "medium" | "low" | "info";

export function severityKey(sev: string | null): SeverityKey {
  const s = (sev ?? "").toUpperCase();
  if (s.includes("CRÍT") || s.includes("CRIT")) return "critical";
  if (s.startsWith("ALT")) return "high";
  if (s.startsWith("MED")) return "medium";
  if (s.startsWith("BAJ")) return "low";
  return "info";
}

export const SEVERITY_META: Record<SeverityKey, { label: string; badge: string; accent: string }> = {
  critical: { label: "Crítica", badge: "bg-red-100 text-red-800", accent: "#dc2626" },
  high: { label: "Alta", badge: "bg-orange-100 text-orange-800", accent: "#ea580c" },
  medium: { label: "Media", badge: "bg-amber-100 text-amber-800", accent: "#d97706" },
  low: { label: "Baja", badge: "bg-green-100 text-green-800", accent: "#16a34a" },
  info: { label: "Info", badge: "bg-slate-100 text-slate-700", accent: "#64748b" },
};
