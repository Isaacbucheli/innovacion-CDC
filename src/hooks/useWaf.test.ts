import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  listClientsAdmin: vi.fn(async () => [{ client_id: 3, client_name: "BANISI", has_logo: true }]),
  getWafSummary: vi.fn(async () => ({ client_id: 3, recommendations: 1, active_recommendations: 1, cost_recommendations: 0, active_findings: 2, latest_ingestion: null })),
  getWafSections: vi.fn(async () => [{ section_num: 5, section_name: "Costos", total_recs: 1, total_resources: 2, avg_progress: 10, high_recs: 1, medium_recs: 0 }]),
  getWafRecommendations: vi.fn(async () => [{ canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "x", business_impact: "High", resource_count: 2, completion_pct: 10 }]),
  getWafAdvisorScore: vi.fn(async () => ({ has_connection: true, pillars: { "5": 60 } })),
}));

describe("useWaf", () => {
  beforeEach(() => { localStorage.clear(); });
  it("carga cliente, secciones y recomendaciones; arma pillarNames", async () => {
    const { useWaf } = await import("@/hooks/useWaf");
    const { result } = renderHook(() => useWaf());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.recommendations).toHaveLength(1));
    expect(result.current.clientId).toBe(3);
    expect(result.current.pillarNames[5]).toBe("Costos");
    await waitFor(() => expect(result.current.scores?.[5]).toBe(60));
  });
});
