import { describe, expect, it } from "vitest";
import { applyMarginToResults, applyMarginToScenarios, isRiEligible } from "./margin";
import type { CostResult, Scenario } from "@/types";

const row = (o: Partial<CostResult>): CostResult => ({ ...(o as CostResult) });

describe("isRiEligible", () => {
  it("elegible con precio RI y sin reserva confirmada", () => {
    expect(isRiEligible(row({ ri_1y_monthly: 10, ri_coverage: null }))).toBe(true);
    expect(isRiEligible(row({ ri_1y_monthly: null, ri_3y_monthly: 5 }))).toBe(true);
  });
  it("no elegible sin precios RI o reservado confirmado", () => {
    expect(isRiEligible(row({ ri_1y_monthly: null, ri_3y_monthly: null }))).toBe(false);
    expect(isRiEligible(row({ ri_1y_monthly: 10, ri_coverage: "confirmed" }))).toBe(false);
  });
});

describe("applyMarginToResults", () => {
  it("multiplica montos, respeta %, no muta el original", () => {
    const orig = row({ payg_monthly: 100, ri_1y_monthly: 60, savings_1y_pct: 40, savings_1y_monthly: 40, resource_name: "x" });
    const [out] = applyMarginToResults([orig], 10);
    expect(out.payg_monthly).toBeCloseTo(110);
    expect(out.ri_1y_monthly).toBeCloseTo(66);
    expect(out.savings_1y_monthly).toBeCloseTo(44);
    expect(out.savings_1y_pct).toBe(40);
    expect(orig.payg_monthly).toBe(100);
  });
  it("pct 0 o negativo devuelve las filas tal cual", () => {
    const orig = row({ payg_monthly: 100 });
    expect(applyMarginToResults([orig], 0)[0]).toBe(orig);
  });
});

describe("applyMarginToScenarios", () => {
  it("escala totales, ahorros y breakdown; savings_pct intacto", () => {
    const s: Scenario = { scenario_id: 1, number: 1, name: "e", description: null, total_monthly: 100,
      total_annual: 1200, savings_monthly: 20, savings_annual: 240, savings_pct: 16.7, config: {} as never,
      calculated_at: null, breakdown: [{ service_key: "vms", line_label: "VMs", monthly_cost: 100, note: null }] };
    const [out] = applyMarginToScenarios([s], 10);
    expect(out.total_monthly).toBeCloseTo(110);
    expect(out.savings_annual).toBeCloseTo(264);
    expect(out.breakdown[0].monthly_cost).toBeCloseTo(110);
    expect(out.savings_pct).toBe(16.7);
  });
});
