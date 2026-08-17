import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PanelEntrega from "./PanelEntrega";
import { cuerpoPreview } from "@/lib/informeValor";
import type { InformeValorEntrega, InformeValorModelo } from "@/types";

const cuerpo = cuerpoPreview("2026-01", "2026-02", "2026-03-01", null);

/** Un modelo con montos en los seis bloques: es lo que el consultor decide publicar o no. */
const modelo: InformeValorModelo = {
  meta: {
    cliente: "Cliente de prueba", periodo: "2026-01 a 2026-02", corte: "2026-03-01",
    cobertura: { total: 0, suscripciones: [] }, rbacOrigen: "base", conciliacion: null,
  },
  tickets: null, rbac: null, matriz: null,
  catSerie: { compute: { "2026-01": 300 } },
  ejecutado: null, opex: null, cronologia: null,
  fact: {
    filas: 10, filasEnRango: 8, total: 154000,
    meses: [["2026-01", 80000, 0], ["2026-02", 74000, 0]],
    ultCompleto: "2026-02", parciales: [], autoParciales: [], parcialesInexistentes: [],
    subs: [], nRecursos: 0, nIds: 0, nRg: 0, nCats: 1, picoAct: 0, picoMes: null,
    serie: [], bajasDef: 0, cargaRet: 1200, unidadCargaRet: "USD",
    prom: [], comp: null, cc: [["Operaciones", 154000]], variacionConsumo: null,
    unitario: [], mom: [],
    ahorro: {
      cat: "compute", pico: 90000, picoMes: "2025-12", fin: 80000, finMes: "2026-01",
      dif: 10000, mesesSostenido: 4, anualizada: 120000,
    },
  },
  advisor: {
    n: 12, tipos_rec: 3, cats: [], subs: [], tipos: [], top: [], topSum: 0, det: [],
    nRes: 0, recomendacionesConRecurso: 0, high: 0, medium: 0, low: 0,
    bruto: 30000, real: 24000, descarte: 6000, nSav: 4, savLineas: [], porSub: {},
    rets: [], vencidos: 0, proximos: 0, retirosMedido: true, retirosMotivo: null,
    seguridadGestionadaExternamente: false, seguridadGestionadaNota: null,
  },
};

function renderPanel(props: Partial<React.ComponentProps<typeof PanelEntrega>> = {}) {
  const onGenerar = vi.fn();
  const onAprobados = vi.fn();
  render(
    <PanelEntrega
      modelo={modelo}
      cuerpoRevisado={cuerpo}
      cuerpoActual={cuerpo}
      aprobados={[]}
      onAprobados={onAprobados}
      canEdit
      generando={null}
      onGenerar={onGenerar}
      ultima={null}
      {...props}
    />,
  );
  return { onGenerar, onAprobados };
}

describe("PanelEntrega", () => {
  // F1: los seis nacen apagados. Que estén apagados es una decisión válida, no un paso pendiente.
  it("arranca con los seis bloques apagados", () => {
    renderPanel();

    const casillas = screen.getAllByRole("checkbox");
    expect(casillas).toHaveLength(6);
    expect(casillas.every((c) => !(c as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText(/0 de 6 aprobados/i)).toBeInTheDocument();
  });

  // El defecto más repetido del módulo, en su forma más peligrosa: un informe de cliente que dice
  // "0" donde debería decir "no publicado" le afirma algo falso a quien paga la factura.
  it("dice que apagar omite el monto, no que lo publica en cero", () => {
    renderPanel();

    expect(screen.getByText(/un bloque apagado no publica un cero: lo omite/i)).toBeInTheDocument();
    expect(screen.getAllByText(/dice “No publicado” en su lugar/i).length).toBe(6);
  });

  it("cada bloque apagado dice que deja de viajar", () => {
    renderPanel();

    expect(screen.getByText(/omite el total del período/i)).toBeInTheDocument();
    expect(screen.getByText(/omite la línea base, la tasa mensual, la anualizada y la carga mensual retirada/i))
      .toBeInTheDocument();
  });

  it("muestra la cifra que cada bloque publicaria, para poder decidir", () => {
    renderPanel();

    expect(screen.getByText("$154,000.00")).toBeInTheDocument();
    expect(screen.getByText("$24,000.00")).toBeInTheDocument();
    expect(screen.getByText("$10,000.00 por mes")).toBeInTheDocument();
  });

  it("aprobar un bloque lo devuelve en el orden canonico", () => {
    const { onAprobados } = renderPanel({ aprobados: ["ahorroAdvisor"] });

    fireEvent.click(screen.getByRole("checkbox", { name: /publicar gasto total del período/i }));
    expect(onAprobados).toHaveBeenCalledWith(["gastoTotal", "ahorroAdvisor"]);
  });

  it("avisa que el informe del cliente sale sin ningun monto con los seis apagados", () => {
    renderPanel();
    expect(screen.getByText(/sale sin ningún monto/i)).toBeInTheDocument();
  });

  // La variación del consumo no la cubre ninguno de los seis interruptores y el exportador la
  // recorta entera: el consultor la acaba de revisar y no tiene por qué adivinar que no viaja.
  it("declara lo que la variante del cliente no lleva nunca", () => {
    renderPanel();
    expect(screen.getByText(/no la cubre ninguno de los seis bloques/i)).toBeInTheDocument();
  });

  it("dice que el informe interno ignora los interruptores", () => {
    renderPanel();
    expect(screen.getByText(/sin mirar los interruptores/i)).toBeInTheDocument();
  });

  it("genera cada variante con su boton", () => {
    const { onGenerar } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /informe interno/i }));
    expect(onGenerar).toHaveBeenCalledWith("interna");

    fireEvent.click(screen.getByRole("button", { name: /informe del cliente/i }));
    expect(onGenerar).toHaveBeenCalledWith("cliente");
  });

  it("sin informe calculado no ofrece generar nada", () => {
    renderPanel({ modelo: null, cuerpoRevisado: null });

    expect(screen.getByText(/todavía no hay nada que entregar/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /informe del cliente/i })).toBeNull();
  });

  // El artefacto tiene que salir de la misma ventana que se revisó: el formulario del período se
  // puede seguir tocando después de calcular.
  it("bloquea la descarga cuando el formulario ya no es lo revisado", () => {
    renderPanel({ cuerpoActual: cuerpoPreview("2026-01", "2026-03", "2026-03-01", null) });

    expect(screen.getByText(/ya no son los del informe que está en pantalla/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /informe del cliente/i })).toBeDisabled();
  });

  it("sin permiso de edicion no deja generar y dice por que", () => {
    renderPanel({ canEdit: false });

    expect(screen.getByText(/necesita permiso de edición/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /informe interno/i })).toBeDisabled();
    expect(screen.getAllByRole("checkbox").every((c) => (c as HTMLInputElement).disabled)).toBe(true);
  });

  it("mientras genera no deja pedir la otra variante", () => {
    renderPanel({ generando: "cliente" });

    expect(screen.getByRole("button", { name: /informe interno/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /informe del cliente/i })).toBeDisabled();
  });

  // Un informe con secciones sin insumo se puede entregar, pero el consultor tiene que saber que
  // salen declaradas ausentes antes de mandarlo.
  it("anticipa las secciones que van declaradas ausentes", () => {
    renderPanel();
    expect(screen.getByText(/sin insumo para operación, seguridad, roadmap/i)).toBeInTheDocument();
    expect(screen.getByText(/no en cero/i)).toBeInTheDocument();
  });

  it("muestra el origen de los permisos que quedo archivado", () => {
    renderPanel();
    expect(screen.getByText("Revisión de accesos")).toBeInTheDocument();
  });

  it("muestra el tri-estado de meses parciales tal como se calculo", () => {
    renderPanel({ cuerpoRevisado: cuerpoPreview("2026-01", "2026-02", "2026-03-01", []) ,
      cuerpoActual: cuerpoPreview("2026-01", "2026-02", "2026-03-01", []) });

    expect(screen.getByText("Ninguno (declarado)")).toBeInTheDocument();
  });
});

const entregaCliente: InformeValorEntrega = {
  entrega_id: 7, period_start: "2026-01-01", period_end: "2026-02-01", corte: "2026-03-01",
  variante: "cliente", bloques_publicados: ["gastoTotal"], rbac_origen: "base",
  file_name: "informe.html", blob_size_bytes: 480000, generated_by: "consultor@ejemplo",
  generated_at: "2026-03-02T14:00:00Z",
};

describe("PanelEntrega - lo que la ultima descarga publico de verdad", () => {
  it("cuenta los bloques que archivo la API, no los interruptores", () => {
    renderPanel({ aprobados: ["gastoTotal"], ultima: entregaCliente });

    expect(screen.getByText(/1 bloque\(s\) con monto/i)).toBeInTheDocument();
  });

  it("dice sin ningun monto en vez de cero bloques", () => {
    renderPanel({ ultima: { ...entregaCliente, bloques_publicados: [] } });

    expect(screen.getByText(/sin ningún monto publicado/i)).toBeInTheDocument();
  });

  // Si lo aprobado y lo archivado dejaran de coincidir (por ejemplo, porque la grafía de las claves
  // se desincronizara con la API), el informe saldría sin montos que el consultor creyó aprobar.
  it("avisa cuando lo archivado no coincide con lo aprobado", () => {
    renderPanel({ aprobados: ["gastoTotal", "centroCosto"], ultima: entregaCliente });

    expect(screen.getByText(/archivó bloques distintos a los aprobados/i)).toBeInTheDocument();
  });

  it("la interna con los seis no se denuncia como discrepancia", () => {
    renderPanel({
      aprobados: [],
      ultima: {
        ...entregaCliente, variante: "interna",
        bloques_publicados: ["gastoTotal", "serieMensual", "composicionServicio", "ahorroActivo", "centroCosto", "ahorroAdvisor"],
      },
    });

    expect(screen.queryByText(/archivó bloques distintos/i)).toBeNull();
    expect(screen.getByText(/6 bloque\(s\) con monto/i)).toBeInTheDocument();
  });
});
