import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { expect, test, vi, beforeEach } from "vitest";

// Mutable default state for hook mock, allows per-test override
const mockUseWafState = {
  clients: [{ client_id: 3, client_name: "Banco Demo", has_logo: false }],
  clientId: 3 as number | null,
  summary: { client_id: 3, recommendations: 1, active_recommendations: 1, cost_recommendations: 0, active_findings: 2, latest_ingestion: null },
  sections: [{ section_num: 5, section_name: "Costos", total_recs: 1, total_resources: 2, avg_progress: 10, high_recs: 1, medium_recs: 0 }],
  recommendations: [{ canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "RI", business_impact: "High", resource_count: 2, completion_pct: 10, remediation_end_date: null }],
  pillarNames: { 5: "Costos" },
  loading: false,
  dataLoading: false,
  error: "",
  selectClient: vi.fn(),
  reloadData: vi.fn(),
  markRecommendationRead: vi.fn(),
};

vi.mock("@/hooks/useWaf", () => ({
  useWaf: () => ({ ...mockUseWafState }),
}));

// Reset mock state before each test
beforeEach(() => {
  mockUseWafState.clients = [{ client_id: 3, client_name: "Banco Demo", has_logo: false }];
  mockUseWafState.clientId = 3;
  mockUseWafState.summary = { client_id: 3, recommendations: 1, active_recommendations: 1, cost_recommendations: 0, active_findings: 2, latest_ingestion: null };
  mockUseWafState.sections = [{ section_num: 5, section_name: "Costos", total_recs: 1, total_resources: 2, avg_progress: 10, high_recs: 1, medium_recs: 0 }];
  mockUseWafState.recommendations = [{ canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "RI", business_impact: "High", resource_count: 2, completion_pct: 10, remediation_end_date: null }];
  mockUseWafState.pillarNames = { 5: "Costos" };
  mockUseWafState.loading = false;
  mockUseWafState.dataLoading = false;
  mockUseWafState.error = "";
  vi.clearAllMocks();
});
vi.mock("@/lib/api", () => ({
  fetchClientLogoObjectUrl: vi.fn(async () => null),
  runWafAdvisorSync: vi.fn(),
  uploadWafIngestion: vi.fn(),
  listClientSubscriptions: vi.fn(async () => []),
  downloadFromApi: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ canEdit: () => true, canEditModule: () => true, getRole: () => "admin", getName: () => "BIT", canViewModule: () => true }));

test("renderiza la vista WAF con KPIs, pilar y tabla", async () => {
  const { default: WafPage } = await import("@/components/waf/WafPage");
  render(<ThemeProvider attribute="class" defaultTheme="light"><WafPage /></ThemeProvider>);
  await waitFor(() => expect(screen.getByText("RI")).toBeInTheDocument());
  expect(screen.getByRole("button", { name: /consultar advisor/i })).toBeInTheDocument();
  expect(screen.getByText("Recomendaciones activas")).toBeInTheDocument();
  expect(screen.getAllByText("Costos").length).toBeGreaterThan(0);
  expect(screen.getByText("Recursos afectados")).toBeInTheDocument();
  expect(screen.getByText("Avance promedio")).toBeInTheDocument();
  expect(screen.getAllByText("10%").length).toBeGreaterThan(0);
});

test("no muestra la barra de acciones si no hay cliente", async () => {
  // Override the hook state: no client selected
  mockUseWafState.clientId = null;
  mockUseWafState.clients = [];
  mockUseWafState.recommendations = [];
  mockUseWafState.sections = [];

  const { default: WafPage } = await import("@/components/waf/WafPage");
  render(<ThemeProvider attribute="class" defaultTheme="light"><WafPage /></ThemeProvider>);

  // WafActions component should not render when clientId is null
  // So none of its buttons should exist
  expect(screen.queryByRole("button", { name: /consultar advisor/i })).toBeNull();
  expect(screen.queryByRole("button", { name: /exportar excel/i })).toBeNull();
  expect(screen.queryByRole("button", { name: /opciones/i })).toBeNull();
});
