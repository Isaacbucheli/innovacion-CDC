import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { beforeEach, expect, test, vi } from "vitest";
import { setSession } from "@/lib/auth";
import type { PendienteCliente, PendienteItem, PendientesPayload } from "@/types";

// ⚠️ Datos inventados: nunca clientes, consultores ni notas reales.
const clientes: PendienteCliente[] = [
  { num: 1, cliente: "Cliente Uno", servicio: "SERVICIO A", categoria: "ALTO", pais: "PAIS A", coordinador: "Persona B", consultor: "Persona C" },
  { num: 2, cliente: "Cliente Dos", servicio: null, categoria: null, pais: null, coordinador: null, consultor: null },
];

const hoy = new Date();
const haceDias = (n: number) =>
  new Date(hoy.getTime() - n * 86_400_000).toISOString().slice(0, 10);

const P = (over: Partial<PendienteItem>): PendienteItem => ({
  id: "p1", cliente_num: 1, titulo: null, descripcion: "Descripción de ejemplo",
  tipo: "PENDIENTE", prioridad: "MEDIA", estado: "ABIERTO", responsable: "Persona C",
  fecha_creacion: haceDias(30), actualizado: "2026-07-27T15:51:28.0000000Z", historial: [], ...over,
});

let payload: PendientesPayload;

const baseline: PendientesPayload = {
  area: "CDC",
  clientes,
  pendientes: [
    P({
      id: "p1", tipo: "BLOQUEANTE", prioridad: "ALTA", descripcion: "Bloqueante con bitacora",
      historial: [
        // Fechas fuera de orden a propósito: el timeline se rige por `orden`.
        { hist_id: 100, orden: 0, fecha: "2026-07-06", nota: "nota vieja", autor: "Persona B" },
        { hist_id: 101, orden: 1, fecha: "2026-07-03", nota: "nota del medio", autor: null },
        { hist_id: 102, orden: 2, fecha: haceDias(1), nota: "nota reciente", autor: "Persona B" },
      ],
    }),
    P({ id: "p2", cliente_num: 2, estado: "EN_PROGRESO", descripcion: "En curso sin novedad", historial: [] }),
    P({ id: "p3", estado: "CERRADO", descripcion: "Ya cerrado", historial: [] }),
    P({ id: "p4", cliente_num: 9, descripcion: "Pendiente de cliente inexistente", historial: [] }),
  ],
};

const addNota = vi.fn(() => Promise.resolve({ hist_id: 999 }));
const borrarPendiente = vi.fn(() => Promise.resolve({}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  // structuredClone por llamada: la API real devuelve objetos nuevos y así se ven los efectos de recarga.
  getPendientes: () => Promise.resolve(structuredClone(payload)),
  addPendienteNota: (...args: unknown[]) => addNota(...(args as [])),
  deletePendiente: (...args: unknown[]) => borrarPendiente(...(args as [])),
}));

beforeEach(() => {
  localStorage.clear();
  addNota.mockClear();
  borrarPendiente.mockClear();
  payload = structuredClone(baseline);
});

async function renderPage(role: "admin" | "lector" = "admin") {
  setSession("tok", role, "Persona A");
  const { default: PendientesPage } = await import("@/components/pendientes/PendientesPage");
  return render(
    <ThemeProvider attribute="class">
      <PendientesPage area="CDC" section="pendientes-cdc" title="Pendientes CDC" />
    </ThemeProvider>,
  );
}

test("muestra los KPIs del area y oculta los cerrados por defecto", async () => {
  await renderPage();
  expect(await screen.findByText("Bloqueante con bitacora")).toBeInTheDocument();

  // 3 abiertos (p1, p3 cerrado no cuenta, p4) → abiertos = p1 + p4 = 2; en progreso = p2.
  const abiertos = screen.getByRole("button", { name: /abiertos/i });
  expect(within(abiertos).getByText("2")).toBeInTheDocument();
  const enProgreso = screen.getByRole("button", { name: /en progreso/i });
  expect(within(enProgreso).getByText("1")).toBeInTheDocument();

  // "Ocultar cerrados" viene activo: el cerrado no está en la tabla.
  expect(screen.queryByText("Ya cerrado")).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/ocultar cerrados/i));
  // waitFor + getByText (no findByText): la tabla vuelve a montar sus filas al cambiar el filtro y
  // el nodo que resolvía findByText quedaba desprendido del documento.
  await waitFor(() => expect(screen.getByText("Ya cerrado")).toBeInTheDocument());
});

test("cuenta como sin novedad solo lo que pasa del umbral y no esta cerrado", async () => {
  await renderPage();
  await screen.findByText("Bloqueante con bitacora");

  // p2 y p4 llevan 30 días sin nota (creación); p1 tiene una nota de ayer; p3 está cerrado.
  const sinNovedad = screen.getByRole("button", { name: /sin novedad/i });
  expect(within(sinNovedad).getByText("2")).toBeInTheDocument();

  fireEvent.click(sinNovedad);
  await waitFor(() => expect(screen.queryByText("Bloqueante con bitacora")).not.toBeInTheDocument());
  expect(screen.getByText("En curso sin novedad")).toBeInTheDocument();
});

test("un cliente_num sin cliente se muestra, no se esconde", async () => {
  await renderPage();
  expect(await screen.findByText("Pendiente de cliente inexistente")).toBeInTheDocument();
  expect(screen.getByText("Cliente desconocido (9)")).toBeInTheDocument();
});

test("la busqueda tambien encuentra por el texto de las notas", async () => {
  await renderPage();
  await screen.findByText("Bloqueante con bitacora");

  fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: "nota del medio" } });
  expect(screen.getByText("Bloqueante con bitacora")).toBeInTheDocument();
  expect(screen.queryByText("En curso sin novedad")).not.toBeInTheDocument();
});

test("el detalle ordena la bitacora por orden, no por fecha", async () => {
  await renderPage();
  fireEvent.click(await screen.findByText("Bloqueante con bitacora"));

  const dialog = await screen.findByRole("dialog");
  const notas = within(dialog).getAllByRole("listitem");
  expect(notas).toHaveLength(3);
  expect(notas[0]).toHaveTextContent("nota vieja");
  expect(notas[1]).toHaveTextContent("nota del medio");
  expect(notas[2]).toHaveTextContent("nota reciente");
});

test("agregar una nota manda solo el texto (el autor lo pone el backend)", async () => {
  await renderPage();
  fireEvent.click(await screen.findByText("Bloqueante con bitacora"));

  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText(/nueva nota/i), { target: { value: "avance" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /agregar nota/i }));

  await waitFor(() => expect(addNota).toHaveBeenCalledWith("CDC", "p1", "avance"));
});

test("un lector no ve acciones de escritura", async () => {
  await renderPage("lector");
  await screen.findByText("Bloqueante con bitacora");

  expect(screen.queryByRole("button", { name: /nuevo pendiente/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();

  // El detalle se abre igual, pero sin caja para escribir notas.
  fireEvent.click(screen.getByText("Bloqueante con bitacora"));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).queryByLabelText(/nueva nota/i)).not.toBeInTheDocument();
});

test("muestra el error de la API sin romper la pantalla", async () => {
  const { default: PendientesPage } = await import("@/components/pendientes/PendientesPage");
  const api = await import("@/lib/api");
  vi.spyOn(api, "getPendientes").mockRejectedValueOnce(new Error("El tablero de pendientes no está disponible"));
  setSession("tok", "admin", "Persona A");

  render(
    <ThemeProvider attribute="class">
      <PendientesPage area="INFRA" section="pendientes-infra" title="Pendientes Infra & SSAA" />
    </ThemeProvider>,
  );
  expect(await screen.findByText(/no está disponible/i)).toBeInTheDocument();
});
