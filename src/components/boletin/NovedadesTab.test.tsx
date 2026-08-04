import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import type { NovedadCliente, NovedadesClienteView } from "@/types";

vi.mock("@/lib/api", () => ({
  getNovedades: vi.fn(),
  ingestarNovedades: vi.fn(async () => ({ nuevas: 3, traducidas: 3, total_activas: 40 })),
  evaluarNovedades: vi.fn(async () => ({ evaluadas: 12, candidatas: 2 })),
  decidirNovedad: vi.fn(async () => ({})),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function novedad(overrides: Partial<NovedadCliente>): NovedadCliente {
  return {
    id: 1,
    novedad_id: 101,
    titulo: "Copilot in Azure gets new capability",
    titulo_es: "Copilot en Azure gana una nueva capacidad",
    descripcion: "Full English description of the update.",
    descripcion_es: "Descripción completa en español de la novedad.",
    link: "https://azure.microsoft.com/updates/copilot-nueva-capacidad",
    estado_feed: "launched",
    categoria_bit: "productividad_ia",
    published_at: "2026-07-20T17:00:00Z",
    por_que: "Reduce el tiempo de triage de incidentes en un 30%.",
    estado: "pendiente",
    recursos: null,
    decidido_por: null,
    decidido_at: null,
    ...overrides,
  };
}

const emptyView: NovedadesClienteView = { aprobadas: [], pendientes: [], ultima_evaluacion: null, feed_actualizado: null };

// Fechas relativas al momento REAL de ejecución del test (sin fake timers): así "N llegaron esta
// semana" y "Última evaluación" quedan deterministas sin acoplarse a una fecha fija del sistema.
const AHORA_MS = Date.now();
function haceDias(dias: number): string {
  return new Date(AHORA_MS - dias * 24 * 60 * 60 * 1000).toISOString();
}

beforeEach(() => vi.clearAllMocks());

async function renderTab(view: NovedadesClienteView, opts?: { english?: boolean; canEdit?: boolean }) {
  const { default: NovedadesTab } = await import("@/components/boletin/NovedadesTab");
  const { getNovedades } = await import("@/lib/api");
  (getNovedades as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(view);
  const utils = render(
    <NovedadesTab clientId={7} english={opts?.english ?? false} canEdit={opts?.canEdit ?? false} />,
  );
  return utils;
}

test("sin canEdit se ve el resumen de KPIs, pero no 'Actualizar novedades' ni la tabla de triage", async () => {
  const pendiente = novedad({ id: 1, estado: "pendiente" });
  await renderTab({ aprobadas: [], pendientes: [pendiente], ultima_evaluacion: null, feed_actualizado: null }, { canEdit: false });

  // Espera a que termine de cargar (el estado vacío global de aprobadas siempre se pinta).
  await screen.findByText(/Sin novedades aprobadas/i);
  expect(screen.getByText("Pendientes de revisión")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Actualizar novedades/i })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Buscar novedad")).not.toBeInTheDocument();
  expect(screen.queryByText(pendiente.titulo_es!)).not.toBeInTheDocument();
});

test("con canEdit se ve 'Actualizar novedades' y la tabla de triage con el título/por_que de cada pendiente", async () => {
  const pendiente = novedad({ id: 5, estado: "pendiente" });
  await renderTab({ aprobadas: [], pendientes: [pendiente], ultima_evaluacion: null, feed_actualizado: null }, { canEdit: true });

  expect(await screen.findByRole("button", { name: /Actualizar novedades/i })).toBeInTheDocument();
  expect(screen.getByText(pendiente.titulo_es!)).toBeInTheDocument();

  fireEvent.click(screen.getByText(pendiente.titulo_es!));
  expect(screen.getByDisplayValue(pendiente.por_que!)).toBeInTheDocument();
});

test("aprobar manda decidirNovedad(id, {estado:'aprobada', por_que}) con el texto EDITADO", async () => {
  const pendiente = novedad({ id: 9, por_que: "Texto original de la IA" });
  await renderTab({ aprobadas: [], pendientes: [pendiente], ultima_evaluacion: null, feed_actualizado: null }, { canEdit: true });
  const { decidirNovedad } = await import("@/lib/api");

  fireEvent.click(await screen.findByText(pendiente.titulo_es!));
  const textarea = await screen.findByDisplayValue("Texto original de la IA");
  fireEvent.change(textarea, { target: { value: "Texto editado por el consultor" } });
  fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));

  await waitFor(() => expect(decidirNovedad).toHaveBeenCalledWith(9, {
    estado: "aprobada",
    por_que: "Texto editado por el consultor",
  }));
});

test("recargar tras aprobar UNA fila conserva el por_que editado (y aún sin guardar) de las demás", async () => {
  // Clase de bug real: reload() reconstruía drafts completo desde el servidor, así que aprobar la
  // fila A (o "Actualizar novedades") revertía en silencio el texto editado de B al de la IA.
  const a = novedad({ id: 1, titulo_es: "Novedad A", por_que: "IA para A" });
  const b = novedad({ id: 2, titulo_es: "Novedad B", por_que: "IA para B" });
  await renderTab({ aprobadas: [], pendientes: [a, b], ultima_evaluacion: null, feed_actualizado: null }, { canEdit: true });
  const { getNovedades, decidirNovedad } = await import("@/lib/api");

  // Expandir B y editar su por_que, SIN guardar.
  fireEvent.click(await screen.findByText("Novedad B"));
  const textareaB = await screen.findByDisplayValue("IA para B");
  fireEvent.change(textareaB, { target: { value: "Editado por el consultor para B" } });

  // El reload tras aprobar A devuelve solo B como pendiente, con el texto ORIGINAL de la IA.
  (getNovedades as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    aprobadas: [{ ...a, estado: "aprobada" }],
    pendientes: [b],
    ultima_evaluacion: null,
    feed_actualizado: null,
  });

  // Expandir A (colapsa B, la tabla solo expande una fila a la vez) y aprobarla.
  fireEvent.click(screen.getByText("Novedad A"));
  fireEvent.click(await screen.findByRole("button", { name: "Aprobar" }));

  await waitFor(() => expect(decidirNovedad).toHaveBeenCalledWith(1, {
    estado: "aprobada",
    por_que: "IA para A",
  }));

  // Tras la recarga, B sigue pendiente: se expande de nuevo y debe conservar el texto editado.
  fireEvent.click(await screen.findByText("Novedad B"));
  expect(screen.getByDisplayValue("Editado por el consultor para B")).toBeInTheDocument();
  expect(screen.queryByDisplayValue("IA para B")).not.toBeInTheDocument();
});

test("rechazar manda decidirNovedad(id, {estado:'rechazada'})", async () => {
  const pendiente = novedad({ id: 12 });
  await renderTab({ aprobadas: [], pendientes: [pendiente], ultima_evaluacion: null, feed_actualizado: null }, { canEdit: true });
  const { decidirNovedad } = await import("@/lib/api");

  fireEvent.click(await screen.findByText(pendiente.titulo_es!));
  fireEvent.click(screen.getByRole("button", { name: "Rechazar" }));

  await waitFor(() => expect(decidirNovedad).toHaveBeenCalledWith(12, { estado: "rechazada" }));
});

test("tarjetas aprobadas agrupan por categoría y muestran el por_que; categorías vacías no se renderizan", async () => {
  const ia = novedad({ id: 1, categoria_bit: "productividad_ia", por_que: "Acelera el desarrollo con IA." });
  const seguridad = novedad({
    id: 2, categoria_bit: "seguridad_identidad", titulo: "New Conditional Access template",
    titulo_es: "Nueva plantilla de Acceso Condicional", por_que: "Cierra un gap de MFA.",
  });
  await renderTab({ aprobadas: [ia, seguridad], pendientes: [], ultima_evaluacion: null, feed_actualizado: null }, { canEdit: false });

  expect(await screen.findByText("Productividad e IA")).toBeInTheDocument();
  expect(screen.getByText("Seguridad e identidad")).toBeInTheDocument();
  expect(screen.getByText("Acelera el desarrollo con IA.")).toBeInTheDocument();
  expect(screen.getByText("Cierra un gap de MFA.")).toBeInTheDocument();

  // Sin novedades en estas dos categorías: sus tarjetas no deben existir.
  expect(screen.queryByText("Resiliencia y plataforma")).not.toBeInTheDocument();
  expect(screen.queryByText("Costo y operación")).not.toBeInTheDocument();
});

test("el toggle english cambia el título de las tarjetas aprobadas", async () => {
  const item = novedad({ id: 1 });
  const { rerender } = await renderTab({ aprobadas: [item], pendientes: [], ultima_evaluacion: null, feed_actualizado: null }, { english: false, canEdit: false });

  expect(await screen.findByText(item.titulo_es!)).toBeInTheDocument();

  const { default: NovedadesTab } = await import("@/components/boletin/NovedadesTab");
  rerender(<NovedadesTab clientId={7} english canEdit={false} />);

  expect(await screen.findByText(item.titulo)).toBeInTheDocument();
  expect(screen.queryByText(item.titulo_es!)).not.toBeInTheDocument();
});

test("el toggle english también cambia el título de las novedades en la tabla de triage", async () => {
  const pendiente = novedad({ id: 3 });
  const { rerender } = await renderTab({ aprobadas: [], pendientes: [pendiente], ultima_evaluacion: null, feed_actualizado: null }, { english: false, canEdit: true });

  expect(await screen.findByText(pendiente.titulo_es!)).toBeInTheDocument();

  const { default: NovedadesTab } = await import("@/components/boletin/NovedadesTab");
  rerender(<NovedadesTab clientId={7} english canEdit />);

  expect(await screen.findByText(pendiente.titulo)).toBeInTheDocument();
});

test("estado vacío global sin novedades aprobadas, con hint solo si canEdit", async () => {
  await renderTab(emptyView, { canEdit: true });
  expect(await screen.findByText(/Sin novedades aprobadas para este cliente\./)).toBeInTheDocument();
  expect(screen.getByText(/Trae el feed y evalúa para generar candidatas\./)).toBeInTheDocument();
});

test("estado vacío global sin el hint de edición cuando canEdit es false", async () => {
  await renderTab(emptyView, { canEdit: false });
  expect(await screen.findByText(/Sin novedades aprobadas para este cliente\./)).toBeInTheDocument();
  expect(screen.queryByText(/Trae el feed y evalúa/)).not.toBeInTheDocument();
});

test("pill 'Preview' solo cuando estado_feed es in_preview, y el link 'Ver anuncio' es seguro", async () => {
  const preview = novedad({ id: 1, estado_feed: "in_preview" });
  await renderTab({ aprobadas: [preview], pendientes: [], ultima_evaluacion: null, feed_actualizado: null }, { canEdit: false });

  expect(await screen.findByText("Preview")).toBeInTheDocument();
  const link = screen.getByRole("link", { name: /Ver anuncio/i });
  expect(link).toHaveAttribute("href", preview.link);
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
});

test("'Actualizar novedades' encadena ingestarNovedades → evaluarNovedades y muestra un solo toast con ambos conteos", async () => {
  await renderTab(emptyView, { canEdit: true });
  const { ingestarNovedades, evaluarNovedades } = await import("@/lib/api");
  const { toast } = await import("sonner");

  fireEvent.click(await screen.findByRole("button", { name: /Actualizar novedades/i }));

  await waitFor(() => expect(ingestarNovedades).toHaveBeenCalled());
  await waitFor(() => expect(evaluarNovedades).toHaveBeenCalledWith(7));
  await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
  const msg = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
  expect(msg).toMatch(/3/);
  expect(msg).toMatch(/2/);
  expect(toast.error).not.toHaveBeenCalled();
});

test("'Actualizar novedades' corta si la ingesta falla: evaluarNovedades NO se llama", async () => {
  await renderTab(emptyView, { canEdit: true });
  const api = await import("@/lib/api");
  const { toast } = await import("sonner");
  (api.ingestarNovedades as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
    new Error("Error al traer el feed de novedades"),
  );

  fireEvent.click(await screen.findByRole("button", { name: /Actualizar novedades/i }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
    expect.stringContaining("Error al traer el feed de novedades"),
  ));
  expect(api.evaluarNovedades).not.toHaveBeenCalled();
});

test("'Actualizar novedades' con evaluación en error 503 avisa que el feed sí se actualizó", async () => {
  await renderTab(emptyView, { canEdit: true });
  const api = await import("@/lib/api");
  const { toast } = await import("sonner");
  (api.evaluarNovedades as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
    new Error("Azure OpenAI no disponible temporalmente"),
  );

  fireEvent.click(await screen.findByRole("button", { name: /Actualizar novedades/i }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
    expect.stringContaining("Azure OpenAI no disponible temporalmente"),
  ));
  const msg = (toast.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
  expect(msg).toMatch(/feed se actualizó/i);
});

test("franja: 'N llegaron esta semana' cuenta solo los pendientes publicados en los últimos 7 días", async () => {
  const reciente = novedad({ id: 1, published_at: haceDias(3) });
  const vieja = novedad({ id: 2, published_at: haceDias(10) });
  await renderTab({ aprobadas: [], pendientes: [reciente, vieja], ultima_evaluacion: null, feed_actualizado: null }, { canEdit: true });

  expect(await screen.findByText("1 llegaron esta semana")).toBeInTheDocument();
});

test("franja: 'Última evaluación' muestra 'nunca' cuando ultima_evaluacion es null", async () => {
  await renderTab(emptyView, { canEdit: true });
  expect(await screen.findByText("nunca")).toBeInTheDocument();
});

test("franja: 'Última evaluación' es relativa a partir de ultima_evaluacion/feed_actualizado", async () => {
  await renderTab({ ...emptyView, ultima_evaluacion: haceDias(2), feed_actualizado: haceDias(0) }, { canEdit: true });

  expect(await screen.findByText("hace 2 días")).toBeInTheDocument();
  expect(screen.getByText("feed actualizado hoy")).toBeInTheDocument();
});

test("lote: seleccionar novedades y 'Rechazar seleccionadas' llama decidirNovedad por cada id y recarga", async () => {
  const a = novedad({ id: 1, titulo_es: "Novedad A" });
  const b = novedad({ id: 2, titulo_es: "Novedad B" });
  await renderTab({ aprobadas: [], pendientes: [a, b], ultima_evaluacion: null, feed_actualizado: null }, { canEdit: true });
  const { getNovedades, decidirNovedad } = await import("@/lib/api");
  const { toast } = await import("sonner");

  fireEvent.click(await screen.findByRole("checkbox", { name: "Seleccionar Novedad A" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Novedad B" }));

  (getNovedades as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    aprobadas: [], pendientes: [], ultima_evaluacion: null, feed_actualizado: null,
  });

  fireEvent.click(screen.getByRole("button", { name: "Rechazar seleccionadas" }));

  await waitFor(() => expect(decidirNovedad).toHaveBeenCalledWith(1, { estado: "rechazada" }));
  await waitFor(() => expect(decidirNovedad).toHaveBeenCalledWith(2, { estado: "rechazada" }));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText("Novedad A")).not.toBeInTheDocument());
});
