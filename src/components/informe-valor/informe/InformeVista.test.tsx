import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import InformeVista from "./InformeVista";
import type { InformeEjecutado, InformeOpex, InformeValorModelo } from "@/types";

/** Un cliente cuyos cinco bloques salieron nulos: ningún insumo se solapa con el período. */
const vacio: InformeValorModelo = {
  meta: {
    cliente: "Cliente de prueba",
    periodo: "2026-01 a 2026-06",
    corte: "2026-07-31",
    cobertura: { total: 0, suscripciones: [] },
    rbacOrigen: null,
    conciliacion: null,
  },
  tickets: null, fact: null, rbac: null, advisor: null, matriz: null, catSerie: null,
  ejecutado: null, opex: null, cronologia: null,
};

const ejecutadoBase: InformeEjecutado = {
  medido: true, motivo: null,
  filas: [], serie: [], porOportunidad: [], catAcum: {},
  total: 0, tasaVigente: 0, pctGasto: 12.5,
  facturado: 0, estimado: 0, sinMonto: 0,
  proyeccion: [], proyeccionFin: null,
  reservas: {
    medido: true, motivo: null, filas: [],
    totalDemanda: 0, totalReserva: 0, totalAhorro: 0, ahorroAnualizado: 0,
    sinLineaEnEvolucion: [], consumidoresNoLeidos: 0,
  },
  ejes: {
    barridoMedido: true, barridoMotivo: null, reservasMedidas: true, reservasMotivo: null,
    indeterminadas: 0,
  },
};

const opexBase: InformeOpex = {
  actual: 76, fecha: "2026-06-30", estado: "ok",
  serie: [["2026-01", 60], ["2026-06", 76]],
  medido: true, motivo: null,
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

    // M2 de la revisión final de la entrega 7: la vista abre en "Ejecutado" (SECCIONES[0]), no en
    // "Consumo", así que el motivo de ese bloque es lo que se ve sin navegar.
    expect(screen.getByText(/no es que no se haya ejecutado nada/i)).toBeInTheDocument();

    irA("Consumo");
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

    irA("Consumo"); // la vista abre en "Ejecutado" (M2): este panel vive en la pestaña de Consumo.
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

describe("la cabecera de cuatro tarjetas (reunión del 2026-08-13)", () => {
  it("sin ningún insumo declara que falta cada tarjeta, no un cero", () => {
    render(<InformeVista modelo={vacio} variacion={null} faseReservas="cargando"
      errorReservas={null} onReintentarReservas={() => {}} />);

    expect(screen.getByText(/Falta el registro de acciones ejecutadas/i)).toBeInTheDocument();
    expect(screen.getByText(/No hay snapshot de Azure Advisor/i)).toBeInTheDocument();
    expect(screen.getByText(/Falta el export de la mesa de servicio/i)).toBeInTheDocument();
    expect(screen.getByText(/Falta la matriz de mejoras/i)).toBeInTheDocument();
  });

  // Tres estados, no dos: sin insumo ("—") es distinto de insumo sin medir ("Sin medición" con el
  // motivo real) y de insumo medido sin gasto contra el que comparar.
  it("la tarjeta de optimización distingue sus tres estados", () => {
    const sinMedir: InformeValorModelo = {
      ...vacio, ejecutado: { ...ejecutadoBase, medido: false, motivo: "El barrido no se pudo leer." },
    };
    const { rerender } = render(<InformeVista modelo={sinMedir} variacion={null} faseReservas="cargando"
      errorReservas={null} onReintentarReservas={() => {}} />);
    // El mismo motivo aparece dos veces desde M2 (la vista abre en "Ejecutado", SECCIONES[0]): una
    // vez en la tarjeta del resumen de la reunión (siempre visible) y otra en el cuerpo de la
    // sección, que ahora también está montada por defecto.
    expect(screen.getAllByText("El barrido no se pudo leer.").length).toBeGreaterThan(0);

    const sinGasto: InformeValorModelo = { ...vacio, ejecutado: { ...ejecutadoBase, pctGasto: null } };
    rerender(<InformeVista modelo={sinGasto} variacion={null} faseReservas="cargando"
      errorReservas={null} onReintentarReservas={() => {}} />);
    expect(screen.getByText(/el gasto no se midió/i)).toBeInTheDocument();

    const conGasto: InformeValorModelo = { ...vacio, ejecutado: ejecutadoBase };
    rerender(<InformeVista modelo={conGasto} variacion={null} faseReservas="cargando"
      errorReservas={null} onReintentarReservas={() => {}} />);
    expect(screen.getByText("12.5%")).toBeInTheDocument();
  });

  it("la tarjeta de opex distingue sus dos estados", () => {
    const sinMedir: InformeValorModelo = {
      ...vacio, opex: { ...opexBase, medido: false, motivo: "El snapshot no trae el pilar de costos." },
    };
    const { rerender } = render(<InformeVista modelo={sinMedir} variacion={null} faseReservas="cargando"
      errorReservas={null} onReintentarReservas={() => {}} />);
    expect(screen.getByText("El snapshot no trae el pilar de costos.")).toBeInTheDocument();

    const medido: InformeValorModelo = { ...vacio, opex: opexBase };
    rerender(<InformeVista modelo={medido} variacion={null} faseReservas="cargando"
      errorReservas={null} onReintentarReservas={() => {}} />);
    expect(screen.getByText("76.0%")).toBeInTheDocument();
  });
});
