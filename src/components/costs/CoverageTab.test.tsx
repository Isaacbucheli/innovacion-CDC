import { render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import CoverageTab from "@/components/costs/CoverageTab";
import * as api from "@/lib/api";
import type { CoverageResult } from "@/types";

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

test("descarta la respuesta vieja si analysisId cambió en vuelo", async () => {
  // Cola de resolvers por orden de invocación de getCoverage. Sin StrictMode en el
  // entorno de test, cada cambio de analysisId dispara exactamente una llamada:
  // deferred[0] corresponde a analysisId=1, deferred[1] a analysisId=2.
  const deferred: { resolve: (v: CoverageResult) => void }[] = [];
  vi.spyOn(api, "getCoverage").mockImplementation(
    () => new Promise<CoverageResult>((resolve) => { deferred.push({ resolve }); }),
  );
  const { rerender } = render(<CoverageTab analysisId={1} />);
  rerender(<CoverageTab analysisId={2} />);
  await waitFor(() => expect(deferred.length).toBe(2));

  deferred[1].resolve({ total_resources: 10, costed_resources: 10, coverage_pct: 100, uncovered: [] });
  await waitFor(() => expect(screen.getByText("10 de 10 recursos")).toBeInTheDocument());

  deferred[0].resolve({ total_resources: 5, costed_resources: 1, coverage_pct: 20, uncovered: [] });
  // la respuesta vieja (analysisId=1) NO debe pisar los datos nuevos
  await waitFor(() => expect(screen.getByText("10 de 10 recursos")).toBeInTheDocument());
  expect(screen.queryByText("1 de 5 recursos")).not.toBeInTheDocument();
});
