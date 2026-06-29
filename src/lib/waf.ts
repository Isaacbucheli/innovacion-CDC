import type { WafRecommendation } from "@/types";

// Color por número de pilar (1–5). Mid-ramp: legible en claro y oscuro.
// Los NOMBRES de pilar vienen del backend (section_name), no se hardcodean aquí.
export const PILLAR_COLOR: Record<number, string> = {
  1: "#185fa5", 2: "#1d9e75", 3: "#7f77dd", 4: "#ba7517", 5: "#639922",
};
export function pillarColor(n: number): string {
  return PILLAR_COLOR[n] ?? "#888780";
}

export const IMPACT_META: Record<string, { label: string; chip: string }> = {
  high: { label: "Alta", chip: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
  medium: { label: "Media", chip: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  low: { label: "Baja", chip: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" },
};
export function impactMeta(impact: string | null): { label: string; chip: string } {
  const k = (impact ?? "").toLowerCase();
  return IMPACT_META[k] ?? { label: impact ?? "—", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
}

export function filterRecommendations(
  recs: WafRecommendation[],
  opts: { pillar?: number | null; minPct?: number; maxPct?: number },
): WafRecommendation[] {
  const { pillar, minPct = 0, maxPct = 100 } = opts;
  return recs.filter((r) =>
    (pillar == null || r.pillar_number === pillar) &&
    r.completion_pct >= minPct && r.completion_pct <= maxPct);
}

export function validateTracking(form: {
  completion_pct?: number; remediation_start_date?: string | null;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const pct = form.completion_pct;
  if (pct != null && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
    errors.completion_pct = "El avance debe estar entre 0 y 100.";
  }
  const d = form.remediation_start_date;
  if (d && Number.isNaN(Date.parse(d))) {
    errors.remediation_start_date = "Fecha inválida.";
  }
  return errors;
}
