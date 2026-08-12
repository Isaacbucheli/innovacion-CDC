import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import InformeVista from "./InformeVista";
import type { InformeValorModelo } from "@/types";

/** Un cliente cuyos cinco bloques salieron nulos: ningún insumo se solapa con el período. */
const vacio: InformeValorModelo = {
  meta: {
    cliente: "Cliente de prueba",
    periodo: "2026-01 a 2026-06",
    corte: "2026-07-31",
    cobertura: { total: 0, suscripciones: [] },
    rbacOrigen: null,
  },
  tickets: null, fact: null, rbac: null, advisor: null, matriz: null, catSerie: null,
};

function irA(seccion: string) {
  fireEvent.click(screen.getByRole("button", { name: seccion }));
}

describe("InformeVista", () => {
  it("muestra el encabezado con el corte congelado", () => {
    render(<InformeVista modelo={vacio} variacion={null} faseReservas="cargando"
      errorReservas={null} onReintentarReservas={() => {}} />);

    expect(screen.getByText("Cliente de prueba")).toBeInTheDocument();
    expect(screen.getByText(/congelada en el cálculo/i)).toBeInTheDocument();
    expect(screen.getByText("31/7/2026")).toBeInTheDocument();
  });

  // Un bloque ausente no desaparece de la pantalla ni se dibuja en cero: dice por qué está vacío.
  it("cada bloque ausente explica por que lo esta", () => {
    render(<InformeVista modelo={vacio} variacion={null} faseReservas="cargando"
      errorReservas={null} onReintentarReservas={() => {}} />);

    expect(screen.getByText(/no es un gasto de cero/i)).toBeInTheDocument();

    irA("Operación");
    expect(screen.getByText(/no es una mesa sin trabajo/i)).toBeInTheDocument();

    irA("Seguridad");
    expect(screen.getByText(/no es un cliente sin permisos asignados/i)).toBeInTheDocument();

    irA("Postura");
    expect(screen.getByText(/no equivale a una postura perfecta/i)).toBeInTheDocument();

    irA("Roadmap");
    expect(screen.getByText(/no es un roadmap terminado/i)).toBeInTheDocument();
  });

  // El panel de reservas no depende de la facturación: sin bloque de consumo igual hay que
  // mostrarlo, o un cliente sin BITCOST cargado perdería la lectura de sus reservas.
  it("sin bloque de consumo igual muestra la variacion del consumo", () => {
    render(<InformeVista modelo={vacio} variacion={null} faseReservas="cargando"
      errorReservas={null} onReintentarReservas={() => {}} />);

    expect(screen.getByText("Variación del consumo")).toBeInTheDocument();
    expect(screen.getByText(/leyendo las reservas del cliente contra azure/i)).toBeInTheDocument();
  });

  it("dice que no hay insumo de permisos en vez de dejar el origen en blanco", () => {
    render(<InformeVista modelo={vacio} variacion={null} faseReservas="lista"
      errorReservas={null} onReintentarReservas={() => {}} />);

    expect(screen.getByText("Sin insumo de permisos")).toBeInTheDocument();
  });

  it("explica la cobertura vacia en vez de mostrar una tabla muda", () => {
    render(<InformeVista modelo={vacio} variacion={null} faseReservas="lista"
      errorReservas={null} onReintentarReservas={() => {}} />);

    expect(screen.getByText(/ninguna de las tres fuentes reporta suscripciones/i)).toBeInTheDocument();
  });
});
