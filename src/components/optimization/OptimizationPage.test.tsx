import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { beforeEach, expect, test, vi } from "vitest";
import type { OptFinding, OptScan } from "@/types";

const scan: OptScan = {
  scan_id: 1, started_at: "2026-07-03T14:00:00Z", finished_at: "2026-07-03T14:02:00Z",
  status: "completed", subscriptions_scanned: 12, findings_count: 2,
  total_estimated_monthly_savings: 300, currency: "USD",
};

const F = (over: Partial<OptFinding>): OptFinding => ({
  check_id: "orphaned_disks", category: "cost_waste", severity: "medium",
  subscription_id: "sub", azure_resource_id: "/id", resource_name: "r", resource_type: "t",
  region: "eastus2", details: {}, estimated_monthly_savings: 100, currency: "USD",
  fingerprint: "ab", state: "abierto", notes: null, ...over,
});

const mockState = {
  clients: [{ client_id: 6, client_name: "BICSA", has_logo: false }],
  clientId: 6 as number | null,
  allowed: true as boolean | null,
  scans: [scan],
  latestScan: scan as OptScan | null,
  findings: [
    F({ check_id: "vms_without_ahb", estimated_monthly_savings: 200 }),
    F({ check_id: "orphaned_disks", estimated_monthly_savings: 100 }),
  ] as OptFinding[],
  loading: false, dataLoading: false, error: "",
  selectClient: vi.fn(), reload: vi.fn(),
};

vi.mock("@/hooks/useOptimization", () => ({ useOptimization: () => ({ ...mockState }) }));
vi.mock("@/components/optimization/SavingsDonut", () => ({ default: () => null }));

beforeEach(() => {
  mockState.allowed = true;
  mockState.latestScan = scan;
  mockState.findings = [
    F({ check_id: "vms_without_ahb", estimated_monthly_savings: 200 }),
    F({ check_id: "orphaned_disks", estimated_monthly_savings: 100 }),
  ];
});

async function renderPage() {
  const { default: OptimizationPage } = await import("@/components/optimization/OptimizationPage");
  return render(
    <ThemeProvider attribute="class">
      <OptimizationPage />
    </ThemeProvider>,
  );
}

test("renderiza las secciones Rate y Usage con sus grupos", async () => {
  await renderPage();
  expect(screen.getByText("Rate optimization")).toBeInTheDocument();
  expect(screen.getByText("Usage optimization")).toBeInTheDocument();
  expect(screen.getByText("Azure Hybrid Benefit")).toBeInTheDocument(); // grupo AHB (rate)
  expect(screen.getByText("Storage")).toBeInTheDocument(); // grupo usage
});

test("gatea el módulo cuando no hay acceso", async () => {
  mockState.allowed = false;
  await renderPage();
  expect(screen.getByText(/Módulo no disponible/i)).toBeInTheDocument();
  expect(screen.queryByText("Usage optimization")).not.toBeInTheDocument();
});

test("muestra estado vacío cuando el cliente no tiene barridos", async () => {
  mockState.latestScan = null;
  mockState.findings = [];
  await renderPage();
  expect(screen.getByText(/aún no tiene barridos/i)).toBeInTheDocument();
});

test("el botón Exportar abre el diálogo de estados", async () => {
  const { fireEvent } = await import("@testing-library/react");
  await renderPage();
  const btn = screen.getByRole("button", { name: /exportar/i });
  expect(btn).toBeEnabled();
  fireEvent.click(btn);
  expect(screen.getByText("Exportar Excel")).toBeInTheDocument();
  expect(screen.getByText(/hallazgos incluidos/i)).toBeInTheDocument();
});

test("sin hallazgos el botón Exportar queda deshabilitado", async () => {
  mockState.findings = [];
  await renderPage();
  expect(screen.getByRole("button", { name: /exportar/i })).toBeDisabled();
});
