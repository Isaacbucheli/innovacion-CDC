import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEntregas } from "@/hooks/useEntregas";
import * as api from "@/lib/api";
import type { InformeValorEntrega, InformeValorGenerarRequest } from "@/types";

vi.mock("@/lib/api");

function entrega(over: Partial<InformeValorEntrega> = {}): InformeValorEntrega {
  return {
    entrega_id: 1, period_start: "2026-01-01", period_end: "2026-06-01", corte: "2026-07-15",
    variante: "cliente", bloques_publicados: [], rbac_origen: "base",
    file_name: "informe.html", blob_size_bytes: 1000, generated_by: "quien@ejemplo",
    generated_at: "2026-07-16T18:30:00Z",
    ...over,
  };
}

const cuerpo: InformeValorGenerarRequest = {
  period_start: "2026-01-01", period_end: "2026-06-01", corte: "2026-07-15T12:00:00Z",
  meses_parciales_forzados: null, variante: "cliente", bloques: [],
};

beforeEach(() => {
  // Los mocks del módulo son compartidos entre tests: sin limpiar, los conteos de llamadas de un
  // test arrastran los del anterior.
  vi.clearAllMocks();
  vi.mocked(api.getEntregasInformeValor).mockResolvedValue([]);
  vi.mocked(api.generarInformeValor).mockResolvedValue(entrega());
  vi.mocked(api.descargarEntregaInformeValor).mockResolvedValue(undefined);
});

describe("useEntregas", () => {
  it("carga el historial del cliente al entrar", async () => {
    vi.mocked(api.getEntregasInformeValor).mockResolvedValue([entrega()]);
    const { result } = renderHook(() => useEntregas(4));

    await waitFor(() => expect(result.current.entregas).toHaveLength(1));
    expect(api.getEntregasInformeValor).toHaveBeenCalledWith(4);
    expect(result.current.error).toBeNull();
  });

  // Una lista vacía por falla de lectura no puede parecerse a un cliente sin entregas.
  it("una falla de lectura deja el error y no una lista vacia muda", async () => {
    vi.mocked(api.getEntregasInformeValor).mockRejectedValue(new Error("HTTP 500"));
    const { result } = renderHook(() => useEntregas(4));

    await waitFor(() => expect(result.current.error).toBe("HTTP 500"));
    expect(result.current.entregas).toEqual([]);
  });

  it("sin cliente no pide nada", () => {
    renderHook(() => useEntregas(null));
    expect(api.getEntregasInformeValor).not.toHaveBeenCalled();
  });

  it("genera, descarga por el camino del archivo y refresca la tabla", async () => {
    const { result } = renderHook(() => useEntregas(4));
    await waitFor(() => expect(api.getEntregasInformeValor).toHaveBeenCalledTimes(1));

    vi.mocked(api.getEntregasInformeValor).mockResolvedValue([entrega()]);
    await act(async () => { await result.current.generar(cuerpo); });

    expect(api.generarInformeValor).toHaveBeenCalledWith(4, cuerpo);
    expect(api.descargarEntregaInformeValor).toHaveBeenCalledWith(4, entrega());
    await waitFor(() => expect(result.current.entregas).toHaveLength(1));
  });

  // La fila ya está archivada aunque la descarga falle: el historial no puede mostrar menos entregas
  // de las que existen, y desde ahí se vuelve a bajar el archivo que no llegó.
  it("si la descarga falla igual refresca el archivo y propaga el error", async () => {
    vi.mocked(api.descargarEntregaInformeValor).mockRejectedValue(new Error("HTTP 404"));
    const { result } = renderHook(() => useEntregas(4));
    await waitFor(() => expect(api.getEntregasInformeValor).toHaveBeenCalledTimes(1));

    await expect(act(async () => { await result.current.generar(cuerpo); }))
      .rejects.toThrow("HTTP 404");

    await waitFor(() => expect(api.getEntregasInformeValor).toHaveBeenCalledTimes(2));
    expect(result.current.generando).toBeNull();
  });

  it("cambiar de cliente descarta el historial del anterior", async () => {
    vi.mocked(api.getEntregasInformeValor).mockResolvedValue([entrega()]);
    const { result, rerender } = renderHook(({ id }: { id: number | null }) => useEntregas(id),
      { initialProps: { id: 4 as number | null } });
    await waitFor(() => expect(result.current.entregas).toHaveLength(1));

    rerender({ id: null });
    expect(result.current.entregas).toEqual([]);
  });
});
