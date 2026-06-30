import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  listClientsAdmin: vi.fn(() => Promise.resolve([{ client_id: 1, client_name: "ACME", is_active: true, has_logo: false }])),
  listReports: vi.fn(() => Promise.resolve({ client_id: 1, reports: [] })),
  getMonthlyReport: vi.fn(() => Promise.resolve({})),
  generateReport: vi.fn(() => Promise.resolve({ client_id: 1, year: 2026, month: 6, status: "generating" })),
}));

import ReportPage from "@/components/reports/ReportPage";

function renderPage() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <ReportPage />
    </ThemeProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

test("muestra el título y el estado vacío cuando no hay informe del periodo", async () => {
  renderPage();
  expect(await screen.findByRole("heading", { name: "Informe de gestión mensual" })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText(/No hay informe para/i)).toBeInTheDocument());
});
