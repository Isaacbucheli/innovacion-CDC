import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { expect, test, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  listClientsAdmin: vi.fn(async () => [{ client_id: 3, client_name: "BANISI", has_logo: false }]),
  getWafCostReference: vi.fn(async () => ({
    client_id: 3, has_cost_data: true, disclaimer: "Valor referencial…", analysis_id: 7, analysis_name: "Eval",
    totals: { payg_monthly: 5991, ri_1y_monthly: 4200, ri_3y_monthly: 3100, resources_total: 50, resources_matched: 40, resources_priced: 35 },
    items: [{ canonical_id: 9, matrix_code: "5.1", review_scope_es: "Reserved Instances", business_impact: "High", resources_total: 31, resources_matched: 28, resources_priced: 25, payg_monthly: 3000, ri_1y_monthly: 2100, ri_3y_monthly: 1500 }],
  })),
  fetchClientLogoObjectUrl: vi.fn(async () => null),
}));

test("muestra KPIs y la tabla de costo referencial", async () => {
  const { default: CostReferencePage } = await import("@/components/waf/CostReferencePage");
  render(<ThemeProvider attribute="class" defaultTheme="light"><CostReferencePage /></ThemeProvider>);
  await waitFor(() => expect(screen.getByText("Reserved Instances")).toBeInTheDocument());
  expect(screen.getAllByText(/PAYG/i).length).toBeGreaterThan(0);
});
