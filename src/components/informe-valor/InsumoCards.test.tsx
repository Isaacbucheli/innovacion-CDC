import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import InsumoCards from "./InsumoCards";
import type { InsumoEstado } from "@/types";

const base: InsumoEstado = {
  kind: "facturacion", obligatorio: true, cargado: false,
  source_file_name: null, cargado_en: null, filas: 0, status: null, warnings: [],
};

describe("InsumoCards", () => {
  it("marca los insumos obligatorios que faltan", () => {
    render(<InsumoCards insumos={[base]} canEdit onSubir={() => {}} onBorrar={() => {}} />);
    expect(screen.getByText(/obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/falta este archivo/i)).toBeInTheDocument();
  });

  it("muestra el archivo y el conteo de filas cuando está cargado", () => {
    render(<InsumoCards canEdit onSubir={() => {}} onBorrar={() => {}}
      insumos={[{ ...base, cargado: true, source_file_name: "bitcost.xlsx", filas: 26608 }]} />);
    expect(screen.getByText(/bitcost\.xlsx/)).toBeInTheDocument();
    expect(screen.getByText(/26,608|26\.608/)).toBeInTheDocument();
  });

  it("un insumo opcional no dice obligatorio", () => {
    render(<InsumoCards canEdit onSubir={() => {}} onBorrar={() => {}}
      insumos={[{ ...base, kind: "rbac", obligatorio: false }]} />);
    expect(screen.queryByText(/obligatorio/i)).toBeNull();
  });

  it("sin permiso de edición no ofrece subir", () => {
    render(<InsumoCards insumos={[base]} canEdit={false} onSubir={() => {}} onBorrar={() => {}} />);
    expect(screen.queryByRole("button", { name: /subir/i })).toBeNull();
  });
});
