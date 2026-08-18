import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import ControlesPreview from "./ControlesPreview";
import type { ParametrosInforme } from "@/lib/informeValor";
import type { CoberturaInsumos } from "@/types";

const base: ParametrosInforme = {
  desde: "2025-09", hasta: "2026-08", corte: "2026-08-18", parcialesAuto: true, parciales: [],
};

function pintar(
  params: Partial<ParametrosInforme> = {}, onChange = vi.fn(), cobertura?: CoberturaInsumos,
) {
  render(
    <ControlesPreview params={{ ...base, ...params }} onChange={onChange}
      onGenerar={vi.fn()} cargando={false} cobertura={cobertura} />,
  );
  return onChange;
}

const cobertura: CoberturaInsumos = {
  facturacion: { desde: "2025-09", hasta: "2026-08" }, evolucion: null, casos: null,
};

const desde = () => screen.getByRole("button", { name: "Primer mes del período" });

test("los meses del periodo se leen enteros, con la etiqueta corta del informe", () => {
  pintar();
  expect(desde()).toHaveTextContent("sep 2025");
  expect(screen.getByRole("button", { name: "Último mes del período" })).toHaveTextContent("ago 2026");
});

test("elegir un mes de la grilla devuelve la clave aaaa-MM", () => {
  const onChange = pintar();
  fireEvent.click(desde());
  fireEvent.click(screen.getByRole("button", { name: "ene" }));
  expect(onChange).toHaveBeenCalledWith({ ...base, desde: "2025-01" });
});

test("la grilla abre en el año del mes elegido y se puede mover de año", () => {
  const onChange = pintar();
  fireEvent.click(desde());
  expect(screen.getByText("2025")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Año anterior" }));
  fireEvent.click(screen.getByRole("button", { name: "sep" }));
  expect(onChange).toHaveBeenCalledWith({ ...base, desde: "2024-09" });
});

test("el año navegado no se queda pegado: al reabrir vuelve al del mes elegido", () => {
  pintar();
  fireEvent.click(desde());
  fireEvent.click(screen.getByRole("button", { name: "Año siguiente" }));
  expect(screen.getByText("2026")).toBeInTheDocument();
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  fireEvent.click(desde());
  expect(screen.getByText("2025")).toBeInTheDocument();
});

test("el rango invertido avisa y no deja pedir el informe", () => {
  pintar({ desde: "2026-08", hasta: "2025-09" });
  expect(screen.getByText(/El rango está invertido/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Ver el informe/ })).toBeDisabled();
});

test("la pantalla dice que insumo respalda el periodo y hasta donde llega", () => {
  pintar({}, vi.fn(), cobertura);
  expect(screen.getByText(/El insumo de facturación \(BITCOST\) cubre/)).toBeInTheDocument();
  expect(screen.getByText("sep 2025 a ago 2026")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Volver al del insumo" })).not.toBeInTheDocument();
});

test("con un periodo corrido a mano ofrece volver al del insumo", () => {
  const onChange = pintar({ desde: "2024-01" }, vi.fn(), cobertura);
  fireEvent.click(screen.getByRole("button", { name: "Volver al del insumo" }));
  expect(onChange).toHaveBeenCalledWith({ ...base, desde: "2025-09", hasta: "2026-08" });
});

test("sin insumos con meses lo dice, en vez de callar de donde salio el rango", () => {
  pintar();
  expect(screen.getByText(/Ningún insumo cargado trae meses todavía/)).toBeInTheDocument();
});
