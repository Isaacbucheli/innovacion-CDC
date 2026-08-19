import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  previewWafExcel: vi.fn(async () => ({
    file_name: "m.xlsx", client_id: 3, rows_total: 2, rows_matched: 1, rows_needs_review: 0, ai_enabled: true,
    rows: [
      { row: { row_number: 1, pillar_number: 5, excel_code: "5.1", title: "RI", raw_scope: "s", completion_pct: 80, remediation_start_date: null, execution_log: null, benefit: "b", actions: "a", impact: "High", projected_bit_effort: "8h", resources: [], warnings: [] }, status: "matched", can_create: true, match_source: "deterministic", confidence: 0.9, reason: "", suggested_match: { canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "x", advisor_name: "y" } },
      { row: { row_number: 2, pillar_number: 1, excel_code: "1.7", title: "Probes", raw_scope: "s2", completion_pct: 0, remediation_start_date: null, execution_log: null, benefit: "b", actions: "a", impact: "Low", projected_bit_effort: "", resources: [], warnings: [] }, status: "new", can_create: true, match_source: null, confidence: null, reason: "", suggested_match: null },
    ],
  })),
  applyWafExcel: vi.fn(async () => ({ message: "ok", client_id: 3, rows_applied: 1, rows_created: 1, rows_skipped: 0, changed_fields: {}, errors: [] })),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

test("el preview muestra las filas descartadas por el parser (UPL-01)", async () => {
  const { default: ExcelImportDialog } = await import("@/components/waf/ExcelImportDialog");
  const { previewWafExcel } = await import("@/lib/api");
  (previewWafExcel as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    file_name: "m.xlsx", client_id: 3, rows_total: 1, rows_matched: 1, rows_needs_review: 0, ai_enabled: true,
    metrics: {
      sheet: "Resultados", rows_total: 1, rows_with_warnings: 0,
      header_found: true, rows_skipped: 3,
      warnings: ["Fila 5: descartada (sin código de matriz (N.N) ni seguimiento reconocible)."],
    },
    rows: [
      { row: { row_number: 1, pillar_number: 5, excel_code: "5.1", title: "RI", raw_scope: "s", completion_pct: 80, remediation_start_date: null, execution_log: null, benefit: "b", actions: "a", impact: "High", projected_bit_effort: "8h", resources: [], warnings: [] }, status: "matched", can_create: true, match_source: "deterministic", confidence: 0.9, reason: "", suggested_match: { canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "x", advisor_name: "y" } },
    ],
  });
  render(<ExcelImportDialog open clientId={3} onOpenChange={() => {}} onChanged={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(/archivo excel/i), { target: { files: [new File(["x"], "m.xlsx")] } });
  fireEvent.click(screen.getByRole("button", { name: /generar preview/i }));
  await waitFor(() => expect(screen.getByText("RI")).toBeInTheDocument());
  expect(screen.getByText(/3 filas descartadas/i)).toBeInTheDocument();
  expect(screen.getByText(/Fila 5: descartada/i)).toBeInTheDocument();
});

test("genera preview, muestra filas y aplica las aprobadas", async () => {
  const { default: ExcelImportDialog } = await import("@/components/waf/ExcelImportDialog");
  const { applyWafExcel } = await import("@/lib/api");
  const onChanged = vi.fn();
  render(<ExcelImportDialog open clientId={3} onOpenChange={() => {}} onChanged={onChanged} />);
  // paso 1: elegir archivo + generar preview
  fireEvent.change(screen.getByLabelText(/archivo excel/i), { target: { files: [new File(["x"], "m.xlsx")] } });
  fireEvent.click(screen.getByRole("button", { name: /generar preview/i }));
  // paso 2: ver filas
  await waitFor(() => expect(screen.getByText("RI")).toBeInTheDocument());
  expect(screen.getByText("Probes")).toBeInTheDocument();
  // aplicar
  fireEvent.click(screen.getByRole("button", { name: /aplicar/i }));
  await waitFor(() => expect(applyWafExcel).toHaveBeenCalled());
  const body = (applyWafExcel as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
  expect(body.rows).toHaveLength(2); // ambas aprobadas por defecto (matched + new)
  expect(body.rows[0]).toMatchObject({ action: "update", canonical_id: 9 });
  expect(body.rows[1]).toMatchObject({ action: "create", pillar_number: 1 });
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});
