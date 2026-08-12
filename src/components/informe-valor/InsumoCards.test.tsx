import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InsumoCards from "./InsumoCards";
import type { EstadoRbacInfo, InsumoEstado } from "@/types";

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

  // "Un insumo opcional no dice obligatorio" vivía acá con kind "rbac": ya no aplica -- el
  // badge Obligatorio de RBAC ahora depende de estadoRbac.disponibilidad, no de este campo
  // (que la API manda fijo en false para este kind). Cobertura equivalente en el describe
  // "InsumoCards - RBAC" de abajo (los casos "completo" y "parcial" no muestran el badge).

  it("sin permiso de edición no ofrece subir", () => {
    render(<InsumoCards insumos={[base]} canEdit={false} onSubir={() => {}} onBorrar={() => {}} />);
    expect(screen.queryByRole("button", { name: /subir/i })).toBeNull();
  });

  // Las dos pruebas de "rbac no ofrece Opciones" (revisión entrega 1, Defecto 3) se invirtieron
  // en el describe "InsumoCards - RBAC" de abajo: la API ya soporta la carga manual de RBAC en
  // dos de sus tres estados, así que la correspondencia correcta ahora es la inversa -- ofrece
  // Opciones salvo cuando la base ya resuelve el insumo por completo.

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

// El insumo de RBAC no es "cargado o no": son tres presentaciones según estadoRbac.disponibilidad
// (ver EstadoRbac.Resolver en la API). Antes del recolector de la entrega 2 la API rechazaba
// cualquier subida de RBAC, y esta tarjeta no ofrecía "Opciones" para ese kind bajo ningún
// estado -- las pruebas de esa época están invertidas más abajo (completo sigue sin ofrecer
// Subir, pero parcial y no_disponible ya sí).
describe("InsumoCards - RBAC", () => {
  const rbacBase: InsumoEstado = {
    kind: "rbac", obligatorio: false, cargado: false,
    source_file_name: null, cargado_en: null, filas: 0, status: null, warnings: [],
  };
  const rbacCargado: InsumoEstado = {
    ...rbacBase, cargado: true, source_file_name: "rbac-respaldo.xlsx", filas: 42,
    cargado_en: "2026-08-01T10:00:00Z",
  };

  const estadoCompleto: EstadoRbacInfo = {
    disponibilidad: "completo", estado_cuenta_medido: true, ultimo_login_medido: true,
    fecha_corrida: "2026-08-01T15:30:00Z",
    motivo: "Los permisos y los datos de identidad (estado de cuenta y último inicio de sesión) "
      + "se obtuvieron completos desde Azure.",
    origen: "base",
  };
  const estadoParcial: EstadoRbacInfo = {
    disponibilidad: "parcial_falta_identidad", estado_cuenta_medido: true, ultimo_login_medido: false,
    fecha_corrida: "2026-08-01T15:30:00Z",
    motivo: "El inventario de permisos y el estado de las cuentas se obtuvieron completos, pero no "
      + "la fecha del último inicio de sesión: el tenant no tiene licencia Microsoft Entra ID P1. "
      + "Si lo necesitas en el informe, sube el Excel de RBAC como respaldo; es opcional.",
    origen: "base",
  };
  const estadoNoDisponible: EstadoRbacInfo = {
    disponibilidad: "no_disponible", estado_cuenta_medido: false, ultimo_login_medido: false,
    fecha_corrida: null,
    motivo: "Todavía no hay una corrida de revisión de accesos finalizada para este cliente. "
      + "Ejecuta la revisión de accesos para completar esta sección del informe, o sube el Excel "
      + "de RBAC: en este estado es obligatorio.",
    origen: null,
  };

  it("completo: resuelto desde la base, sin Subir ni el badge Obligatorio", () => {
    render(<InsumoCards insumos={[rbacBase]} estadoRbac={estadoCompleto} canEdit
      onSubir={() => {}} onBorrar={() => {}} onIrARevisionAccesos={() => {}} />);

    expect(screen.getByText(/resuelto desde la base/i)).toBeInTheDocument();
    expect(screen.getByText(/corrida del/i)).toBeInTheDocument();
    expect(screen.getByText(/fuente: revisión de accesos/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /opciones para/i })).toBeNull();
    expect(screen.queryByText(/^obligatorio$/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /ir a revisión de accesos/i })).toBeNull();
  });

  it("completo con un archivo viejo cargado: sigue resuelto desde la base y Opciones solo ofrece Quitar", async () => {
    render(<InsumoCards insumos={[rbacCargado]} estadoRbac={estadoCompleto} canEdit
      onSubir={() => {}} onBorrar={() => {}} onIrARevisionAccesos={() => {}} />);

    // El archivo queda ahí, pero la API lo descarta ("gana la base"): el titular no debe
    // sugerir que ese archivo es lo que alimenta el informe.
    expect(screen.getByText(/resuelto desde la base/i)).toBeInTheDocument();
    expect(screen.queryByText(/^cargado ·/i)).toBeNull();

    abrirOpciones();
    expect(await screen.findByText(/^quitar$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^subir$/i)).toBeNull();
    expect(screen.queryByText(/^reemplazar$/i)).toBeNull();
  });

  it("parcial_falta_identidad: motivo de la API, los dos ejes por separado y Subir como respaldo opcional", async () => {
    render(<InsumoCards insumos={[rbacBase]} estadoRbac={estadoParcial} canEdit
      onSubir={() => {}} onBorrar={() => {}} onIrARevisionAccesos={() => {}} />);

    expect(screen.getByText(/parcial · falta identidad/i)).toBeInTheDocument();
    expect(screen.getByText(/no tiene licencia microsoft entra id p1/i)).toBeInTheDocument();
    expect(screen.getByText(/^estado de cuenta$/i)).toBeInTheDocument();
    expect(screen.getByText(/^último inicio de sesión$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^obligatorio$/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /ir a revisión de accesos/i })).toBeNull();

    abrirOpciones();
    expect(await screen.findByText(/^subir$/i)).toBeInTheDocument();
  });

  it("parcial con archivo subido: la fuente pasa a ser el archivo aunque la disponibilidad siga en parcial", () => {
    // Caso explícito del spec: disponibilidad "parcial_falta_identidad" + origen "archivo" --
    // los dos campos describen cosas distintas (la base vs. lo que de verdad alimenta el informe).
    // El titular prioriza "Cargado" sobre el texto de la disponibilidad (mismo criterio que
    // facturación/casos: un archivo real es el dato más concreto que hay); "Fuente" es lo que
    // deja ver que, por debajo, la disponibilidad de la base sigue en parcial.
    const estado: EstadoRbacInfo = { ...estadoParcial, origen: "archivo" };
    render(<InsumoCards insumos={[rbacCargado]} estadoRbac={estado} canEdit
      onSubir={() => {}} onBorrar={() => {}} onIrARevisionAccesos={() => {}} />);

    expect(screen.getByText(/^cargado ·/i)).toBeInTheDocument();
    expect(screen.getByText(/fuente: archivo subido/i)).toBeInTheDocument();
  });

  it("no_disponible sin archivo: Obligatorio, falta este archivo y acceso directo a Revisión de accesos", () => {
    const onIr = vi.fn();
    render(<InsumoCards insumos={[rbacBase]} estadoRbac={estadoNoDisponible} canEdit
      onSubir={() => {}} onBorrar={() => {}} onIrARevisionAccesos={onIr} />);

    expect(screen.getByText(/^obligatorio$/i)).toBeInTheDocument();
    expect(screen.getByText(/falta este archivo/i)).toBeInTheDocument();
    expect(screen.getByText(/todavía no hay una corrida de revisión de accesos/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ir a revisión de accesos/i }));
    expect(onIr).toHaveBeenCalledTimes(1);
  });

  it("no_disponible con el archivo ya subido: deja de faltar, pero sigue obligatorio y con el acceso directo", async () => {
    render(<InsumoCards insumos={[rbacCargado]} estadoRbac={estadoNoDisponible} canEdit
      onSubir={() => {}} onBorrar={() => {}} onIrARevisionAccesos={() => {}} />);

    expect(screen.getByText(/^obligatorio$/i)).toBeInTheDocument();
    expect(screen.getByText(/^cargado ·/i)).toBeInTheDocument();
    expect(screen.queryByText(/falta este archivo/i)).toBeNull();
    expect(screen.getByRole("button", { name: /ir a revisión de accesos/i })).toBeInTheDocument();

    abrirOpciones();
    expect(await screen.findByText(/^reemplazar$/i)).toBeInTheDocument();
  });

  it("Subir en rbac llama a onSubir con \"rbac\"", async () => {
    const onSubir = vi.fn();
    render(<InsumoCards insumos={[rbacBase]} estadoRbac={estadoNoDisponible} canEdit
      onSubir={onSubir} onBorrar={() => {}} onIrARevisionAccesos={() => {}} />);
    abrirOpciones();
    fireEvent.click(await screen.findByText(/^subir$/i));
    expect(onSubir).toHaveBeenCalledWith("rbac");
  });

  // Mismo defecto 1 que facturación/casos: el archivo de respaldo también le costó al consultor
  // conseguirlo, así que "Quitar" pasa por la misma confirmación.
  it("Quitar en rbac pasa por ConfirmDelete igual que los demás insumos", async () => {
    const onBorrar = vi.fn();
    render(<InsumoCards insumos={[rbacCargado]} estadoRbac={estadoParcial} canEdit
      onSubir={() => {}} onBorrar={onBorrar} onIrARevisionAccesos={() => {}} />);
    abrirOpciones();
    fireEvent.click(await screen.findByText(/^quitar$/i));

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(onBorrar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^quitar$/i }));
    expect(onBorrar).toHaveBeenCalledWith("rbac");
  });

  it("sin estadoRbac todavía (loading o error) no ofrece Subir ni Quitar", () => {
    render(<InsumoCards insumos={[rbacBase]} estadoRbac={null} canEdit
      onSubir={() => {}} onBorrar={() => {}} onIrARevisionAccesos={() => {}} />);

    expect(screen.getByText(/pendiente/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /opciones para/i })).toBeNull();
  });
});
