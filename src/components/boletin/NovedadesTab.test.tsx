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

test("la sección de pendientes solo se muestra con canEdit", async () => {
  const pendiente = novedad({ id: 1, estado: "pendiente" });
  await renderTab({ aprobadas: [], pendientes: [pendiente], ultima_evaluacion: null, feed_actualizado: null }, { canEdit: false });

  // Espera a que termine de cargar (el estado vacío global de aprobadas siempre se pinta).
  await screen.findByText(/Sin novedades aprobadas/i);
  expect(screen.queryByText(/Pendientes de revisión/i)).not.toBeInTheDocument();
  expect(screen.queryByText(pendiente.titulo_es!)).not.toBeInTheDocument();
});

test("con canEdit se ve 'Pendientes de revisión (N)' y el título/por_que de cada una", async () => {
  const pendiente = novedad({ id: 5, estado: "pendiente" });
  await renderTab({ aprobadas: [], pendientes: [pendiente], ultima_evaluacion: null, feed_actualizado: null }, { canEdit: true });

  expect(await screen.findByText("Pendientes de revisión (1)")).toBeInTheDocument();
  expect(screen.getByText(pendiente.titulo_es!)).toBeInTheDocument();
  expect(screen.getByDisplayValue(pendiente.por_que!)).toBeInTheDocument();
});

test("aprobar manda decidirNovedad(id, {estado:'aprobada', por_que}) con el texto EDITADO", async () => {
  const pendiente = novedad({ id: 9, por_que: "Texto original de la IA" });
  await renderTab({ aprobadas: [], pendientes: [pendiente], ultima_evaluacion: null, feed_actualizado: null }, { canEdit: true });
  const { decidirNovedad } = await import("@/lib/api");

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
  // fila A (o "Traer novedades"/"Evaluar") revertía en silencio el texto editado de B al de la IA.
  const a = novedad({ id: 1, titulo_es: "Novedad A", por_que: "IA para A" });
  const b = novedad({ id: 2, titulo_es: "Novedad B", por_que: "IA para B" });
  await renderTab({ aprobadas: [], pendientes: [a, b], ultima_evaluacion: null, feed_actualizado: null }, { canEdit: true });
  const { getNovedades } = await import("@/lib/api");

  const textareaB = await screen.findByDisplayValue("IA para B");
  fireEvent.change(textareaB, { target: { value: "Editado por el consultor para B" } });

  // El reload tras aprobar A devuelve solo B como pendiente, con el texto ORIGINAL de la IA.
  (getNovedades as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    aprobadas: [{ ...a, estado: "aprobada" }],
    pendientes: [b],
    ultima_evaluacion: null,
    feed_actualizado: null,
  });
  fireEvent.click(screen.getAllByRole("button", { name: "Aprobar" })[0]);

  await waitFor(() => expect(screen.queryByText("Pendientes de revisión (1)")).toBeInTheDocument());
  expect(screen.getByDisplayValue("Editado por el consultor para B")).toBeInTheDocument();
  expect(screen.queryByDisplayValue("IA para B")).not.toBeInTheDocument();
});

test("rechazar manda decidirNovedad(id, {estado:'rechazada'})", async () => {
  const pendiente = novedad({ id: 12 });
  await renderTab({ aprobadas: [], pendientes: [pendiente], ultima_evaluacion: null, feed_actualizado: null }, { canEdit: true });
  const { decidirNovedad } = await import("@/lib/api");

  await screen.findByText(pendiente.titulo_es!);
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

test("el toggle english también cambia el título de las novedades pendientes", async () => {
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

test("'Traer novedades' llama ingestarNovedades y muestra un toast con los conteos", async () => {
  await renderTab(emptyView, { canEdit: true });
  const { ingestarNovedades } = await import("@/lib/api");
  const { toast } = await import("sonner");

  fireEvent.click(await screen.findByRole("button", { name: /Traer novedades/i }));

  await waitFor(() => expect(ingestarNovedades).toHaveBeenCalled());
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect((toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatch(/3/);
});

test("'Evaluar para este cliente' en error 503 muestra toast.error con el detail del backend", async () => {
  await renderTab(emptyView, { canEdit: true });
  const api = await import("@/lib/api");
  const { toast } = await import("sonner");
  (api.evaluarNovedades as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
    new Error("Azure OpenAI no disponible temporalmente"),
  );

  fireEvent.click(await screen.findByRole("button", { name: /Evaluar para este cliente/i }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
    expect.stringContaining("Azure OpenAI no disponible temporalmente"),
  ));
});

test("no se ve la sección de pendientes ni la barra de acciones cuando canEdit es false", async () => {
  await renderTab(emptyView, { canEdit: false });
  await screen.findByText(/Sin novedades aprobadas/i);
  expect(screen.queryByRole("button", { name: /Traer novedades/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Evaluar para este cliente/i })).not.toBeInTheDocument();
});
