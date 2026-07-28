import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({ updateWafTracking: vi.fn(async () => ({ message: "ok" })) }));
vi.mock("@/lib/auth", () => ({ canEdit: () => true, canEditModule: () => true }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const detail = {
  canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "RI",
  advisor_name_en: null, business_impact: "High", resource_count: 2, completion_pct: 10,
  benefit_es: "", client_action_es: "", bit_action_es: "",
  remediation_start_date: null, remediation_end_date: null,
  projected_bit_effort: null, execution_log: null,
  priority_override: null, internal_notes: null,
  is_new: false, source: "advisor",
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

test("muestra el historial de la bitácora en un desplegable colapsable", async () => {
  const { default: TrackingForm } = await import("@/components/waf/TrackingForm");
  const logHistory = [
    { history_id: 2, field_changed: "execution_log", old_value: "v1", new_value: "Compra de RI para SQL MI", changed_by: "Ana", changed_at: "2026-07-17T12:00:00Z" },
    { history_id: 1, field_changed: "execution_log", old_value: null, new_value: "v1", changed_by: "Ana", changed_at: "2026-07-16T12:00:00Z" },
  ];
  render(<TrackingForm clientId={3} canonicalId={9} detail={detail} onSaved={vi.fn()} logHistory={logHistory} />);
  expect(screen.getByText("Historial (2)")).toBeInTheDocument();
  expect(screen.getByText("Compra de RI para SQL MI")).toBeInTheDocument();
});

test("sin historial de bitácora no muestra el desplegable", async () => {
  const { default: TrackingForm } = await import("@/components/waf/TrackingForm");
  render(<TrackingForm clientId={3} canonicalId={9} detail={detail} onSaved={vi.fn()} />);
  expect(screen.queryByText(/^Historial \(/)).not.toBeInTheDocument();
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
