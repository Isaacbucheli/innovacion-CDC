import { describe, expect, it } from "vitest";
import { filterRecommendations, validateTracking, impactMeta, pillarColor } from "@/lib/waf";
import type { WafRecommendation } from "@/types";

const rec = (over: Partial<WafRecommendation>): WafRecommendation => ({
  canonical_id: 1, matrix_code: "1.1", pillar_number: 1, review_scope_es: "x",
  business_impact: "High", resource_count: 0, completion_pct: 0, ...over,
});

describe("filterRecommendations", () => {
  const recs = [rec({ canonical_id: 1, pillar_number: 1, completion_pct: 10 }),
                rec({ canonical_id: 2, pillar_number: 5, completion_pct: 80 })];
  it("filtra por pilar", () => {
    expect(filterRecommendations(recs, { pillar: 5 }).map((r) => r.canonical_id)).toEqual([2]);
  });
  it("sin pilar devuelve todo", () => {
    expect(filterRecommendations(recs, {})).toHaveLength(2);
  });
  it("filtra por rango de avance", () => {
    expect(filterRecommendations(recs, { minPct: 50, maxPct: 100 }).map((r) => r.canonical_id)).toEqual([2]);
  });
});

describe("validateTracking", () => {
  it("acepta avance válido", () => {
    expect(validateTracking({ completion_pct: 50, remediation_start_date: "2026-06-15" })).toEqual({});
  });
  it("rechaza avance fuera de 0–100", () => {
    expect(validateTracking({ completion_pct: 120 })).toHaveProperty("completion_pct");
  });
  it("rechaza fecha inválida", () => {
    expect(validateTracking({ completion_pct: 10, remediation_start_date: "no-fecha" })).toHaveProperty("remediation_start_date");
  });
});

describe("meta", () => {
  it("impactMeta mapea High", () => { expect(impactMeta("High").label).toBe("Alta"); });
  it("pillarColor devuelve un color por número", () => { expect(pillarColor(5)).toMatch(/^#/); });
});
