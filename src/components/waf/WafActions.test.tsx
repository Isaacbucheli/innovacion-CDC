import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach, afterEach } from "vitest";

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
  getWafScoreHistory: vi.fn(async () => ({ granularity: "month", series: [] })),
}));
vi.mock("@/lib/auth", () => ({ canEdit: () => true, canEditModule: vi.fn(() => true), getRole: vi.fn(() => "admin") }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
// Mis tests de gating mutan las implementaciones de canEditModule/getRole; clearAllMocks no borra
// implementaciones, así que las restauro para no contaminar los tests hermanos.
afterEach(async () => {
  const { canEditModule, getRole } = await import("@/lib/auth");
  vi.mocked(canEditModule).mockImplementation(() => true);
  vi.mocked(getRole).mockReturnValue("admin");
});

test("muestra el primario, Exportar y Opciones; Exportar descarga", async () => {
  const { default: WafActions } = await import("@/components/waf/WafActions");
  const { downloadFromApi } = await import("@/lib/api");
  render(<WafActions clientId={3} onChanged={vi.fn()} pillarNames={{}} />);
  expect(screen.getByRole("button", { name: /consultar advisor/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /exportar excel/i }));
  await waitFor(() => expect(downloadFromApi).toHaveBeenCalled());
});

test("Consultar Advisor: selecciona, encola y guarda el job para el bloqueo global", async () => {
  const { default: WafActions } = await import("@/components/waf/WafActions");
  const { runWafAdvisorSync } = await import("@/lib/api");
  const onChanged = vi.fn();
  render(<WafActions clientId={3} onChanged={onChanged} pillarNames={{}} />);
  fireEvent.click(screen.getByRole("button", { name: /consultar advisor/i }));
  await waitFor(() => expect(screen.getByText("Producción")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /^consultar$/i }));
  await waitFor(() => expect(runWafAdvisorSync).toHaveBeenCalledWith(3, { subscriptions: ["sub-A"], timeout_seconds_per_subscription: 600 }));
  expect(JSON.parse(localStorage.getItem("innovacion_cdc_advisor_sync_job") || "null")).toEqual({ clientId: 3, jobId: 7 });
  expect(onChanged).not.toHaveBeenCalled();
});

test("un lector (sin edición) ve Opciones con solo Histórico del score", async () => {
  const { canEditModule, getRole } = await import("@/lib/auth");
  vi.mocked(canEditModule).mockImplementation(() => false);
  vi.mocked(getRole).mockReturnValue("lector");
  const { default: WafActions } = await import("@/components/waf/WafActions");
  render(<WafActions clientId={3} onChanged={vi.fn()} pillarNames={{}} />);
  expect(screen.queryByRole("button", { name: /consultar advisor/i })).not.toBeInTheDocument();
  const opcionesBtn = screen.getByRole("button", { name: /opciones/i });
  fireEvent.pointerDown(opcionesBtn, { button: 0, ctrlKey: false });
  fireEvent.click(opcionesBtn);
  expect(await screen.findByText(/histórico del score/i)).toBeInTheDocument();
  expect(screen.queryByText(/importar/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/consolidar duplicados/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/actualizar advisor score/i)).not.toBeInTheDocument();
});

test("Histórico del score en Opciones abre el panel", async () => {
  const { default: WafActions } = await import("@/components/waf/WafActions");
  render(<WafActions clientId={3} onChanged={vi.fn()} pillarNames={{}} />);
  const opcionesBtn = screen.getByRole("button", { name: /opciones/i });
  fireEvent.pointerDown(opcionesBtn, { button: 0, ctrlKey: false });
  fireEvent.click(opcionesBtn);
  fireEvent.click(await screen.findByText(/histórico del score/i));
  expect(await screen.findByText(/histórico del advisor score/i)).toBeInTheDocument();
});

test("Consolidar duplicados llama a la API y refresca", async () => {
  const { default: WafActions } = await import("@/components/waf/WafActions");
  const { consolidateWafDuplicates } = await import("@/lib/api");
  const onChanged = vi.fn();
  render(<WafActions clientId={3} onChanged={onChanged} pillarNames={{}} />);
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
  render(<WafActions clientId={3} onChanged={onChanged} pillarNames={{}} />);
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
  render(<WafActions clientId={3} onChanged={vi.fn()} pillarNames={{}} />);
  const opcionesBtn = screen.getByRole("button", { name: /opciones/i });
  fireEvent.pointerDown(opcionesBtn, { button: 0, ctrlKey: false });
  fireEvent.click(opcionesBtn);
  fireEvent.click(await screen.findByText(/importar matriz excel/i));
  expect(await screen.findByText(/sube la matriz waf/i)).toBeInTheDocument();
});

test("Importar Advisor CSV sigue el permiso de waf-ingestions, no el de waf", async () => {
  const { canEditModule } = await import("@/lib/auth");
  vi.mocked(canEditModule).mockImplementation((key: string) => key === "waf");
  const { default: WafActions } = await import("@/components/waf/WafActions");
  render(<WafActions clientId={3} onChanged={vi.fn()} pillarNames={{}} />);
  const opcionesBtn = screen.getByRole("button", { name: /opciones/i });
  fireEvent.pointerDown(opcionesBtn, { button: 0, ctrlKey: false });
  fireEvent.click(opcionesBtn);
  expect(await screen.findByText(/importar matriz excel/i)).toBeInTheDocument();
  expect(screen.queryByText(/importar advisor csv/i)).not.toBeInTheDocument();
});

test("con solo permiso de waf-ingestions, el dropdown Opciones aparece y permite importar CSV aunque falte edición de waf", async () => {
  const { canEditModule } = await import("@/lib/auth");
  vi.mocked(canEditModule).mockImplementation((key: string) => key === "waf-ingestions");
  const { default: WafActions } = await import("@/components/waf/WafActions");
  render(<WafActions clientId={3} onChanged={vi.fn()} pillarNames={{}} />);
  expect(screen.queryByRole("button", { name: /consultar advisor/i })).not.toBeInTheDocument();
  const opcionesBtn = screen.getByRole("button", { name: /opciones/i });
  fireEvent.pointerDown(opcionesBtn, { button: 0, ctrlKey: false });
  fireEvent.click(opcionesBtn);
  fireEvent.click(await screen.findByText(/importar advisor csv/i));
  expect(await screen.findByText(/carga un export csv de azure advisor/i)).toBeInTheDocument();
  expect(screen.queryByText(/importar matriz excel/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/consolidar duplicados/i)).not.toBeInTheDocument();
});
