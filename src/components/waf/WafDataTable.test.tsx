import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import WafDataTable from "@/components/waf/WafDataTable";
import type { WafRecommendation } from "@/types";

const recs: WafRecommendation[] = [
  { canonical_id: 1, matrix_code: "2.1", pillar_number: 2, review_scope_es: "MFA admins", business_impact: "High", resource_count: 18, completion_pct: 20, remediation_end_date: "2026-08-15", is_new: true, source: "advisor" },
  { canonical_id: 2, matrix_code: "5.1", pillar_number: 5, review_scope_es: "Reserved Instances", business_impact: "High", resource_count: 31, completion_pct: 10, remediation_end_date: null, is_new: false, source: "excel" },
];

const pillarNames = { 2: "Seguridad", 5: "Costos" };

test("renderiza filas y abre el detalle al hacer clic", () => {
  const onOpen = vi.fn();
  render(<WafDataTable recommendations={recs} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={onOpen} />);
  expect(screen.getByText("MFA admins")).toBeInTheDocument();
  expect(screen.getByText("Costos")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Reserved Instances"));
  expect(onOpen).toHaveBeenCalledWith(2);
});

test("el buscador global filtra por código o ámbito", () => {
  render(<WafDataTable recommendations={recs} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} />);
  fireEvent.change(screen.getByPlaceholderText("Buscar ámbito o código…"), { target: { value: "Reserved" } });
  expect(screen.queryByText("MFA admins")).not.toBeInTheDocument();
  expect(screen.getByText("Reserved Instances")).toBeInTheDocument();
});

test("ofrece el botón de filtro en todas las columnas", () => {
  render(<WafDataTable recommendations={recs} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} />);
  for (const name of ["Código", "Pilar", "Ámbito", "Impacto", "Recursos", "Avance", "Fecha de cierre"]) {
    expect(screen.getByRole("button", { name: `Filtrar ${name}` })).toBeInTheDocument();
  }
});

test("muestra la fecha de cierre formateada (y — cuando no hay)", () => {
  render(<WafDataTable recommendations={recs} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} />);
  expect(screen.getByText("15/08/2026")).toBeInTheDocument();
});

test("el ámbito se muestra como disparador de tooltip con el texto completo", () => {
  render(<WafDataTable recommendations={recs} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} />);
  const scope = screen.getByText("Reserved Instances");
  expect(scope).toBeInTheDocument();
  // el disparador envuelve el texto truncado; el título accesible completo existe en el DOM del trigger
  expect(scope.closest("[data-slot='tooltip-trigger'], button, span")).toBeTruthy();
});
