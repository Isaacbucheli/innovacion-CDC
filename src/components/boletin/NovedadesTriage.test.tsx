import type { ComponentProps } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import NovedadesTriage from "@/components/boletin/NovedadesTriage";
import type { NovedadCliente } from "@/types";

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

function setup(pendientes: NovedadCliente[], overrides?: Partial<ComponentProps<typeof NovedadesTriage>>) {
  const onDraftChange = vi.fn();
  const onDecidir = vi.fn();
  const onBulkReject = vi.fn();
  const drafts = Object.fromEntries(pendientes.map((n) => [n.id, n.por_que ?? ""]));
  const utils = render(
    <NovedadesTriage
      pendientes={pendientes}
      english={false}
      drafts={drafts}
      onDraftChange={onDraftChange}
      busyId={null}
      onDecidir={onDecidir}
      onBulkReject={onBulkReject}
      {...overrides}
    />,
  );
  return { ...utils, onDraftChange, onDecidir, onBulkReject };
}

test("fila compacta muestra el título pero NO el textarea hasta expandir", () => {
  const n = novedad({ id: 1 });
  setup([n]);
  expect(screen.getByText(n.titulo_es!)).toBeInTheDocument();
  expect(screen.queryByDisplayValue(n.por_que!)).not.toBeInTheDocument();
});

test("al hacer clic en la fila se expande: aparece descripción, link y textarea del por_que", () => {
  const n = novedad({ id: 1 });
  setup([n]);
  fireEvent.click(screen.getByText(n.titulo_es!));

  expect(screen.getByText(n.descripcion_es!)).toBeInTheDocument();
  expect(screen.getByDisplayValue(n.por_que!)).toBeInTheDocument();
  const link = screen.getByRole("link", { name: /Ver anuncio en Azure Updates/i });
  expect(link).toHaveAttribute("href", n.link);
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
});

test("expandir una fila colapsa la anterior (una a la vez)", () => {
  const a = novedad({ id: 1, titulo_es: "Novedad A", por_que: "Por qué de A" });
  const b = novedad({ id: 2, titulo_es: "Novedad B", por_que: "Por qué de B" });
  setup([a, b]);

  fireEvent.click(screen.getByText("Novedad A"));
  expect(screen.getByDisplayValue(a.por_que!)).toBeInTheDocument();

  fireEvent.click(screen.getByText("Novedad B"));
  expect(screen.queryByDisplayValue(a.por_que!)).not.toBeInTheDocument();
  expect(screen.getByDisplayValue(b.por_que!)).toBeInTheDocument();
});

test("Aprobar/Rechazar en la fila expandida llaman a onDecidir con la novedad y el estado", () => {
  const n = novedad({ id: 7 });
  const { onDecidir } = setup([n]);
  fireEvent.click(screen.getByText(n.titulo_es!));

  fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
  expect(onDecidir).toHaveBeenCalledWith(n, "aprobada");

  fireEvent.click(screen.getByRole("button", { name: "Rechazar" }));
  expect(onDecidir).toHaveBeenCalledWith(n, "rechazada");
});

test("el textarea de la fila expandida llama a onDraftChange con el id y el nuevo texto", () => {
  const n = novedad({ id: 3, por_que: "Texto original" });
  const { onDraftChange } = setup([n]);
  fireEvent.click(screen.getByText(n.titulo_es!));

  fireEvent.change(screen.getByDisplayValue("Texto original"), { target: { value: "Texto editado" } });
  expect(onDraftChange).toHaveBeenCalledWith(3, "Texto editado");
});

test("chips: con recursos muestra cantidad + resourceTypeLabel; sin recursos, ninguno", () => {
  const conRecursos = novedad({
    id: 1, titulo_es: "Con recursos",
    recursos: [{ type: "microsoft.compute/virtualmachines", cantidad: 83 }, { type: "microsoft.compute/virtualmachinescalesets", cantidad: 1 }],
  });
  const sinRecursos = novedad({ id: 2, titulo_es: "Sin recursos", recursos: null });
  setup([conRecursos, sinRecursos]);

  expect(screen.getByText("83 Virtual Machines")).toBeInTheDocument();
  expect(screen.getByText("1 VM Scale Sets")).toBeInTheDocument();
});

test("ícono: sin recursos (o sin match) cae al ícono Lucide de la categoría BIT", () => {
  const n = novedad({ id: 1, recursos: null, categoria_bit: "seguridad_identidad" });
  const { container } = setup([n]);
  // Sin recursos no hay <img> de ícono de servicio; el fallback es un ícono Lucide (SVG inline).
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("svg")).not.toBeNull();
});

test("ícono: con recursos mapeados usa el ícono de servicio Azure (img data URI)", () => {
  const n = novedad({ id: 1, recursos: [{ type: "microsoft.compute/virtualmachines", cantidad: 3 }] });
  const { container } = setup([n]);
  const img = container.querySelector("img");
  expect(img).not.toBeNull();
  expect(img).toHaveAttribute("src", expect.stringMatching(/^data:image\/svg\+xml/));
});

test("filtro por categoría reduce las filas visibles", () => {
  const ia = novedad({ id: 1, titulo_es: "Novedad IA", categoria_bit: "productividad_ia" });
  const seg = novedad({ id: 2, titulo_es: "Novedad Seguridad", categoria_bit: "seguridad_identidad" });
  setup([ia, seg]);

  expect(screen.getByText("Novedad IA")).toBeInTheDocument();
  expect(screen.getByText("Novedad Seguridad")).toBeInTheDocument();

  fireEvent.keyDown(screen.getByRole("combobox", { name: "Filtrar por categoría" }), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("option", { name: "Seguridad e identidad" }));

  expect(screen.queryByText("Novedad IA")).not.toBeInTheDocument();
  expect(screen.getByText("Novedad Seguridad")).toBeInTheDocument();
});

test("filtro por estado (GA/Preview) reduce las filas visibles", () => {
  const ga = novedad({ id: 1, titulo_es: "Novedad GA", estado_feed: "launched" });
  const preview = novedad({ id: 2, titulo_es: "Novedad Preview", estado_feed: "in_preview" });
  setup([ga, preview]);

  fireEvent.keyDown(screen.getByRole("combobox", { name: "Filtrar por estado" }), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("option", { name: "Estado: Preview" }));

  expect(screen.queryByText("Novedad GA")).not.toBeInTheDocument();
  expect(screen.getByText("Novedad Preview")).toBeInTheDocument();
});

test("la búsqueda matchea título/titulo_es/por_que, case-insensitive", () => {
  const a = novedad({ id: 1, titulo_es: "Trusted Launch por defecto", por_que: "Usa VMs" });
  const b = novedad({ id: 2, titulo_es: "Otra novedad", por_que: "Nada que ver" });
  setup([a, b]);

  fireEvent.change(screen.getByLabelText("Buscar novedad"), { target: { value: "trusted" } });

  expect(screen.getByText("Trusted Launch por defecto")).toBeInTheDocument();
  expect(screen.queryByText("Otra novedad")).not.toBeInTheDocument();
});

test("pill GA / Preview según estado_feed", () => {
  const ga = novedad({ id: 1, estado_feed: "launched" });
  const preview = novedad({ id: 2, estado_feed: "in_preview" });
  setup([ga, preview]);

  expect(screen.getByText("GA")).toBeInTheDocument();
  expect(screen.getByText("Preview")).toBeInTheDocument();
});

test("seleccionar filas y 'Rechazar seleccionadas' llama a onBulkReject con los ids marcados", () => {
  const a = novedad({ id: 1, titulo_es: "Novedad A" });
  const b = novedad({ id: 2, titulo_es: "Novedad B" });
  const { onBulkReject } = setup([a, b]);

  fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Novedad A" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Novedad B" }));

  expect(screen.getByText("2 seleccionadas")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Rechazar seleccionadas" }));

  expect(onBulkReject).toHaveBeenCalledWith([1, 2]);
});

test("'Limpiar' vacía la selección y oculta la barra de lote", () => {
  const a = novedad({ id: 1, titulo_es: "Novedad A" });
  setup([a]);

  fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Novedad A" }));
  expect(screen.getByText("1 seleccionada")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
  expect(screen.queryByText("1 seleccionada")).not.toBeInTheDocument();
});

test("el checkbox del header selecciona/deselecciona toda la página visible", () => {
  const a = novedad({ id: 1, titulo_es: "Novedad A" });
  const b = novedad({ id: 2, titulo_es: "Novedad B" });
  setup([a, b]);

  fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar la página" }));
  expect(screen.getByText("2 seleccionadas")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar la página" }));
  expect(screen.queryByText(/seleccionada/)).not.toBeInTheDocument();
});

test("paginación: 15 pendientes muestran 10 en la página 1 y navegan a la página 2", () => {
  const pendientes = Array.from({ length: 15 }, (_, i) =>
    novedad({ id: i + 1, titulo_es: `Novedad ${String(i + 1).padStart(2, "0")}` }));
  setup(pendientes);

  expect(screen.getByText("Novedad 01")).toBeInTheDocument();
  expect(screen.getByText("Novedad 10")).toBeInTheDocument();
  expect(screen.queryByText("Novedad 11")).not.toBeInTheDocument();
  expect(screen.getByText(/Mostrando 1–10 de 15/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));

  expect(screen.getByText("Novedad 11")).toBeInTheDocument();
  expect(screen.queryByText("Novedad 01")).not.toBeInTheDocument();
});

test("sin pendientes que coincidan con el filtro muestra el mensaje vacío", () => {
  const n = novedad({ id: 1, titulo_es: "Novedad única" });
  setup([n]);
  fireEvent.change(screen.getByLabelText("Buscar novedad"), { target: { value: "no existe" } });
  expect(screen.getByText(/Sin novedades pendientes que coincidan con el filtro\./)).toBeInTheDocument();
});

test("el toggle english (prop) cambia el título mostrado en la fila compacta", () => {
  const n = novedad({ id: 1 });
  const { rerender } = setup([n], { english: false });
  expect(screen.getByText(n.titulo_es!)).toBeInTheDocument();

  rerender(
    <NovedadesTriage
      pendientes={[n]}
      english
      drafts={{ [n.id]: n.por_que ?? "" }}
      onDraftChange={vi.fn()}
      busyId={null}
      onDecidir={vi.fn()}
      onBulkReject={vi.fn()}
    />,
  );
  expect(screen.getByText(n.titulo)).toBeInTheDocument();
});

test("busyId deshabilita Aprobar/Rechazar solo en la fila correspondiente", () => {
  const n = novedad({ id: 9 });
  setup([n], { busyId: 9 });
  fireEvent.click(screen.getByText(n.titulo_es!));

  expect(screen.getByRole("button", { name: "Aprobar" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Rechazar" })).toBeDisabled();
});

test("no muestra la barra de lote cuando no hay nada seleccionado", () => {
  const n = novedad({ id: 1 });
  setup([n]);
  expect(screen.queryByRole("button", { name: /Rechazar seleccionadas/ })).not.toBeInTheDocument();
});

test("solo hay un textarea visible a la vez, aunque haya varias novedades", () => {
  const a = novedad({ id: 1, titulo_es: "Novedad A" });
  const b = novedad({ id: 2, titulo_es: "Novedad B" });
  const { container } = setup([a, b]);

  fireEvent.click(screen.getByText("Novedad A"));
  expect(container.querySelectorAll("textarea").length).toBe(1);
});

test("la selección se poda cuando una fila seleccionada deja de estar pendiente (no re-decide aprobadas)", () => {
  // Hallazgo del review final E5: marcar A y B, aprobar A (reload la saca de pendientes) y luego
  // "Rechazar seleccionadas" volteaba la aprobada a rechazada en silencio.
  const a = novedad({ id: 1, titulo_es: "Novedad A" });
  const b = novedad({ id: 2, titulo_es: "Novedad B" });
  const { rerender, onBulkReject, onDraftChange, onDecidir } = setup([a, b]);

  fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Novedad A" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Novedad B" }));
  expect(screen.getByText("2 seleccionadas")).toBeInTheDocument();

  // A se aprobó en otra parte: el reload deja solo B como pendiente.
  rerender(
    <NovedadesTriage
      pendientes={[b]}
      english={false}
      drafts={{ 2: b.por_que ?? "" }}
      onDraftChange={onDraftChange}
      busyId={null}
      onDecidir={onDecidir}
      onBulkReject={onBulkReject}
    />,
  );

  expect(screen.getByText("1 seleccionada")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Rechazar seleccionadas/i }));
  expect(onBulkReject).toHaveBeenCalledWith([2]);
});
