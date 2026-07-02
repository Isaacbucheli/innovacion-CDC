import { describe, expect, test } from "vitest";
import { categoryOf, coverageKpis, showNotEligibleBadge } from "@/lib/finops";
import type { CostResult, CoverageResult, FinOpsLookups } from "@/types";

const R = (over: Partial<CostResult>): CostResult => ({ ...({} as CostResult), ...over });

const LOOKUPS: FinOpsLookups = {
  regions: { eastus2: "East US 2" },
  resource_types: {},
  service_categories: { vms: "Compute", sql: "Databases" },
};

describe("showNotEligibleBadge", () => {
  test("solo not_eligible explícito muestra badge", () => {
    expect(showNotEligibleBadge(R({ ri_eligibility: "not_eligible" }))).toBe(true);
    expect(showNotEligibleBadge(R({ ri_eligibility: "unknown" }))).toBe(false);
    expect(showNotEligibleBadge(R({ ri_eligibility: "eligible" }))).toBe(false);
    expect(showNotEligibleBadge(R({ ri_eligibility: null }))).toBe(false);
  });
});

describe("categoryOf", () => {
  test("mapea service_key a categoría FOCUS (sql_vm→vms)", () => {
    expect(categoryOf("vms", LOOKUPS)).toBe("Compute");
    expect(categoryOf("sql_vm", LOOKUPS)).toBe("Compute");
    expect(categoryOf("sql", LOOKUPS)).toBe("Databases");
  });
  test("sin lookups o clave desconocida → 'Otros'", () => {
    expect(categoryOf("vms", null)).toBe("Otros");
    expect(categoryOf("zzz", LOOKUPS)).toBe("Otros");
    expect(categoryOf(null, LOOKUPS)).toBe("Otros");
  });
});

describe("coverageKpis", () => {
  test("formatea totales y porcentaje", () => {
    const c: CoverageResult = { total_resources: 100, costed_resources: 80, coverage_pct: 80, uncovered: [] };
    const k = coverageKpis(c);
    expect(k.pctLabel).toBe("80%");
    expect(k.costedLabel).toBe("80 de 100 recursos");
    expect(k.uncoveredCount).toBe(0);
  });
});
