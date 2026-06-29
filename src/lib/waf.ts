import type { WafRecommendation, WafAdvisorSyncResult, WafExcelPreviewRow, WafExcelApplyItem, WafExcelApplyResult } from "@/types";

// Color por número de pilar (1–5). Mid-ramp: legible en claro y oscuro.
// Los NOMBRES de pilar vienen del backend (section_name), no se hardcodean aquí.
export const PILLAR_COLOR: Record<number, string> = {
  1: "#185fa5", 2: "#1d9e75", 3: "#7f77dd", 4: "#ba7517", 5: "#639922",
};
export function pillarColor(n: number): string {
  return PILLAR_COLOR[n] ?? "#888780";
}

// Icono Azure por número de pilar (1–5), igual que la matriz de PRD (sectionIcons).
export const PILLAR_ICON: Record<number, string> = {
  1: "waf-performance.svg", 2: "waf-operational.svg", 3: "waf-security.svg",
  4: "waf-reliability.svg", 5: "waf-cost.svg",
};
export function pillarIcon(n: number): string {
  return `/assets/azure-icons/${PILLAR_ICON[n] ?? "advisor.svg"}`;
}

// Azul de marca de Azure: un solo color para todas las barras de avance (elegante,
// legible en claro y oscuro). Reemplaza el multicolor por pilar.
export const AZURE_BLUE = "#0078D4";

// Avance del pilar, misma lógica que PRD (renderWafSections): un pilar SIN
// recomendaciones, con la matriz poblada, está "todo aplicado" → 100%; si no hay
// datos en ningún pilar → 0%; si tiene recomendaciones → su avg_progress redondeado.
export function computePillarAvance(totalRecs: number, avgProgress: number, matrixPopulated: boolean): number {
  if (totalRecs === 0) return matrixPopulated ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round(avgProgress)));
}

// Color del Advisor Score: verde de MARCA (#A3C243, olivo #5a7016 legible) ≥80,
// ámbar ≥50, rojo <50. NO usar verdes genéricos de Tailwind (off-brand, brandbook).
export function scoreClass(score: number): string {
  if (score >= 80) return "text-[#5a7016] dark:text-[#a9c46a]";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

// Color de la barra lateral del Score (estilo Azure Advisor): verde de marca / ámbar / rojo.
export function scoreColor(score: number): string {
  if (score >= 80) return "#A3C243";
  if (score >= 50) return "#d97706";
  return "#dc2626";
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

export function advisorSyncSummary(r: WafAdvisorSyncResult): string {
  const subs = `${r.subscriptions_processed} suscripción${r.subscriptions_processed === 1 ? "" : "es"}`;
  return `${subs} · ${r.new_recommendations} nuevas · ${r.resolved_findings} resueltas`;
}

// ---- Excel mapping (WAF import) ----
export const EXCEL_STATUS_META: Record<string, { label: string; chip: string }> = {
  matched: { label: "match", chip: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" },
  needs_review: { label: "revisar", chip: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  new: { label: "nueva", chip: "bg-accent text-accent-foreground" },
};

export function excelRowAction(pr: WafExcelPreviewRow): "update" | "create" | null {
  if (pr.suggested_match) return "update";
  if (pr.can_create) return "create";
  return null;
}

export function defaultApproved(pr: WafExcelPreviewRow): boolean {
  if (pr.status === "matched") return true;
  if (pr.status === "new" && pr.can_create) return true;
  return false;
}

export function buildApplyItem(pr: WafExcelPreviewRow, approved: boolean): WafExcelApplyItem | null {
  const action = excelRowAction(pr);
  if (!action) return null;
  const r = pr.row;
  const base = {
    row_number: r.row_number, approved,
    completion_pct: r.completion_pct, remediation_start_date: r.remediation_start_date, execution_log: r.execution_log,
  };
  if (action === "update") {
    return { ...base, action: "update", canonical_id: pr.suggested_match!.canonical_id };
  }
  return {
    ...base, action: "create",
    pillar_number: r.pillar_number, title: r.title, review_scope: r.raw_scope,
    benefit: r.benefit, actions: r.actions, impact: r.impact,
    projected_bit_effort: r.projected_bit_effort, resources: r.resources,
  };
}

export function excelSummary(r: WafExcelApplyResult): string {
  return `${r.rows_applied} aplicada${r.rows_applied === 1 ? "" : "s"} · ${r.rows_created} creada${r.rows_created === 1 ? "" : "s"} · ${r.rows_skipped} omitida${r.rows_skipped === 1 ? "" : "s"}`;
}
