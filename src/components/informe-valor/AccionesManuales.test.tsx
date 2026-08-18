import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AccionesManuales from "./AccionesManuales";
import type { AccionManual } from "@/types";

const api = vi.hoisted(() => ({
  getAccionesManuales: vi.fn(),
  crearAccionManual: vi.fn(),
  actualizarAccionManual: vi.fn(),
  eliminarAccionManual: vi.fn(),
  extraerAccionesEvidencia: vi.fn(),
}));

vi.mock("@/lib/api", () => api);

function accion(over: Partial<AccionManual> = {}): AccionManual {
  return {
    accion_id: 1,
    oportunidad: "Apagado de VMs de desarrollo",
    categoria: null,
    mes_ejecucion: "2026-07",
    mes_fin: null,
    monto_mensual: 450,
    recurso: "vm-dev-01",
    nota: null,
    evidencia: "correo del cliente",
    creado_por: "consultor@bit.ec",
    creado_en: "2026-08-01T00:00:00Z",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getAccionesManuales.mockResolvedValue([]);
});

describe("AccionesManuales", () => {
  it("lista las acciones del cliente", async () => {
    api.getAccionesManuales.mockResolvedValue([
      accion(),
      accion({ accion_id: 2, oportunidad: "Reducción de plan App Service", monto_mensual: null, evidencia: null }),
    ]);

    render(<AccionesManuales clientId={7} canEdit onCambio={() => {}} />);

    expect(await screen.findByText("Apagado de VMs de desarrollo")).toBeInTheDocument();
    expect(screen.getByText("Reducción de plan App Service")).toBeInTheDocument();
    expect(screen.getByText("sin monto")).toBeInTheDocument();
    expect(screen.getByLabelText("Con evidencia adjunta")).toBeInTheDocument();
  });

  it("el alta valida el mes antes de llamar la api", async () => {
    render(<AccionesManuales clientId={7} canEdit onCambio={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: /Agregar acción/ }));
    fireEvent.change(screen.getByLabelText("Oportunidad"), { target: { value: "Apagado de VMs" } });
    fireEvent.change(screen.getByLabelText("Mes de ejecución"), { target: { value: "2026-13" } });
    fireEvent.click(screen.getByRole("button", { name: /Registrar acción/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/aaaa-MM/);
    expect(api.crearAccionManual).not.toHaveBeenCalled();
  });

  it("sin permiso de edición la tabla es de solo lectura", async () => {
    api.getAccionesManuales.mockResolvedValue([accion()]);
    render(<AccionesManuales clientId={7} canEdit={false} onCambio={() => {}} />);

    expect(await screen.findByText("Apagado de VMs de desarrollo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Agregar acción/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Extraer desde evidencia/ })).toBeNull();
  });

  it("el diálogo de evidencia propone candidatas y confirma las seleccionadas", async () => {
    api.extraerAccionesEvidencia.mockResolvedValue([
      { oportunidad: "Apagado de VMs de desarrollo", mes: "2026-07", monto: 450, recurso: null, cita: "se apagaron las 3 VMs" },
      { oportunidad: "Reducción de plan del App Service", mes: "2026-07", monto: null, recurso: null, cita: "se completó la reducción" },
    ]);
    api.crearAccionManual.mockResolvedValue({ accion_id: 10 });
    const onCambio = vi.fn();

    render(<AccionesManuales clientId={7} canEdit onCambio={onCambio} />);

    fireEvent.click(await screen.findByRole("button", { name: /Extraer desde evidencia/ }));
    fireEvent.change(
      screen.getByPlaceholderText(/confirmamos que el 15 de julio/),
      { target: { value: "correo: se apagaron las 3 VMs con ahorro de $450 mensuales" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /Analizar evidencia/ }));

    // Desmarca la segunda candidata: solo la primera se registra.
    fireEvent.click(await screen.findByLabelText("Incluir Reducción de plan del App Service"));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar 1 acción/ }));

    await waitFor(() => expect(api.crearAccionManual).toHaveBeenCalledTimes(1));
    const [clientId, body] = api.crearAccionManual.mock.calls[0];
    expect(clientId).toBe(7);
    expect(body.oportunidad).toBe("Apagado de VMs de desarrollo");
    expect(body.monto_mensual).toBe(450);
    expect(body.evidencia).toContain("se apagaron las 3 VMs");
    await waitFor(() => expect(onCambio).toHaveBeenCalled());
  });

  it("una candidata sin mes exige completarlo antes de confirmar", async () => {
    api.extraerAccionesEvidencia.mockResolvedValue([
      { oportunidad: "Reducción de plan", mes: null, monto: null, recurso: null, cita: "se completó" },
    ]);

    render(<AccionesManuales clientId={7} canEdit onCambio={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: /Extraer desde evidencia/ }));
    fireEvent.change(
      screen.getByPlaceholderText(/confirmamos que el 15 de julio/),
      { target: { value: "minuta de la reunión" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /Analizar evidencia/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Confirmar 1 acción/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Completa el mes/);
    expect(api.crearAccionManual).not.toHaveBeenCalled();
  });
});
