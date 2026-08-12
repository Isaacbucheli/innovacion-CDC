import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TablaEntregas from "./TablaEntregas";
import type { InformeValorEntrega } from "@/types";

function entrega(over: Partial<InformeValorEntrega> = {}): InformeValorEntrega {
  return {
    entrega_id: 1, period_start: "2026-01-01", period_end: "2026-06-01", corte: "2026-07-15",
    variante: "cliente", bloques_publicados: ["gastoTotal", "centroCosto"], rbac_origen: "base",
    file_name: "informe-de-valor.html", blob_size_bytes: 512000,
    generated_by: "consultor@ejemplo", generated_at: "2026-07-16T18:30:00Z",
    ...over,
  };
}

describe("TablaEntregas", () => {
  it("muestra fecha en hora de Quito, autor, variante, periodo y corte", () => {
    render(<TablaEntregas entregas={[entrega()]} cargando={false} error={null} onDescargar={() => {}} />);

    // 18:30 UTC son 13:30 en Quito: la fecha se lee por lib/dates, no en la zona del navegador.
    expect(screen.getByText(/16\/7\/2026/)).toBeInTheDocument();
    expect(screen.getByText("consultor@ejemplo")).toBeInTheDocument();
    expect(screen.getByText("cliente")).toBeInTheDocument();
    expect(screen.getByText("ene 2026 a jun 2026")).toBeInTheDocument();
    expect(screen.getByText("15/7/2026")).toBeInTheDocument();
  });

  it("resume los bloques publicados", () => {
    render(<TablaEntregas entregas={[entrega()]} cargando={false} error={null} onDescargar={() => {}} />);
    expect(screen.getByText("2 de 6")).toBeInTheDocument();
  });

  // Una entrega sin bloques es legítima y frecuente (es el default). En blanco se leería como "no se
  // sabe"; un 0, como si el informe hubiera publicado ceros.
  it("la entrega sin montos lo dice con palabras, no con un cero", () => {
    render(<TablaEntregas entregas={[entrega({ bloques_publicados: [] })]} cargando={false}
      error={null} onDescargar={() => {}} />);

    expect(screen.getByText("Ninguno: sin montos")).toBeInTheDocument();
  });

  it("no esconde un bloque que esta version no conoce", () => {
    render(<TablaEntregas entregas={[entrega({ bloques_publicados: ["gastoTotal", "bloqueNuevo"] })]}
      cargando={false} error={null} onDescargar={() => {}} />);

    expect(screen.getByText(/incluye 1 bloque\(s\) desconocido/i)).toBeInTheDocument();
  });

  it("una entrega sin autor lo declara en vez de dejar la celda muda", () => {
    render(<TablaEntregas entregas={[entrega({ generated_by: null })]} cargando={false}
      error={null} onDescargar={() => {}} />);

    expect(screen.getByText("Sin autor registrado")).toBeInTheDocument();
  });

  it("descarga la fila que se pidio", () => {
    const onDescargar = vi.fn();
    const e = entrega();
    render(<TablaEntregas entregas={[e]} cargando={false} error={null} onDescargar={onDescargar} />);

    fireEvent.click(screen.getByRole("button", { name: /descargar/i }));
    expect(onDescargar).toHaveBeenCalledWith(e);
  });

  // "Sin entregas" y "no se pudo leer el historial" llevan a decisiones opuestas: reemitir o revisar
  // la conexión. Confundirlos es el mismo cero ambiguo de siempre.
  it("distingue el historial vacio del historial que no se pudo leer", () => {
    const { unmount } = render(
      <TablaEntregas entregas={[]} cargando={false} error={null} onDescargar={() => {}} />);
    expect(screen.getByText(/todavía no tiene ninguna entrega generada/i)).toBeInTheDocument();
    unmount();

    render(<TablaEntregas entregas={[]} cargando={false} error="HTTP 500" onDescargar={() => {}} />);
    expect(screen.getByText(/no se pudo leer el historial/i)).toBeInTheDocument();
    expect(screen.queryByText(/todavía no tiene ninguna entrega/i)).toBeNull();
  });

  it("mientras carga no dice que no hay entregas", () => {
    render(<TablaEntregas entregas={[]} cargando error={null} onDescargar={() => {}} />);

    expect(screen.getByText(/cargando el historial/i)).toBeInTheDocument();
    expect(screen.queryByText(/todavía no tiene ninguna entrega/i)).toBeNull();
  });

  // Reemitir el mismo período es legítimo (no hay unicidad en la tabla): dos emisiones se distinguen
  // por fecha y por bloques, y las dos se pueden volver a bajar.
  it("pagina de diez en diez y conserva las reemisiones del mismo periodo", () => {
    const filas = Array.from({ length: 12 }, (_, i) => entrega({
      entrega_id: i + 1,
      generated_at: `2026-07-${String(i + 1).padStart(2, "0")}T18:30:00Z`,
    }));
    render(<TablaEntregas entregas={filas} cargando={false} error={null} onDescargar={() => {}} />);

    expect(screen.getAllByRole("button", { name: /descargar/i })).toHaveLength(10);
    expect(screen.getByText("Mostrando 1–10 de 12")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(screen.getAllByRole("button", { name: /descargar/i })).toHaveLength(2);
  });
});
