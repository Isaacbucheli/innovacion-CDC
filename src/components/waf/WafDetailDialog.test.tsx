import { render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  getWafRecommendation: vi.fn(async () => ({
    canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "RI",
    business_impact: "High", resource_count: 2, completion_pct: 10,
    benefit_es: "Ahorra", client_action_es: "Aprobar", bit_action_es: "Comprar",
    remediation_start_date: null, remediation_end_date: null, projected_bit_effort: null, execution_log: null,
    priority_override: null, internal_notes: null,
  })),
  getWafResources: vi.fn(async () => [{ finding_id: 1, resource_name: "vm-01", resource_type: "VM", resource_group: "rg", subscription_name: "sub", status: "active" }]),
  getWafComments: vi.fn(async () => []),
  getWafHistory: vi.fn(async () => []),
  updateWafTracking: vi.fn(async () => ({ message: "ok" })),
  addWafComment: vi.fn(async () => ({ comment_id: 1 })),
}));

vi.mock("@/lib/wafTranslate", () => ({
  translateToEnglish: vi.fn(async (texts: string[]) => {
    const m = new Map<string, string>();
    for (const t of texts) if (t?.trim()) m.set(t, `EN(${t})`);
    return m;
  }),
  clearTranslationCache: vi.fn(),
}));

test("carga y muestra el detalle (resumen + recursos)", async () => {
  const { default: WafDetailDialog } = await import("@/components/waf/WafDetailDialog");
  render(<WafDetailDialog clientId={3} canonicalId={9} pillarName="Costos" open onOpenChange={() => {}} onChanged={() => {}} />);
  await waitFor(() => expect(screen.getByText("Ahorra")).toBeInTheDocument());
  expect(screen.getByText("vm-01")).toBeInTheDocument();
});

test("el historial de cambios usa nombres amigables y valores formateados", async () => {
  const api = await import("@/lib/api");
  (api.getWafHistory as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
    { history_id: 1, field_changed: "completion_pct", old_value: "10", new_value: "20", changed_by: "Ana", changed_at: "2026-07-17T12:00:00Z" },
  ]);
  const { default: WafDetailDialog } = await import("@/components/waf/WafDetailDialog");
  render(<WafDetailDialog clientId={3} canonicalId={9} pillarName="Costos" open onOpenChange={() => {}} onChanged={() => {}} />);
  await waitFor(() => expect(screen.getByText("Avance")).toBeInTheDocument());
  expect(screen.queryByText(/completion_pct/)).not.toBeInTheDocument();
  const entry = screen.getByText("Avance").closest("li")!;
  expect(entry).toHaveTextContent("10% → 20%"); // valores formateados en el historial
});

test("al cambiar de recomendación no muestra la anterior mientras carga", async () => {
  const api = await import("@/lib/api");
  const { default: WafDetailDialog } = await import("@/components/waf/WafDetailDialog");

  // rec 9 resuelve de inmediato; rec 10 la controlamos para observar el estado de carga.
  let resolve10!: (v: unknown) => void;
  const p10 = new Promise((res) => { resolve10 = res; });
  (api.getWafRecommendation as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (_clientId: number, id: number) =>
      id === 10 ? p10 : Promise.resolve({
        canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "RI",
        business_impact: "High", resource_count: 2, completion_pct: 10,
        benefit_es: "Ahorra", client_action_es: "Aprobar", bit_action_es: "Comprar",
        remediation_start_date: null, remediation_end_date: null, projected_bit_effort: null,
        execution_log: null, priority_override: null, internal_notes: null,
      }),
  );

  const props = { clientId: 3, pillarName: "Costos", open: true, onOpenChange: () => {}, onChanged: () => {} };
  const { rerender } = render(<WafDetailDialog {...props} canonicalId={9} />);
  await waitFor(() => expect(screen.getByText("Ahorra")).toBeInTheDocument());

  // Cambia a la recomendación 10 (aún cargando): el título de la 9 (código 5.1) NO debe seguir visible.
  rerender(<WafDetailDialog {...props} canonicalId={10} fallbackTitle="2.4 · VNets" />);
  await waitFor(() => expect(screen.queryByText(/5\.1/)).not.toBeInTheDocument());
  // El título muestra el fallback de la lista y "Cargando…" aparece una sola vez (sin redundancia).
  expect(screen.getByText("2.4 · VNets")).toBeInTheDocument();
  expect(screen.getAllByText(/Cargando/)).toHaveLength(1);

  // Al resolver, aparece la 10.
  resolve10({
    canonical_id: 10, matrix_code: "2.4", pillar_number: 2, review_scope_es: "VNets",
    business_impact: "Medium", resource_count: 1, completion_pct: 0,
    benefit_es: "Gobernanza", client_action_es: "x", bit_action_es: "y",
    remediation_start_date: null, remediation_end_date: null, projected_bit_effort: null,
    execution_log: null, priority_override: null, internal_notes: null,
  });
  await waitFor(() => expect(screen.getByText("Gobernanza")).toBeInTheDocument());
});

test("con inglés activo traduce el contenido curado", async () => {
  const { default: WafDetailDialog } = await import("@/components/waf/WafDetailDialog");
  render(<WafDetailDialog clientId={3} canonicalId={9} pillarName="Costos" open english onOpenChange={() => {}} onChanged={() => {}} />);
  await waitFor(() => expect(screen.getByText("EN(Ahorra)")).toBeInTheDocument());
  expect(screen.getByText("EN(Aprobar)")).toBeInTheDocument();
  expect(screen.getByText("EN(Comprar)")).toBeInTheDocument();
});

test("con inglés activo, al cambiar de recomendación no muestra la traducción de la anterior", async () => {
  const api = await import("@/lib/api");
  const { default: WafDetailDialog } = await import("@/components/waf/WafDetailDialog");

  let resolve10!: (v: unknown) => void;
  const p10 = new Promise((res) => { resolve10 = res; });
  (api.getWafRecommendation as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (_c: number, id: number) => id === 10 ? p10 : Promise.resolve({
      canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "RI",
      business_impact: "High", resource_count: 2, completion_pct: 10,
      benefit_es: "Ahorra", client_action_es: "Aprobar", bit_action_es: "Comprar",
      remediation_start_date: null, remediation_end_date: null, projected_bit_effort: null,
      execution_log: null, priority_override: null, internal_notes: null,
    }),
  );

  const props = { clientId: 3, pillarName: "Costos", open: true, english: true, onOpenChange: () => {}, onChanged: () => {} };
  const { rerender } = render(<WafDetailDialog {...props} canonicalId={9} />);
  await waitFor(() => expect(screen.getByText("EN(Ahorra)")).toBeInTheDocument());

  rerender(<WafDetailDialog {...props} canonicalId={10} fallbackTitle="2.4 · VNets" />);
  await waitFor(() => expect(screen.queryByText("EN(Ahorra)")).not.toBeInTheDocument());

  resolve10({
    canonical_id: 10, matrix_code: "2.4", pillar_number: 2, review_scope_es: "VNets",
    business_impact: "Medium", resource_count: 1, completion_pct: 0,
    benefit_es: "Gobernanza", client_action_es: "x", bit_action_es: "y",
    remediation_start_date: null, remediation_end_date: null, projected_bit_effort: null,
    execution_log: null, priority_override: null, internal_notes: null,
  });
  await waitFor(() => expect(screen.getByText("EN(Gobernanza)")).toBeInTheDocument());
  expect(screen.queryByText("EN(Ahorra)")).not.toBeInTheDocument();
});
