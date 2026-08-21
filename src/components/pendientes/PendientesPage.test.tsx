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

const buscar = (id: string) => payload.pendientes.find((p) => p.id === id)!;

// Las notas se escriben en `payload` como lo haría el backend: el diálogo relee el pendiente después
// de tocarlas, y si el mock no guardara nada el historial se vería vacío y el test mentiría.
const addNota = vi.fn((_area: string, id: string, nota: string) => {
  const p = buscar(id);
  const orden = p.historial.reduce((max, n) => Math.max(max, n.orden), -1) + 1;
  p.historial.push({ hist_id: 900 + orden, orden, fecha: "2026-08-21", nota, autor: "Persona A" });
  return Promise.resolve({ hist_id: 900 + orden });
});
const borrarNota = vi.fn((_area: string, id: string, histId: number) => {
  const p = buscar(id);
  p.historial = p.historial.filter((n) => n.hist_id !== histId);
  return Promise.resolve({});
});
const borrarPendiente = vi.fn(() => Promise.resolve({}));
const crearPendiente = vi.fn(() => Promise.resolve({ id: "nuevo" }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  // structuredClone por llamada: la API real devuelve objetos nuevos y así se ven los efectos de recarga.
  getPendientes: () => Promise.resolve(structuredClone(payload)),
  getPendiente: (_area: string, id: string) => Promise.resolve(structuredClone(buscar(id))),
  addPendienteNota: (...args: unknown[]) => addNota(...(args as [Parameters<typeof addNota>[0], string, string])),
  deletePendienteNota: (...args: unknown[]) => borrarNota(...(args as [string, string, number])),
  deletePendiente: (...args: unknown[]) => borrarPendiente(...(args as [])),
  createPendiente: (...args: unknown[]) => crearPendiente(...(args as [])),
}));

beforeEach(() => {
  localStorage.clear();
  addNota.mockClear();
  borrarNota.mockClear();
  borrarPendiente.mockClear();
  crearPendiente.mockClear();
  payload = structuredClone(baseline);
});

/** Abre "Nuevo pendiente" con la descripción ya escrita: lo común a los tests del selector. */
async function abrirFormulario() {
  await renderPage();
  await screen.findByText("Bloqueante con bitacora");
  fireEvent.click(screen.getByRole("button", { name: /nuevo pendiente/i }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText(/descripción/i), { target: { value: "Caso nuevo" } });
  return dialog;
}

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

test("Limpiar filtros restaura la vista a los valores por defecto", async () => {
  await renderPage();
  await screen.findByText("Bloqueante con bitacora");

  // Sin filtros activos el botón no está.
  expect(screen.queryByRole("button", { name: /limpiar filtros/i })).not.toBeInTheDocument();

  // Filtro por estado (KPI clicable) + búsqueda + mostrar cerrados.
  fireEvent.click(screen.getByRole("button", { name: /en progreso/i }));
  fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: "curso" } });
  fireEvent.click(screen.getByLabelText(/ocultar cerrados/i));
  await waitFor(() => expect(screen.queryByText("Bloqueante con bitacora")).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: /limpiar filtros/i }));

  // Vuelven los defaults: abiertos visibles, cerrados ocultos otra vez, búsqueda vacía.
  await waitFor(() => expect(screen.getByText("Bloqueante con bitacora")).toBeInTheDocument());
  expect(screen.getByText("En curso sin novedad")).toBeInTheDocument();
  expect(screen.queryByText("Ya cerrado")).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText(/buscar/i)).toHaveValue("");
  // Y sin filtros, el botón desaparece.
  expect(screen.queryByRole("button", { name: /limpiar filtros/i })).not.toBeInTheDocument();
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

test("el mismo dialogo trae los campos y el historial", async () => {
  await renderPage();
  fireEvent.click(await screen.findByText("Bloqueante con bitacora"));

  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByRole("heading", { name: /editar pendiente/i })).toBeInTheDocument();
  // Campos editables y bitácora en la misma pantalla, sin panel de detalle aparte.
  expect(within(dialog).getByLabelText(/descripción/i)).toHaveValue("Bloqueante con bitacora");
  expect(within(dialog).getByLabelText(/responsable/i)).toHaveTextContent("Persona C");
  expect(within(dialog).getByText(/Historial/)).toBeInTheDocument();
  expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
  expect(within(dialog).getByRole("button", { name: /guardar/i })).toBeInTheDocument();
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
  // El diálogo sigue abierto y el historial se actualiza solo: antes había que reabrir el detalle.
  await waitFor(() => expect(within(dialog).getAllByRole("listitem")).toHaveLength(4));
  expect(within(dialog).getByText("avance")).toBeInTheDocument();
  expect(within(dialog).getByLabelText(/descripción/i)).toHaveValue("Bloqueante con bitacora");
});

test("borrar una nota la saca del historial sin cerrar el dialogo", async () => {
  await renderPage();
  fireEvent.click(await screen.findByText("Bloqueante con bitacora"));

  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getAllByRole("button", { name: /eliminar nota/i })[0]);

  await waitFor(() => expect(borrarNota).toHaveBeenCalledWith("CDC", "p1", 100));
  await waitFor(() => expect(within(dialog).getAllByRole("listitem")).toHaveLength(2));
  expect(within(dialog).queryByText("nota vieja")).not.toBeInTheDocument();
});

test("un lector no ve acciones de escritura", async () => {
  await renderPage("lector");
  await screen.findByText("Bloqueante con bitacora");

  expect(screen.queryByRole("button", { name: /nuevo pendiente/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();

  // La ficha se abre igual, pero de solo lectura: sin caja de notas, sin Guardar y sin campos activos.
  fireEvent.click(screen.getByText("Bloqueante con bitacora"));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).queryByLabelText(/nueva nota/i)).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: /eliminar nota/i })).not.toBeInTheDocument();
  expect(within(dialog).getByLabelText(/descripción/i)).toBeDisabled();
  expect(within(dialog).getByLabelText(/responsable/i)).toBeDisabled();
  // El historial se sigue viendo: es lo que se viene a consultar.
  expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
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

test("el responsable se elige de una lista con busqueda", async () => {
  const dialog = await abrirFormulario();

  // Ya no es una caja de texto libre: arranca vacío y se abre como desplegable.
  const selector = within(dialog).getByLabelText(/responsable/i);
  expect(selector).toHaveTextContent("Sin asignar");
  fireEvent.click(selector);

  // La lista sale del propio tablero: responsables ya usados + coordinador y consultor del cliente.
  const buscador = within(dialog).getByPlaceholderText(/buscar o escribir/i);
  expect(within(dialog).getByText("Persona B")).toBeInTheDocument();
  expect(within(dialog).getByText("Persona C")).toBeInTheDocument();

  fireEvent.change(buscador, { target: { value: "persona b" } });
  await waitFor(() => expect(within(dialog).queryByText("Persona C")).not.toBeInTheDocument());
  fireEvent.click(within(dialog).getByText("Persona B"));

  expect(within(dialog).getByLabelText(/responsable/i)).toHaveTextContent("Persona B");
  fireEvent.click(within(dialog).getByRole("button", { name: /guardar/i }));
  await waitFor(() => expect(crearPendiente).toHaveBeenCalledWith("CDC", expect.objectContaining({
    descripcion: "Caso nuevo", responsable: "Persona B",
  })));
});

test("se puede guardar un responsable que todavia no esta en la lista", async () => {
  const dialog = await abrirFormulario();

  fireEvent.click(within(dialog).getByLabelText(/responsable/i));
  fireEvent.change(within(dialog).getByPlaceholderText(/buscar o escribir/i), {
    target: { value: "  Persona Z  " },
  });
  // El nombre escrito se ofrece tal cual (sin los espacios de sobra) porque la columna es texto libre.
  fireEvent.click(await within(dialog).findByText(/Usar/));

  expect(within(dialog).getByLabelText(/responsable/i)).toHaveTextContent("Persona Z");
  fireEvent.click(within(dialog).getByRole("button", { name: /guardar/i }));
  await waitFor(() => expect(crearPendiente).toHaveBeenCalledWith("CDC", expect.objectContaining({
    responsable: "Persona Z",
  })));
});

test("Escape cierra la lista de responsables, no el formulario", async () => {
  const dialog = await abrirFormulario();

  fireEvent.click(within(dialog).getByLabelText(/responsable/i));
  const buscador = within(dialog).getByPlaceholderText(/buscar o escribir/i);
  fireEvent.keyDown(buscador, { key: "Escape" });

  await waitFor(() => expect(within(dialog).queryByPlaceholderText(/buscar o escribir/i)).not.toBeInTheDocument());
  // Lo escrito sigue ahí: el diálogo no se cerró detrás del desplegable.
  expect(within(dialog).getByLabelText(/descripción/i)).toHaveValue("Caso nuevo");
});

test("el responsable ya guardado llega marcado y se puede dejar sin asignar", async () => {
  await renderPage();
  await screen.findByText("Bloqueante con bitacora");
  fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]);

  const dialog = await screen.findByRole("dialog");
  const selector = within(dialog).getByLabelText(/responsable/i);
  expect(selector).toHaveTextContent("Persona C");

  fireEvent.click(selector);
  fireEvent.click(within(dialog).getByText("Sin asignar"));
  expect(within(dialog).getByLabelText(/responsable/i)).toHaveTextContent("Sin asignar");
});

test("Enter en el buscador elige el nombre resaltado de la lista", async () => {
  const dialog = await abrirFormulario();

  fireEvent.click(within(dialog).getByLabelText(/responsable/i));
  const buscador = within(dialog).getByPlaceholderText(/buscar o escribir/i);
  fireEvent.change(buscador, { target: { value: "persona b" } });
  fireEvent.keyDown(buscador, { key: "Enter" });

  // Gana el nombre de la lista, no el texto tecleado: la opción "Usar …" va al final.
  await waitFor(() =>
    expect(within(dialog).getByLabelText(/responsable/i)).toHaveTextContent("Persona B"));
});
