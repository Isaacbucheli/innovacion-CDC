import { visibleServiceKey } from "@/lib/costs";
import type { CostResult, CoverageResult, FinOpsLookups } from "@/types";

/** Badge "No elegible a RI": SOLO con not_eligible explícito (ausencia del CSV = unknown, sin badge). */
export function showNotEligibleBadge(row: CostResult): boolean {
  return row.ri_eligibility === "not_eligible";
}

/** Categoría FOCUS del service_key del catálogo (sql_vm cuenta como vms). Fallback "Otros". */
export function categoryOf(serviceKey: string | null, lookups: FinOpsLookups | null): string {
  if (!serviceKey || !lookups) return "Otros";
  return lookups.service_categories[visibleServiceKey(serviceKey)] ?? lookups.service_categories[serviceKey] ?? "Otros";
}

export function coverageKpis(c: CoverageResult) {
  return {
    pctLabel: `${c.coverage_pct}%`,
    costedLabel: `${c.costed_resources} de ${c.total_resources} recursos`,
    uncoveredCount: c.uncovered.length,
  };
}
