import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VariacionConsumo from "./VariacionConsumo";
import type { InformeReservas, InformeVariacionConsumo } from "@/types";

const MOTIVO_FASE1 = "Las reservas de Azure se leen en una llamada aparte y todavía no se pidió: "
  + "este eje no se midió acá. No significa que el cliente no tenga reservas.";

const reservasMedidas: InformeReservas = {
  medido: true,
  motivo: "Se leyeron 2 reserva(s) activa(s).",
  errores: [],
  alertDays: 30,
  ahorroConfirmado: 4200,
  confirmados: [{
    resourceName: "recurso-uno", resourceGroup: "rg-uno", subscriptionId: "sub-1",
    reservationId: "res-1", reservationName: "Reserva uno", term: "P1Y",
    inicioReserva: "2026-02-01", usedHours: 720, utilizationLast: "98%", utilization7d: "97%",
    expiring: false, tarifaAntesPorHora: 0.2, tarifaDespuesPorHora: 0.12,
    ahorro: 4200, motivoSinCalcular: null, explicaElPeriodo: true, aporteAlPeriodo: 350,
  }],
  estimados: [],
  discrepancias: [],
  aporteAlPeriodo: 350,
  recursosQueExplicanElPeriodo: ["sub-1|rg-uno|recurso-uno"],
  reservasConConsumidoresNoLeidos: 0,
};

const reservasNoMedidas: InformeReservas = {
  ...reservasMedidas,
  medido: false,
  motivo: "El cliente no tiene credenciales de Azure activas: este eje no se midió.",
  errores: [{ error: "SinCredenciales" }],
  ahorroConfirmado: 0,
  confirmados: [],
  aporteAlPeriodo: 0,
  recursosQueExplicanElPeriodo: [],
};

const conAtribucion: InformeVariacionConsumo = {
  reservas: reservasMedidas,
  atribucion: {
    porRecomendacion: { total: 900, cantidad: 3, recursos: [] },
    sinAtribuir: {
      dejoDeFacturar: { total: 500, cantidad: 2, recursos: [] },
      vivoCuestaMenos: { total: 200, cantidad: 4, recursos: [] },
      vivoCuestaMas: { total: -150, cantidad: 1, recursos: [] },
      nuevo: { total: -300, cantidad: 2, recursos: [] },
      total: 250,
    },
    crecimiento: 450,
    variacionTotal: 1150,
    excluidosPorReserva: [],
  },
  variacionTotal: 1500,
};

/** Ninguna cifra de dinero dibujada en cero: el cero ambiguo es el defecto que esta vista evita. */
function noHayMontosEnCero() {
  expect(screen.queryByText(/\$0\.00/)).toBeNull();
}

describe("VariacionConsumo · fase 2 pendiente", () => {
  it("dice que las reservas se estan leyendo y no publica ninguna cifra", () => {
    render(<VariacionConsumo variacion={null} fase="cargando" error={null}
      motivoFase1={MOTIVO_FASE1} onReintentar={() => {}} />);

    expect(screen.getByText(/leyendo las reservas del cliente contra azure/i)).toBeInTheDocument();
    expect(screen.getByText(/entre 10 y 30 segundos/i)).toBeInTheDocument();
    noHayMontosEnCero();
  });

  // Lo que distingue "falta una llamada" de "el cliente no tiene reservas" es el motivo que manda
  // la API en la fase 1. Si se pierde, los dos casos se ven idénticos.
  it("muestra el motivo de la fase 1 tal cual lo redacto la API", () => {
    render(<VariacionConsumo variacion={null} fase="cargando" error={null}
      motivoFase1={MOTIVO_FASE1} onReintentar={() => {}} />);

    expect(screen.getByText(MOTIVO_FASE1)).toBeInTheDocument();
  });

  it("nunca se lee como un cliente sin reservas", () => {
    render(<VariacionConsumo variacion={null} fase="cargando" error={null}
      motivoFase1={MOTIVO_FASE1} onReintentar={() => {}} />);

    expect(screen.queryByText(/sin reservas/i)).toBeNull();
    expect(screen.queryByText(/no tiene reservas/i)).toBeNull();
  });
});

describe("VariacionConsumo · la fase 2 fallo", () => {
  it("explica el fallo, ofrece reintentar y no publica cifras a medias", () => {
    const onReintentar = vi.fn();
    render(<VariacionConsumo variacion={null} fase="error" error="504 Gateway Timeout"
      motivoFase1={MOTIVO_FASE1} onReintentar={onReintentar} />);

    expect(screen.getByText(/504 Gateway Timeout/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
    noHayMontosEnCero();
  });
});

describe("VariacionConsumo · la fase 2 llego", () => {
  // "Llegó" no es "medido": un 200 con medido:false es un eje sin leer, no un ahorro de cero.
  it("con el eje no medido publica el motivo y las cifras quedan sin medir", () => {
    render(<VariacionConsumo variacion={{ ...conAtribucion, reservas: reservasNoMedidas }}
      fase="lista" error={null} motivoFase1={MOTIVO_FASE1} onReintentar={() => {}} />);

    expect(screen.getByText(/el eje de reservas no se midió/i)).toBeInTheDocument();
    expect(screen.getByText(/no tiene credenciales de azure activas/i)).toBeInTheDocument();
    expect(screen.getAllByText("Sin medir").length).toBeGreaterThanOrEqual(4);
    noHayMontosEnCero();
  });

  it("con el eje medido publica el aporte al periodo y los baldes", () => {
    render(<VariacionConsumo variacion={conAtribucion} fase="lista" error={null}
      motivoFase1={MOTIVO_FASE1} onReintentar={() => {}} />);

    // El aporte al período aparece como titular y como la fila del recurso que lo explica.
    expect(screen.getAllByText("$350.00").length).toBeGreaterThan(0);
    expect(screen.getByText("$1,500.00")).toBeInTheDocument();
    expect(screen.getByText(/menos por mes/i)).toBeInTheDocument();
    expect(screen.getByText("Dejó de facturar")).toBeInTheDocument();
  });

  it("avisa cuando las cifras confirmadas estan incompletas, no completas en cero", () => {
    render(<VariacionConsumo fase="lista" error={null} motivoFase1={MOTIVO_FASE1} onReintentar={() => {}}
      variacion={{
        ...conAtribucion,
        reservas: { ...reservasMedidas, reservasConConsumidoresNoLeidos: 2 },
      }} />);

    expect(screen.getByText(/incompletos/i)).toBeInTheDocument();
  });

  it("sin ventana fija explica por que no hay descomposicion en vez de mostrarla en cero", () => {
    render(<VariacionConsumo fase="lista" error={null} motivoFase1={MOTIVO_FASE1} onReintentar={() => {}}
      variacion={{ reservas: reservasMedidas, atribucion: null, variacionTotal: null }} />);

    expect(screen.getByText(/al menos seis meses no parciales/i)).toBeInTheDocument();
    expect(screen.getByText(/no es que la variación haya sido cero/i)).toBeInTheDocument();
    expect(screen.queryByText("Variación total")).toBeNull();
  });
});
