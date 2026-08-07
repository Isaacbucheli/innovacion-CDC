import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InsumoCards from "./InsumoCards";
import type { InsumoEstado } from "@/types";

const base: InsumoEstado = {
  kind: "facturacion", obligatorio: true, cargado: false,
  source_file_name: null, cargado_en: null, filas: 0, status: null, warnings: [],
};

const cargado: InsumoEstado = {
  ...base, cargado: true, source_file_name: "bitcost.xlsx", filas: 26608,
};

// Radix abre el menú al pointerdown (no solo al click); sin este paso previo el contenido no
// llega a montarse en jsdom. Mismo idioma que WafActions.test.tsx.
function abrirOpciones() {
  const boton = screen.getByRole("button", { name: /opciones para/i });
  fireEvent.pointerDown(boton, { button: 0, ctrlKey: false });
  fireEvent.click(boton);
}

describe("InsumoCards", () => {
  it("marca los insumos obligatorios que faltan", () => {
    render(<InsumoCards insumos={[base]} canEdit onSubir={() => {}} onBorrar={() => {}} />);
    expect(screen.getByText(/obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/falta este archivo/i)).toBeInTheDocument();
  });

  it("muestra el archivo y el conteo de filas cuando está cargado", () => {
    render(<InsumoCards canEdit onSubir={() => {}} onBorrar={() => {}}
      insumos={[{ ...base, cargado: true, source_file_name: "bitcost.xlsx", filas: 26608 }]} />);
    expect(screen.getByText(/bitcost\.xlsx/)).toBeInTheDocument();
    expect(screen.getByText(/26,608|26\.608/)).toBeInTheDocument();
  });

  it("un insumo opcional no dice obligatorio", () => {
    render(<InsumoCards canEdit onSubir={() => {}} onBorrar={() => {}}
      insumos={[{ ...base, kind: "rbac", obligatorio: false }]} />);
    expect(screen.queryByText(/obligatorio/i)).toBeNull();
  });

  it("sin permiso de edición no ofrece subir", () => {
    render(<InsumoCards insumos={[base]} canEdit={false} onSubir={() => {}} onBorrar={() => {}} />);
    expect(screen.queryByRole("button", { name: /subir/i })).toBeNull();
  });

  // Defecto 3 (revisión entrega 1): el servidor rechaza la subida de RBAC con un 400 ("llega en
  // la entrega 2"), pero la tarjeta la ofrecía igual -> el consultor elige archivo, espera la
  // subida y recién ahí se entera de que era un camino muerto. La tarjeta ya no ofrece "Opciones"
  // para este insumo (ni Subir ni Quitar) y explica en su cuerpo cómo se resuelve por ahora.
  it("rbac no ofrece Opciones: se resuelve por la revisión de accesos, no por carga manual", () => {
    render(<InsumoCards canEdit onSubir={() => {}} onBorrar={() => {}}
      insumos={[{ ...base, kind: "rbac", obligatorio: false }]} />);

    expect(screen.queryByRole("button", { name: /opciones para/i })).toBeNull();
    expect(screen.getByText(/revisión de accesos del cliente/i)).toBeInTheDocument();
    expect(screen.getByText(/la carga manual llega más adelante/i)).toBeInTheDocument();
  });

  it("rbac sigue sin Opciones aunque llegue marcado como cargado (no hay nada que quitar)", () => {
    render(<InsumoCards canEdit onSubir={() => {}} onBorrar={() => {}}
      insumos={[{ ...cargado, kind: "rbac", obligatorio: false }]} />);

    expect(screen.queryByRole("button", { name: /opciones para/i })).toBeNull();
    // El resto de la tarjeta (su estado) sigue igual: esto no es display:none del bloque entero.
    expect(screen.getByText(/^cargado ·/i)).toBeInTheDocument();
  });

  it("facturación sí ofrece subir", async () => {
    render(<InsumoCards canEdit onSubir={() => {}} onBorrar={() => {}} insumos={[base]} />);
    abrirOpciones();
    expect(await screen.findByText(/^subir$/i)).toBeInTheDocument();
  });

  it("casos sí ofrece subir", async () => {
    render(<InsumoCards canEdit onSubir={() => {}} onBorrar={() => {}}
      insumos={[{ ...base, kind: "casos" }]} />);
    abrirOpciones();
    expect(await screen.findByText(/^subir$/i)).toBeInTheDocument();
  });

  // Defecto 1 (revisión entrega 1): "Quitar" no puede disparar el borrado de una, porque el
  // archivo le costó al consultor bajarlo y subirlo, y el borrado es irreversible del lado del
  // servidor.
  it("Quitar pide confirmación antes de borrar", async () => {
    const onBorrar = vi.fn();
    render(<InsumoCards insumos={[cargado]} canEdit onSubir={() => {}} onBorrar={onBorrar} />);
    abrirOpciones();

    fireEvent.click(await screen.findByText(/^quitar$/i));

    expect(await screen.findByText(/quitar este insumo/i)).toBeInTheDocument();
    const dialogo = screen.getByRole("alertdialog");
    expect(within(dialogo).getByText(/bitcost\.xlsx/)).toBeInTheDocument();
    expect(within(dialogo).getByText(/volver a subirlo/i)).toBeInTheDocument();
    expect(onBorrar).not.toHaveBeenCalled();
  });

  it("confirmar en el diálogo sí quita el insumo", async () => {
    const onBorrar = vi.fn();
    render(<InsumoCards insumos={[cargado]} canEdit onSubir={() => {}} onBorrar={onBorrar} />);
    abrirOpciones();
    fireEvent.click(await screen.findByText(/^quitar$/i));
    await screen.findByRole("alertdialog");

    fireEvent.click(screen.getByRole("button", { name: /^quitar$/i }));

    expect(onBorrar).toHaveBeenCalledWith("facturacion");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("cancelar en el diálogo no quita el insumo", async () => {
    const onBorrar = vi.fn();
    render(<InsumoCards insumos={[cargado]} canEdit onSubir={() => {}} onBorrar={onBorrar} />);
    abrirOpciones();
    fireEvent.click(await screen.findByText(/^quitar$/i));
    await screen.findByRole("alertdialog");

    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onBorrar).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  // Defecto 2: mientras hay una subida o un borrado en curso, el disparador de "Opciones" se
  // deshabilita (antes solo BusyOverlay bloqueaba el mouse, no el teclado). No se simula el
  // click sobre el botón ya deshabilitado: fireEvent despacha el evento directo al DOM y no
  // reproduce la supresión real del navegador para elementos disabled (a diferencia de
  // user-event, que este repo no usa); el atributo es lo que el navegador sí va a respetar.
  it("con busy el disparador de Opciones queda deshabilitado", () => {
    render(<InsumoCards insumos={[cargado]} canEdit busy onSubir={() => {}} onBorrar={() => {}} />);
    expect(screen.getByRole("button", { name: /opciones para/i })).toBeDisabled();
  });
});
