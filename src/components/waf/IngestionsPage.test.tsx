import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { expect, test, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  listClientsAdmin: vi.fn(async () => [{ client_id: 3, client_name: "Banco Demo", has_logo: false }]),
  getWafIngestionRuns: vi.fn(async () => [{ run_id: 1, source_file_name: "Advisor_Export.csv", status: "completed", rows_total: 100, rows_processed: 100, new_recommendations: 5, new_findings: 20, resolved_findings: 2, started_at: "2026-06-25T10:00:00Z", completed_at: "2026-06-25T10:02:00Z", created_by: "isaac", error_message: null }]),
  fetchClientLogoObjectUrl: vi.fn(async () => null),
}));

test("muestra la tabla de ingestas", async () => {
  const { default: IngestionsPage } = await import("@/components/waf/IngestionsPage");
  render(<ThemeProvider attribute="class" defaultTheme="light"><IngestionsPage /></ThemeProvider>);
  await waitFor(() => expect(screen.getByText("Advisor_Export.csv")).toBeInTheDocument());
  expect(screen.getByText(/completed/i)).toBeInTheDocument();
});
