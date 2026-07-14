import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  runWafAdvisorSync: vi.fn(async () => ({ active: true, created: true, job_id: 7, client_id: 3, run_id: null, status: "queued", subscriptions_total: 1, subscriptions_queued: 1, subscriptions_processed: 0, subscriptions_failed: 0, new_recommendations: 0, new_findings: 0, resolved_findings: 0 })),
  getWafAdvisorSyncStatus: vi.fn(),
  uploadWafIngestion: vi.fn(async () => ({})),
  listClientSubscriptions: vi.fn(async () => [{ client_subscription_id: 1, subscription_id: "sub-A", subscription_name: "Producción", is_active: true, is_managed: true }]),
  downloadFromApi: vi.fn(async () => {}),
  consolidateWafDuplicates: vi.fn(async () => ({ message: "ok", client_id: 3, merged: 3, ai_calls: 5 })),
  refreshWafAdvisorScore: vi.fn(async () => ({ message: "ok", clients_total: 1, clients_refreshed: 1, clients_failed: 0, results: [] })),
  previewWafExcel: vi.fn(async () => ({ file_name: "m.xlsx", client_id: 3, rows_total: 0, rows_matched: 0, rows_needs_review: 0, ai_enabled: true, rows: [] })),
  applyWafExcel: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ canEdit: () => true, getRole: () => "admin" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

test("muestra el primario, Exportar y Opciones; Exportar descarga", async () => {
  const { default: WafActions } = await import("@/components/waf/WafActions");
  const { downloadFromApi } = await import("@/lib/api");
  render(<WafActions clientId={3} onChanged={vi.fn()} />);
  expect(screen.getByRole("button", { name: /consultar advisor/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /exportar excel/i }));
  await waitFor(() => expect(downloadFromApi).toHaveBeenCalled());
});

test("Consultar Advisor: selecciona, encola y guarda el job para el bloqueo global", async () => {
  const { default: WafActions } = await import("@/components/waf/WafActions");
  const { runWafAdvisorSync } = await import("@/lib/api");
  const onChanged = vi.fn();
  render(<WafActions clientId={3} onChanged={onChanged} />);
  fireEvent.click(screen.getByRole("button", { name: /consultar advisor/i }));
  await waitFor(() => expect(screen.getByText("Producción")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /^consultar$/i }));
  await waitFor(() => expect(runWafAdvisorSync).toHaveBeenCalledWith(3, { subscriptions: ["sub-A"], timeout_seconds_per_subscription: 600 }));
  expect(JSON.parse(localStorage.getItem("innovacion_cdc_advisor_sync_job") || "null")).toEqual({ clientId: 3, jobId: 7 });
  expect(onChanged).not.toHaveBeenCalled();
});

test("Consolidar duplicados llama a la API y refresca", async () => {
  const { default: WafActions } = await import("@/components/waf/WafActions");
  const { consolidateWafDuplicates } = await import("@/lib/api");
  const onChanged = vi.fn();
  render(<WafActions clientId={3} onChanged={onChanged} />);
  const opcionesBtn = screen.getByRole("button", { name: /opciones/i });
  fireEvent.pointerDown(opcionesBtn, { button: 0, ctrlKey: false });
  fireEvent.click(opcionesBtn);
  const consolidarItem = await screen.findByText(/consolidar duplicados/i);
  fireEvent.click(consolidarItem);
  fireEvent.click(await screen.findByRole("button", { name: /^consolidar$/i }));
  await waitFor(() => expect(consolidateWafDuplicates).toHaveBeenCalledWith(3, true));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});

test("Actualizar Advisor Score llama a la API y refresca", async () => {
  const { default: WafActions } = await import("@/components/waf/WafActions");
  const { refreshWafAdvisorScore } = await import("@/lib/api");
  const onChanged = vi.fn();
  render(<WafActions clientId={3} onChanged={onChanged} />);
  const opcionesBtn = screen.getByRole("button", { name: /opciones/i });
  fireEvent.pointerDown(opcionesBtn, { button: 0, ctrlKey: false });
  fireEvent.click(opcionesBtn);
  const scoreItem = await screen.findByText(/actualizar advisor score/i);
  fireEvent.click(scoreItem);
  fireEvent.click(await screen.findByRole("button", { name: /^actualizar$/i }));
  await waitFor(() => expect(refreshWafAdvisorScore).toHaveBeenCalledWith(3, false));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});

test("Importar matriz Excel abre el diálogo de preview", async () => {
  const { default: WafActions } = await import("@/components/waf/WafActions");
  render(<WafActions clientId={3} onChanged={vi.fn()} />);
  const opcionesBtn = screen.getByRole("button", { name: /opciones/i });
  fireEvent.pointerDown(opcionesBtn, { button: 0, ctrlKey: false });
  fireEvent.click(opcionesBtn);
  fireEvent.click(await screen.findByText(/importar matriz excel/i));
  expect(await screen.findByText(/sube la matriz waf/i)).toBeInTheDocument();
});
