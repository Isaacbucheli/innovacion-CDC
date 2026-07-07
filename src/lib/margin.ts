import type { CostResult, Scenario } from "@/types";

/**
 * Elegible para RI: no está ya reservado en firme (ri_coverage="confirmed")
 * y existe al menos un precio RI (1 o 3 años) calculado.
 */
export function isRiEligible(row: CostResult): boolean {
  if (row.ri_coverage === "confirmed") return false;
  return row.ri_1y_monthly != null || row.ri_3y_monthly != null;
}

/** Claves monetarias de CostResult a las que se aplica el margen. */
const MONEY_KEYS = [
  "payg_hourly",
  "payg_monthly",
  "ri_1y_monthly",
  "ri_3y_monthly",
  "savings_1y_monthly",
  "savings_3y_monthly",
  "sql_addon_monthly",
  "ahb_discount_monthly",
  "storage_monthly",
  "manual_monthly_cost",
] as const satisfies readonly (keyof CostResult)[];

/**
 * Aplica un margen porcentual a las claves monetarias de cada fila (inmutable).
 * Los porcentajes de ahorro (savings_*_pct) quedan intactos: siguen siendo relativos
 * entre PAYG y RI, sin importar el margen aplicado a ambos.
 * pct <= 0 devuelve las mismas filas (misma referencia), sin copiar.
 */
export function applyMarginToResults(rows: CostResult[], pct: number): CostResult[] {
  if (pct <= 0) return rows;
  const factor = 1 + pct / 100;
  return rows.map((row) => {
    const out = { ...row };
    for (const key of MONEY_KEYS) {
      const value = row[key];
      if (typeof value === "number") {
        (out[key] as number) = value * factor;
      }
    }
    return out;
  });
}

/**
 * Aplica el margen a totales/ahorros y al breakdown de cada escenario (inmutable).
 * savings_pct queda intacto (relación PAYG/RI no cambia con el margen).
 * pct <= 0 devuelve los mismos escenarios (misma referencia).
 */
export function applyMarginToScenarios(scenarios: Scenario[], pct: number): Scenario[] {
  if (pct <= 0) return scenarios;
  const factor = 1 + pct / 100;
  return scenarios.map((s) => ({
    ...s,
    total_monthly: s.total_monthly * factor,
    total_annual: s.total_annual * factor,
    savings_monthly: s.savings_monthly * factor,
    savings_annual: s.savings_annual * factor,
    breakdown: s.breakdown.map((b) => ({ ...b, monthly_cost: b.monthly_cost * factor })),
  }));
}
