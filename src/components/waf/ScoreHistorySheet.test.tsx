import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ScoreHistorySheet from "@/components/waf/ScoreHistorySheet";

vi.mock("@/lib/api", () => ({
  getWafScoreHistory: vi.fn(async () => ({
    granularity: "month",
    series: [
      { date: "2026-05-01", global: 70, pillars: { "3": 40 } },
      { date: "2026-06-01", global: 76, pillars: { "3": 45 } },
    ],
  })),
}));

// recharts no mide en jsdom → evita ruido; solo verificamos estructura/estado.
vi.mock("@/components/reports/ReportLine", () => ({
  default: () => <div data-testid="report-line" />,
}));

describe("ScoreHistorySheet", () => {
  beforeEach(() => vi.clearAllMocks());

  test("al abrir carga el historial y muestra el chart", async () => {
    render(<ScoreHistorySheet clientId={7} open onOpenChange={() => {}} pillarNames={{ 3: "Seguridad" }} />);
    await waitFor(() => expect(screen.getByTestId("report-line")).toBeTruthy());
  });

  test("estado vacío cuando no hay serie", async () => {
    const api = await import("@/lib/api");
    (api.getWafScoreHistory as unknown as { mockResolvedValueOnce: (v: unknown) => void })
      .mockResolvedValueOnce({ granularity: "month", series: [] });
    render(<ScoreHistorySheet clientId={7} open onOpenChange={() => {}} pillarNames={{}} />);
    await waitFor(() => expect(screen.getByText(/sin hist/i)).toBeTruthy());
  });
});
