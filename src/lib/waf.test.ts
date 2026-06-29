import { describe, expect, it } from "vitest";
import { filterRecommendations, validateTracking, impactMeta, pillarColor, pillarIcon, scoreClass, advisorSyncSummary, computePillarAvance, excelRowAction, defaultApproved, buildApplyItem, excelSummary } from "@/lib/waf";
import type { WafRecommendation, WafAdvisorSyncResult, WafExcelPreviewRow, WafExcelApplyResult } from "@/types";

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

describe("pillarIcon", () => {
  it("pillarIcon(1) contiene waf-performance.svg", () => {
    expect(pillarIcon(1)).toContain("waf-performance.svg");
  });
  it("pillarIcon(99) contiene advisor.svg (fallback)", () => {
    expect(pillarIcon(99)).toContain("advisor.svg");
  });
});

describe("scoreClass", () => {
  it("scoreClass(90) incluye green", () => {
    expect(scoreClass(90)).toContain("green");
  });
  it("scoreClass(60) incluye amber", () => {
    expect(scoreClass(60)).toContain("amber");
  });
  it("scoreClass(30) incluye red", () => {
    expect(scoreClass(30)).toContain("red");
  });
});

describe("advisorSyncSummary", () => {
  it("resume suscripciones procesadas, nuevas y resueltas", () => {
    const r: WafAdvisorSyncResult = {
      run_id: 1, status: "completed", subscriptions_queued: 3, subscriptions_processed: 3,
      subscriptions_failed: 0, new_recommendations: 58, new_findings: 312, resolved_findings: 12,
    };
    const s = advisorSyncSummary(r);
    expect(s).toContain("3");
    expect(s).toContain("58");
    expect(s).toContain("12");
  });
});

describe("computePillarAvance", () => {
  it("pilar vacío con matriz poblada → 100%", () => {
    expect(computePillarAvance(0, 0, true)).toBe(100);
  });
  it("pilar vacío sin datos en ningún pilar → 0%", () => {
    expect(computePillarAvance(0, 0, false)).toBe(0);
  });
  it("pilar con recomendaciones → avg_progress redondeado y acotado 0–100", () => {
    expect(computePillarAvance(6, 39.6, true)).toBe(40);
    expect(computePillarAvance(3, 120, true)).toBe(100);
  });
});

// ---- Excel mapping ----
const baseRow = (over: Partial<WafExcelPreviewRow["row"]> = {}): WafExcelPreviewRow["row"] => ({
  row_number: 1, pillar_number: 5, excel_code: "5.1", title: "RI", raw_scope: "scope",
  completion_pct: 80, remediation_start_date: null, execution_log: null, benefit: "b",
  actions: "a", impact: "High", projected_bit_effort: "8h", resources: ["vm1"], warnings: [], ...over,
});
const pr = (over: Partial<WafExcelPreviewRow> = {}): WafExcelPreviewRow => ({
  row: baseRow(), status: "matched", can_create: true, match_source: "deterministic",
  confidence: 0.9, reason: "", suggested_match: { canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "x", advisor_name: "y" }, ...over,
});

describe("excel mapping", () => {
  it("excelRowAction: con suggested_match → update", () => { expect(excelRowAction(pr())).toBe("update"); });
  it("excelRowAction: sin match pero can_create → create", () => {
    expect(excelRowAction(pr({ status: "new", suggested_match: null }))).toBe("create");
  });
  it("excelRowAction: sin match ni can_create → null", () => {
    expect(excelRowAction(pr({ status: "needs_review", suggested_match: null, can_create: false }))).toBeNull();
  });
  it("defaultApproved: matched sí, needs_review no, new sí", () => {
    expect(defaultApproved(pr())).toBe(true);
    expect(defaultApproved(pr({ status: "needs_review", suggested_match: null }))).toBe(false);
    expect(defaultApproved(pr({ status: "new", suggested_match: null }))).toBe(true);
  });
  it("buildApplyItem update lleva canonical_id; create lleva pillar/title", () => {
    const up = buildApplyItem(pr(), true);
    expect(up).toMatchObject({ action: "update", canonical_id: 9, row_number: 1, approved: true });
    const cr = buildApplyItem(pr({ status: "new", suggested_match: null }), true);
    expect(cr).toMatchObject({ action: "create", pillar_number: 5, title: "RI", review_scope: "scope" });
  });
  it("buildApplyItem devuelve null si no hay acción", () => {
    expect(buildApplyItem(pr({ status: "needs_review", suggested_match: null, can_create: false }), true)).toBeNull();
  });
  it("excelSummary arma el texto", () => {
    const r: WafExcelApplyResult = { message: "", client_id: 3, rows_applied: 8, rows_created: 2, rows_skipped: 1, changed_fields: {}, errors: [] };
    const s = excelSummary(r);
    expect(s).toContain("8"); expect(s).toContain("2"); expect(s).toContain("1");
  });
});
