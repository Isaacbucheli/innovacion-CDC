import { StrictMode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { useInformeValor } from "@/hooks/useInformeValor";
import * as api from "@/lib/api";
import type { ClientSummary, InformeValorEstado } from "@/types";

vi.mock("@/lib/api");

const cliente: ClientSummary = { client_id: 1, client_name: "Cliente Uno" };
const estado: InformeValorEstado = {
  insumos: [
    { kind: "facturacion", obligatorio: true, cargado: false, source_file_name: null, cargado_en: null, filas: 0, status: null, warnings: [] },
    { kind: "casos", obligatorio: true, cargado: false, source_file_name: null, cargado_en: null, filas: 0, status: null, warnings: [] },
    { kind: "rbac", obligatorio: false, cargado: false, source_file_name: null, cargado_en: null, filas: 0, status: null, warnings: [] },
  ],
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.listClients).mockReset().mockResolvedValue([cliente]);
  vi.mocked(api.getInformeValorEstado).mockReset().mockResolvedValue(estado);
});

// StrictMode (activo en main.tsx) monta, desmonta y remonta cada componente en desarrollo.
// Ese ciclo ejercita el bug real: si el ref de "montado" no se repone a true en el setup del
// efecto (solo se apaga en la limpieza), el remontaje deja la bandera en false para siempre y
// ningún setState asíncrono se vuelve a aplicar.
test("bajo StrictMode sale de loading y puebla clients y estado", async () => {
  const { result } = renderHook(() => useInformeValor(), { wrapper: StrictMode });

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.clients).toEqual([cliente]);
  await waitFor(() => expect(result.current.estado).toEqual(estado));
});
