import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InformeValorPage from "./InformeValorPage";
import * as api from "@/lib/api";
import type { InformeValorEntrega, InformeValorModelo, InformeVariacionConsumo } from "@/types";

vi.mock("@/lib/api");
vi.mock("@/lib/auth", () => ({
  canEdit: () => true, canEditModule: () => true, canViewModule: () => true,
  getRole: () => "admin", getName: () => "BIT", clearSession: vi.fn(),
}));

const modelo: InformeValorModelo = {
  meta: {
    cliente: "Cliente de prueba", periodo: "2025-09 a 2026-08", corte: "2026-08-12",
    cobertura: { total: 0, suscripciones: [] }, rbacOrigen: "base", conciliacion: null,
  },
  tickets: null, rbac: null, matriz: null, advisor: null, catSerie: null,
  ejecutado: null, opex: null, cronologia: null,
  fact: {
    filas: 10, filasEnRango: 8, total: 154000,
    meses: [["2026-01", 80000, 0]],
    ultCompleto: "2026-01", parciales: [], autoParciales: [], parcialesInexistentes: [],
    subs: [], nRecursos: 0, nIds: 0, nRg: 0, nCats: 1, picoAct: 0, picoMes: null,
    serie: [], bajasDef: 0, cargaRet: 0, unidadCargaRet: "USD",
    prom: [], ahorro: null, comp: null, cc: [], variacionConsumo: null, unitario: [], mom: [],
  },
};

const variacion: InformeVariacionConsumo = {
  reservas: {
    medido: true, motivo: "Se leyeron 0 reservas activas.", errores: [], alertDays: 30,
    ahorroConfirmado: 0, confirmados: [], estimados: [], discrepancias: [],
    aporteAlPeriodo: 0, recursosQueExplicanElPeriodo: [], reservasConConsumidoresNoLeidos: 0,
  },
  atribucion: null, variacionTotal: null,
};

const entrega: InformeValorEntrega = {
  entrega_id: 5, period_start: "2025-09-01", period_end: "2026-08-01", corte: "2026-08-12",
  variante: "cliente", bloques_publicados: ["gastoTotal"], rbac_origen: "base",
  file_name: "informe-de-valor.html", blob_size_bytes: 400000,
  generated_by: "consultor@ejemplo", generated_at: "2026-08-12T15:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listClients).mockResolvedValue([
    { client_id: 3, client_name: "Cliente de prueba", has_logo: false },
  ]);
  // El panel de acciones manuales (entrega 8) carga el registro al montar la pestaña de insumos.
  vi.mocked(api.getAccionesManuales).mockResolvedValue([]);
  vi.mocked(api.getInformeValorEstado).mockResolvedValue({
    insumos: [
      { kind: "facturacion", obligatorio: true, cargado: true, source_file_name: "insumo.xlsx", cargado_en: "2026-08-01T12:00:00Z", filas: 100, status: "ok", warnings: [] },
      { kind: "casos", obligatorio: true, cargado: true, source_file_name: "casos.xlsx", cargado_en: "2026-08-01T12:00:00Z", filas: 50, status: "ok", warnings: [] },
    ],
    estado_rbac: {
      disponibilidad: "completo", estado_cuenta_medido: true, ultimo_login_medido: true,
      fecha_corrida: "2026-08-01T12:00:00Z", motivo: "La revisión de accesos resuelve el insumo.",
      origen: "base",
    },
    periodo: {
      facturacion: { desde: "2025-03", hasta: "2026-06" }, evolucion: null, casos: null,
    },
  });
  vi.mocked(api.previewInformeValor).mockResolvedValue(modelo);
  vi.mocked(api.previewVariacionConsumo).mockResolvedValue(variacion);
  vi.mocked(api.getEntregasInformeValor).mockResolvedValue([]);
  vi.mocked(api.generarInformeValor).mockResolvedValue(entrega);
  vi.mocked(api.descargarEntregaInformeValor).mockResolvedValue(undefined);
});

function montar() {
  render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <InformeValorPage onNavigate={() => {}} />
    </ThemeProvider>,
  );
}

/** Las pestañas de Radix cambian en el mousedown, no en el click: sin ese paso el contenido de la
 * pestaña nueva no se monta. Mismo idioma que los menús de Radix en los otros tests del módulo. */
function irA(pestana: string) {
  const tab = screen.getByRole("tab", { name: pestana });
  fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
  fireEvent.click(tab);
}

async function calcularElInforme() {
  irA("Informe");
  fireEvent.click(await screen.findByRole("button", { name: /ver el informe/i }));
  await waitFor(() => expect(api.previewInformeValor).toHaveBeenCalled());
}

describe("InformeValorPage - el cable entre las pestanas", () => {
  it("tiene las cuatro pestanas del modulo", async () => {
    montar();
    await screen.findByRole("tab", { name: "Insumos" });

    for (const t of ["Insumos", "Informe", "Entrega", "Entregas"]) {
      expect(screen.getByRole("tab", { name: t })).toBeInTheDocument();
    }
  });

  it("el periodo arranca en lo que cubre el insumo, no en los ultimos doce meses", async () => {
    montar();
    await screen.findByRole("tab", { name: "Informe" });
    irA("Informe");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Primer mes del período" })).toHaveTextContent("mar 2025"));
    expect(screen.getByRole("button", { name: "Último mes del período" })).toHaveTextContent("jun 2026");
  });

  it("el informe se pide con el periodo del insumo", async () => {
    montar();
    await screen.findByRole("tab", { name: "Informe" });
    await calcularElInforme();

    const [, cuerpo] = vi.mocked(api.previewInformeValor).mock.calls[0];
    expect(cuerpo.period_start).toBe("2025-03-01");
    expect(cuerpo.period_end).toBe("2026-06-01");
  });

  it("la entrega pide calcular el informe antes de ofrecer descargas", async () => {
    montar();
    await screen.findByRole("tab", { name: "Entrega" });
    irA("Entrega");

    expect(screen.getByText(/todavía no hay nada que entregar/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /informe del cliente/i })).toBeNull();
  });

  it("genera con el cuerpo revisado, la variante y las claves de la API", async () => {
    montar();
    await screen.findByRole("tab", { name: "Informe" });
    await calcularElInforme();

    irA("Entrega");
    fireEvent.click(await screen.findByRole("checkbox", { name: /publicar gasto total del período/i }));
    fireEvent.click(screen.getByRole("button", { name: /informe del cliente/i }));

    await waitFor(() => expect(api.generarInformeValor).toHaveBeenCalled());
    const [clientId, body] = vi.mocked(api.generarInformeValor).mock.calls[0];
    expect(clientId).toBe(3);
    expect(body.variante).toBe("cliente");
    expect(body.bloques).toEqual(["gastoTotal"]);
    // El mismo cuerpo con el que se calculó la vista previa: el artefacto no puede salir de otra
    // ventana que la que se revisó.
    const previo = vi.mocked(api.previewInformeValor).mock.calls[0][1];
    expect(body.period_start).toBe(previo.period_start);
    expect(body.period_end).toBe(previo.period_end);
    expect(body.corte).toBe(previo.corte);
    expect(body.meses_parciales_forzados).toBe(previo.meses_parciales_forzados);

    // Y la descarga sale por la entrega archivada, el mismo camino que el historial.
    await waitFor(() => expect(api.descargarEntregaInformeValor).toHaveBeenCalledWith(3, entrega));
  });

  it("la interna se pide con los ocho apagados y sin tocar los interruptores", async () => {
    montar();
    await screen.findByRole("tab", { name: "Informe" });
    await calcularElInforme();

    irA("Entrega");
    fireEvent.click(await screen.findByRole("button", { name: /informe interno/i }));

    await waitFor(() => expect(api.generarInformeValor).toHaveBeenCalled());
    const [, body] = vi.mocked(api.generarInformeValor).mock.calls[0];
    expect(body.variante).toBe("interna");
    expect(body.bloques).toEqual([]);
  });

  it("la pestana de entregas lista el archivo del cliente", async () => {
    vi.mocked(api.getEntregasInformeValor).mockResolvedValue([entrega]);
    montar();
    await screen.findByRole("tab", { name: "Entregas" });
    irA("Entregas");

    expect(await screen.findByText("consultor@ejemplo")).toBeInTheDocument();
    expect(screen.getByText("1 de 8")).toBeInTheDocument();
  });

  it("descarga una entrega vieja desde el historial", async () => {
    vi.mocked(api.getEntregasInformeValor).mockResolvedValue([entrega]);
    montar();
    await screen.findByRole("tab", { name: "Entregas" });
    irA("Entregas");

    fireEvent.click(await screen.findByRole("button", { name: /descargar/i }));
    await waitFor(() => expect(api.descargarEntregaInformeValor).toHaveBeenCalledWith(3, entrega));
    // Sin volver a generar: el archivo se baja del blob archivado, no de un cálculo nuevo.
    expect(api.generarInformeValor).not.toHaveBeenCalled();
  });

  // Subir o borrar un insumo descarta el informe en pantalla, y con él la posibilidad de entregarlo:
  // un artefacto calculado con los insumos viejos no se puede publicar.
  it("borrar un insumo deja la entrega sin nada que publicar", async () => {
    vi.mocked(api.borrarInsumoInformeValor).mockResolvedValue(undefined);
    montar();
    await screen.findByRole("tab", { name: "Informe" });
    await calcularElInforme();

    irA("Entrega");
    expect(await screen.findByRole("button", { name: /informe del cliente/i })).toBeInTheDocument();

    irA("Insumos");
    const opciones = await screen.findByRole("button", { name: /opciones para bitcost/i });
    fireEvent.pointerDown(opciones, { button: 0, ctrlKey: false });
    fireEvent.click(opciones);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Quitar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Quitar" }));
    await waitFor(() => expect(api.borrarInsumoInformeValor).toHaveBeenCalled());

    irA("Entrega");
    expect(screen.getByText(/todavía no hay nada que entregar/i)).toBeInTheDocument();
  });

  it("el banner de faltantes nombra a la evolución por su nombre legible", async () => {
    vi.mocked(api.getInformeValorEstado).mockResolvedValue({
      insumos: [
        { kind: "facturacion", obligatorio: true, cargado: true, source_file_name: "insumo.xlsx", cargado_en: "2026-08-01T12:00:00Z", filas: 100, status: "ok", warnings: [] },
        { kind: "evolucion", obligatorio: true, cargado: false, source_file_name: null, cargado_en: null, filas: 0, status: "ausente", warnings: [] },
      ],
      estado_rbac: {
        disponibilidad: "completo", estado_cuenta_medido: true, ultimo_login_medido: true,
        fecha_corrida: "2026-08-01T12:00:00Z", motivo: "La revisión de accesos resuelve el insumo.",
        origen: "base",
      },
    });
    montar();
    await screen.findByRole("tab", { name: "Informe" });
    irA("Informe");
    await screen.findByRole("tab", { name: "Informe", selected: true });

    expect(screen.getByText(/Falta el insumo de evolución por recurso \(BITCOST\)/)).toBeInTheDocument();
  });
});
