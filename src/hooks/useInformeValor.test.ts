import { StrictMode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { useInformeValor } from "@/hooks/useInformeValor";
import * as api from "@/lib/api";
import type { ClientSummary, EstadoRbacInfo, InformeValorEstado } from "@/types";

vi.mock("@/lib/api");

const cliente: ClientSummary = { client_id: 1, client_name: "Cliente Uno" };
const estadoRbac: EstadoRbacInfo = {
  disponibilidad: "completo", estado_cuenta_medido: true, ultimo_login_medido: true,
  fecha_corrida: "2026-08-01T15:30:00Z",
  motivo: "Los permisos y los datos de identidad se obtuvieron completos desde Azure.",
  origen: "base",
};
// estado_rbac viaja DENTRO de /estado desde la entrega 2b (antes era un segundo GET a
// /insumos-bd, pedido en paralelo -- ver el hook): un solo mock de getInformeValorEstado
// alcanza para las dos cosas que puebla el hook.
const estado: InformeValorEstado = {
  insumos: [
    { kind: "facturacion", obligatorio: true, cargado: false, source_file_name: null, cargado_en: null, filas: 0, status: null, warnings: [] },
    { kind: "casos", obligatorio: true, cargado: false, source_file_name: null, cargado_en: null, filas: 0, status: null, warnings: [] },
    { kind: "rbac", obligatorio: false, cargado: false, source_file_name: null, cargado_en: null, filas: 0, status: null, warnings: [] },
  ],
  estado_rbac: estadoRbac,
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
test("bajo StrictMode sale de loading y puebla clients, estado y estadoRbac", async () => {
  const { result } = renderHook(() => useInformeValor(), { wrapper: StrictMode });

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.clients).toEqual([cliente]);
  await waitFor(() => expect(result.current.estado).toEqual(estado));
  expect(result.current.estadoRbac).toEqual(estadoRbac);
});

// La razon de toda la tarea: la pantalla de insumos no puede volver a pagar /insumos-bd (Advisor,
// Matriz, RBAC y Retiros completos) solo para leer esta condicional. getInformeValorEstado ya no
// se llama en paralelo con nada -- una sola llamada por carga, no dos.
test("carga el estado con una sola llamada a la API, no dos en paralelo", async () => {
  const { result } = renderHook(() => useInformeValor(), { wrapper: StrictMode });

  await waitFor(() => expect(result.current.estadoRbac).toEqual(estadoRbac));

  expect(api.getInformeValorEstado).toHaveBeenCalledTimes(1);
});
