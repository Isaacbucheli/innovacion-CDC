import { describe, expect, it } from "vitest";
import { filterRecommendations, validateTracking, impactMeta, pillarColor, pillarIcon, scoreColor, advisorSyncSummary, computePillarAvance, excelRowAction, defaultApproved, buildApplyItem, excelSummary, reviewStatusMeta, filterCatalog } from "@/lib/waf";
import { azIcon } from "@/lib/azureIcons";
import type { WafRecommendation, WafAdvisorSyncResult, WafExcelPreviewRow, WafExcelApplyResult, WafCanonical } from "@/types";

const rec = (over: Partial<WafRecommendation>): WafRecommendation => ({
  canonical_id: 1, matrix_code: "1.1", pillar_number: 1, review_scope_es: "x",
  business_impact: "High", resource_count: 0, completion_pct: 0, remediation_end_date: null, ...over,
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
  it("pillarIcon(1) devuelve el icono de performance incrustado", () => {
    expect(pillarIcon(1)).toBe(azIcon("waf-performance"));
    expect(pillarIcon(1)).toMatch(/^data:image\/svg\+xml/);
  });
  it("pillarIcon(99) cae al fallback (advisor)", () => {
    expect(pillarIcon(99)).toBe(azIcon("advisor"));
  });
});

describe("scoreColor", () => {
  it("verde de marca ≥80, ámbar ≥50, rojo <50", () => {
    expect(scoreColor(90)).toBe("#A3C243");
    expect(scoreColor(60)).toBe("#d97706");
    expect(scoreColor(30)).toBe("#dc2626");
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

// ---- Catálogo helpers ----
const canon = (over: Partial<WafCanonical>): WafCanonical => ({
  canonical_id: 1, advisor_name: "Enable MFA", advisor_category: "Security", pillar_number: 2,
  review_scope_es: "MFA admins", benefit_es: "", client_action_es: "", bit_action_es: "",
  is_excluded: false, exclusion_reason: null, consolidates_to_id: null, ai_review_status: "pending",
  ai_decision: null, ai_confidence: null, ai_possible_additional_cost: false, ai_cost_reason: null,
  ai_exclusion_reason: null, ai_duplicate_group_key: null, ai_reviewed_at: null, created_at: "", updated_at: "", ...over,
});

describe("catálogo helpers", () => {
  it("reviewStatusMeta mapea pending", () => { expect(reviewStatusMeta("pending").label).toMatch(/pendiente/i); });
  it("filterCatalog filtra por nombre o ámbito (case-insensitive)", () => {
    const rows = [canon({ canonical_id: 1, advisor_name: "Enable MFA" }), canon({ canonical_id: 2, advisor_name: "Backups", review_scope_es: "geo" })];
    expect(filterCatalog(rows, "mfa").map((r) => r.canonical_id)).toEqual([1]);
    expect(filterCatalog(rows, "GEO").map((r) => r.canonical_id)).toEqual([2]);
    expect(filterCatalog(rows, "")).toHaveLength(2);
  });
});
