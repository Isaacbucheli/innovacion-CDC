import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  runWafAdvisorSync: vi.fn(async () => ({ run_id: 1, status: "completed", subscriptions_queued: 1, subscriptions_processed: 1, subscriptions_failed: 0, new_recommendations: 5, new_findings: 9, resolved_findings: 2 })),
  uploadWafIngestion: vi.fn(async () => ({})),
  listClientSubscriptions: vi.fn(async () => [{ client_subscription_id: 1, subscription_id: "sub-A", subscription_name: "Producción", is_active: true, is_managed: true }]),
  downloadFromApi: vi.fn(async () => {}),
}));
vi.mock("@/lib/auth", () => ({ canEdit: () => true }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

test("muestra el primario, Exportar y Opciones; Exportar descarga", async () => {
  const { default: WafActions } = await import("@/components/waf/WafActions");
  const { downloadFromApi } = await import("@/lib/api");
  render(<WafActions clientId={3} onChanged={vi.fn()} />);
  expect(screen.getByRole("button", { name: /consultar advisor/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /exportar excel/i }));
  await waitFor(() => expect(downloadFromApi).toHaveBeenCalled());
});

test("Consultar Advisor: selecciona y llama al sync, luego onChanged", async () => {
  const { default: WafActions } = await import("@/components/waf/WafActions");
  const { runWafAdvisorSync } = await import("@/lib/api");
  const onChanged = vi.fn();
  render(<WafActions clientId={3} onChanged={onChanged} />);
  fireEvent.click(screen.getByRole("button", { name: /consultar advisor/i }));
  await waitFor(() => expect(screen.getByText("Producción")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /^consultar$/i }));
  await waitFor(() => expect(runWafAdvisorSync).toHaveBeenCalledWith(3, { subscriptions: ["sub-A"], timeout_seconds_per_subscription: 600 }));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});
