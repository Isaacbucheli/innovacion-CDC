import { render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  getWafRecommendation: vi.fn(async () => ({
    canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "RI",
    business_impact: "High", resource_count: 2, completion_pct: 10,
    benefit_es: "Ahorra", client_action_es: "Aprobar", bit_action_es: "Comprar",
    remediation_start_date: null, projected_bit_effort: null, execution_log: null,
    priority_override: null, internal_notes: null,
  })),
  getWafResources: vi.fn(async () => [{ finding_id: 1, resource_name: "vm-01", resource_type: "VM", resource_group: "rg", subscription_name: "sub", status: "active" }]),
  getWafComments: vi.fn(async () => []),
  getWafHistory: vi.fn(async () => []),
  updateWafTracking: vi.fn(async () => ({ message: "ok" })),
  addWafComment: vi.fn(async () => ({ comment_id: 1 })),
}));

test("carga y muestra el detalle (resumen + recursos)", async () => {
  const { default: WafDetailDialog } = await import("@/components/waf/WafDetailDialog");
  render(<WafDetailDialog clientId={3} canonicalId={9} pillarName="Costos" open onOpenChange={() => {}} onChanged={() => {}} />);
  await waitFor(() => expect(screen.getByText("Ahorra")).toBeInTheDocument());
  expect(screen.getByText("vm-01")).toBeInTheDocument();
});
