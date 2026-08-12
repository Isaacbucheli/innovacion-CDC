import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useInformePreview } from "@/hooks/useInformePreview";
import * as api from "@/lib/api";
import type { InformeValorModelo, InformeValorPreviewRequest, InformeVariacionConsumo } from "@/types";

vi.mock("@/lib/api");

const cuerpo: InformeValorPreviewRequest = {
  period_start: "2026-01-01", period_end: "2026-06-01",
  corte: "2026-07-31T12:00:00Z", meses_parciales_forzados: null,
};

const modelo: InformeValorModelo = {
  meta: {
    cliente: "Cliente de prueba", periodo: "2026-01 a 2026-06", corte: "2026-07-31",
    cobertura: { total: 0, suscripciones: [] }, rbacOrigen: null,
  },
  tickets: null, fact: null, rbac: null, advisor: null, matriz: null, catSerie: null,
};

const variacion: InformeVariacionConsumo = {
  reservas: {
    medido: true, motivo: "Se leyeron 1 reserva(s) activa(s).", errores: [], alertDays: 30,
    ahorroConfirmado: 100, confirmados: [], estimados: [], discrepancias: [],
    aporteAlPeriodo: 100, recursosQueExplicanElPeriodo: [], reservasConConsumidoresNoLeidos: 0,
  },
  atribucion: null, variacionTotal: null,
};

/** Promesa que se resuelve cuando el test quiere: así se puede mirar el estado intermedio. */
function diferida<T>() {
  let resolver!: (v: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => { resolver = res; rechazar = rej; });
  return { promesa, resolver, rechazar };
}

beforeEach(() => {
  vi.mocked(api.previewInformeValor).mockReset().mockResolvedValue(modelo);
  vi.mocked(api.previewVariacionConsumo).mockReset().mockResolvedValue(variacion);
});

describe("useInformePreview", () => {
  // StrictMode (activo en main.tsx) monta, desmonta y remonta: si el ref de "montado" no se repone
  // en el setup del efecto, ningún setState asíncrono se vuelve a aplicar nunca.
  it("bajo StrictMode completa las dos fases", async () => {
    const { result } = renderHook(() => useInformePreview(7), { wrapper: StrictMode });

    await act(async () => { await result.current.generar(cuerpo); });

    expect(result.current.modelo).toEqual(modelo);
    await waitFor(() => expect(result.current.faseReservas).toBe("lista"));
    expect(result.current.variacion).toEqual(variacion);
  });

  it("la fase 2 arranca sola y con el mismo cuerpo que la fase 1", async () => {
    const { result } = renderHook(() => useInformePreview(7));

    await act(async () => { await result.current.generar(cuerpo); });
    await waitFor(() => expect(result.current.faseReservas).toBe("lista"));

    expect(api.previewVariacionConsumo).toHaveBeenCalledWith(7, cuerpo);
    expect(vi.mocked(api.previewInformeValor).mock.calls[0][1])
      .toEqual(vi.mocked(api.previewVariacionConsumo).mock.calls[0][1]);
  });

  // Mientras la fase 2 está en vuelo el modelo ya se puede dibujar, pero el bloque de variación no
  // tiene datos definitivos: el hook no rellena `variacion` con lo que trajo la fase 1.
  it("mientras la fase 2 no vuelve deja la variacion en null y la fase en cargando", async () => {
    const d = diferida<InformeVariacionConsumo>();
    vi.mocked(api.previewVariacionConsumo).mockReturnValue(d.promesa);
    const { result } = renderHook(() => useInformePreview(7));

    await act(async () => { await result.current.generar(cuerpo); });

    expect(result.current.modelo).toEqual(modelo);
    expect(result.current.cargando).toBe(false);
    expect(result.current.faseReservas).toBe("cargando");
    expect(result.current.variacion).toBeNull();

    await act(async () => { d.resolver(variacion); });
    await waitFor(() => expect(result.current.faseReservas).toBe("lista"));
  });

  it("un fallo de la fase 2 no tumba el modelo ya cargado", async () => {
    vi.mocked(api.previewVariacionConsumo).mockRejectedValue(new Error("504 Gateway Timeout"));
    const { result } = renderHook(() => useInformePreview(7));

    await act(async () => { await result.current.generar(cuerpo); });
    await waitFor(() => expect(result.current.faseReservas).toBe("error"));

    expect(result.current.modelo).toEqual(modelo);
    expect(result.current.errorReservas).toContain("504");
  });

  it("el reintento de las reservas usa el mismo cuerpo, no uno nuevo", async () => {
    vi.mocked(api.previewVariacionConsumo).mockRejectedValueOnce(new Error("504"));
    const { result } = renderHook(() => useInformePreview(7));

    await act(async () => { await result.current.generar(cuerpo); });
    await waitFor(() => expect(result.current.faseReservas).toBe("error"));

    await act(async () => { result.current.reintentarReservas(); });
    await waitFor(() => expect(result.current.faseReservas).toBe("lista"));

    expect(api.previewVariacionConsumo).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.previewVariacionConsumo).mock.calls[1]).toEqual([7, cuerpo]);
  });

  it("si falla la fase 1 no se pide la fase 2", async () => {
    vi.mocked(api.previewInformeValor).mockRejectedValue(new Error("400 rango invalido"));
    const { result } = renderHook(() => useInformePreview(7));

    await act(async () => { await result.current.generar(cuerpo); });

    expect(result.current.error).toContain("400");
    expect(result.current.modelo).toBeNull();
    expect(api.previewVariacionConsumo).not.toHaveBeenCalled();
  });

  // Dejar el informe del cliente anterior en pantalla con el cliente nuevo ya seleccionado es la
  // peor forma de equivocarse en este módulo.
  it("cambiar de cliente descarta el informe anterior", async () => {
    const { result, rerender } = renderHook(({ id }) => useInformePreview(id), {
      initialProps: { id: 7 },
    });

    await act(async () => { await result.current.generar(cuerpo); });
    await waitFor(() => expect(result.current.faseReservas).toBe("lista"));

    await act(async () => { rerender({ id: 8 }); });

    expect(result.current.modelo).toBeNull();
    expect(result.current.variacion).toBeNull();
    expect(result.current.faseReservas).toBe("inactiva");
  });

  // Una respuesta vieja que llega tarde no puede pisar la corrida vigente.
  it("descarta la respuesta de una corrida ya reemplazada", async () => {
    const vieja = diferida<InformeVariacionConsumo>();
    vi.mocked(api.previewVariacionConsumo).mockReturnValueOnce(vieja.promesa);
    const { result } = renderHook(() => useInformePreview(7));

    await act(async () => { await result.current.generar(cuerpo); });
    expect(result.current.faseReservas).toBe("cargando");

    // Segunda corrida completa mientras la primera sigue en vuelo.
    await act(async () => { await result.current.generar(cuerpo); });
    await waitFor(() => expect(result.current.faseReservas).toBe("lista"));

    const otra: InformeVariacionConsumo = {
      ...variacion,
      reservas: { ...variacion.reservas, aporteAlPeriodo: 99999 },
    };
    await act(async () => { vieja.resolver(otra); });

    expect(result.current.variacion?.reservas.aporteAlPeriodo).toBe(100);
  });
});
