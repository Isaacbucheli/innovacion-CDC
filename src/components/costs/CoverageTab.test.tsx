import { render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import CoverageTab from "@/components/costs/CoverageTab";
import * as api from "@/lib/api";

test("muestra KPIs y tabla de tipos no costeados", async () => {
  vi.spyOn(api, "getCoverage").mockResolvedValue({
    total_resources: 120,
    costed_resources: 90,
    coverage_pct: 75,
    uncovered: [
      { resource_type: "microsoft.network/virtualnetworks", display_name: "Virtual network", service_category: "Networking", count: 12 },
    ],
  });
  render(<CoverageTab analysisId={7} />);
  await waitFor(() => expect(screen.getByText("75%")).toBeInTheDocument());
  expect(screen.getByText("90 de 120 recursos")).toBeInTheDocument();
  expect(screen.getByText("Virtual network")).toBeInTheDocument();
  expect(screen.getByText("Networking")).toBeInTheDocument();
});

test("error de API muestra mensaje sin romper", async () => {
  vi.spyOn(api, "getCoverage").mockRejectedValue(new Error("500"));
  render(<CoverageTab analysisId={7} />);
  await waitFor(() => expect(screen.getByText(/No se pudo cargar la cobertura/i)).toBeInTheDocument());
});
