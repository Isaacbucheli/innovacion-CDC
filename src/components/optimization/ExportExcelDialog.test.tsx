import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import ExportExcelDialog from "@/components/optimization/ExportExcelDialog";
import type { OptFinding } from "@/types";

const F = (state: OptFinding["state"]): OptFinding => ({
  check_id: "orphaned_disks", category: "cost_waste", severity: "medium",
  subscription_id: "s", azure_resource_id: "/id", resource_name: "r", resource_type: "t",
  region: "eastus2", details: {}, estimated_monthly_savings: 10, currency: "USD",
  fingerprint: "ab", state, notes: null,
});

const findings = [F("abierto"), F("abierto"), F("en_progreso"), F("resuelto")];

test("por defecto marca abierto y en progreso, y cuenta los incluidos", () => {
  render(<ExportExcelDialog open onOpenChange={() => {}} findings={findings} onConfirm={() => {}} />);
  expect(screen.getByRole("checkbox", { name: /abierto/i })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: /en progreso/i })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: /resuelto/i })).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: /ignorado/i })).not.toBeChecked();
  expect(screen.getByText(/3 hallazgos incluidos/i)).toBeInTheDocument();
});

test("confirmar pasa los estados seleccionados", () => {
  const onConfirm = vi.fn();
  render(<ExportExcelDialog open onOpenChange={() => {}} findings={findings} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByRole("checkbox", { name: /resuelto/i })); // agrega resuelto
  fireEvent.click(screen.getByRole("button", { name: /exportar/i }));
  expect(onConfirm).toHaveBeenCalledWith(["abierto", "en_progreso", "resuelto"]);
});

test("sin estados marcados el botón queda deshabilitado", () => {
  render(<ExportExcelDialog open onOpenChange={() => {}} findings={findings} onConfirm={() => {}} />);
  fireEvent.click(screen.getByRole("checkbox", { name: /abierto/i }));
  fireEvent.click(screen.getByRole("checkbox", { name: /en progreso/i }));
  expect(screen.getByRole("button", { name: /exportar/i })).toBeDisabled();
});
