import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({ updateWafTracking: vi.fn(async () => ({ message: "ok" })) }));
vi.mock("@/lib/auth", () => ({ canEdit: () => true }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const detail = {
  canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "RI",
  business_impact: "High", resource_count: 2, completion_pct: 10,
  benefit_es: "", client_action_es: "", bit_action_es: "",
  remediation_start_date: null, remediation_end_date: null,
  projected_bit_effort: null, execution_log: null,
  priority_override: null, internal_notes: null,
};

beforeEach(() => vi.clearAllMocks());

test("guarda el seguimiento llamando a la API", async () => {
  const { default: TrackingForm } = await import("@/components/waf/TrackingForm");
  const { updateWafTracking } = await import("@/lib/api");
  const onSaved = vi.fn();
  render(<TrackingForm clientId={3} canonicalId={9} detail={detail} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("button", { name: /guardar seguimiento/i }));
  await waitFor(() => expect(updateWafTracking).toHaveBeenCalled());
  expect(onSaved).toHaveBeenCalled();
});

test("envia la fecha de cierre capturada en el formulario", async () => {
  const { default: TrackingForm } = await import("@/components/waf/TrackingForm");
  const { updateWafTracking } = await import("@/lib/api");
  render(<TrackingForm clientId={3} canonicalId={9} detail={detail} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(/fecha de cierre/i), { target: { value: "2026-07-15" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar seguimiento/i }));
  await waitFor(() => expect(updateWafTracking).toHaveBeenCalled());
  expect(vi.mocked(updateWafTracking).mock.calls[0][2]).toMatchObject({ remediation_end_date: "2026-07-15" });
});
