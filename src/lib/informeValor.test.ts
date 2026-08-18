import { describe, expect, it } from "vitest";
import { fmtDateISO } from "@/lib/dates";
import {
  BLOQUES_ECONOMICOS, MOTIVO_SIN_AHORRO_ADVISOR, bloquesPublicadosTexto, claveNormalizada,
  cuerpoDeGeneracion, cuerpoDeParametros, cuerpoPreview, etiquetaMes, fmtPct, lecturaVariacion,
  mesMas, mesesDelRango, mismoCuerpo, parametrosPorDefecto, periodoSugerido, porCategoria,
  resumenBloques,
} from "@/lib/informeValor";
import type { InformeValorModelo } from "@/types";

describe("cuerpoPreview", () => {
  // El corte se manda al mediodía UTC a propósito. La API lo resuelve a fecha de Guayaquil
  // (UTC-5): con "T00:00:00Z" el corte del informe retrocedería un día y los retiros de Azure se
  // clasificarían contra una fecha que el consultor no eligió.
  it("manda el corte al mediodia UTC para que caiga en el mismo dia en Quito", () => {
    const cuerpo = cuerpoPreview("2026-01", "2026-08", "2026-08-12", null);

    expect(cuerpo.corte).toBe("2026-08-12T12:00:00Z");
    expect(fmtDateISO(new Date(cuerpo.corte))).toBe("2026-08-12");
    // La contraprueba: medianoche UTC es el día anterior en Quito.
    expect(fmtDateISO(new Date("2026-08-12T00:00:00Z"))).toBe("2026-08-11");
  });

  it("manda el rango como primer dia de cada mes", () => {
    const cuerpo = cuerpoPreview("2025-09", "2026-08", "2026-08-12", null);
    expect(cuerpo.period_start).toBe("2025-09-01");
    expect(cuerpo.period_end).toBe("2026-08-01");
  });

  // Tri-estado del contrato: null = heurística, [] = "declaro que no hay ninguno".
  it("distingue heuristica automatica de la declaracion vacia", () => {
    expect(cuerpoDeParametros({
      desde: "2026-01", hasta: "2026-06", corte: "2026-07-01", parcialesAuto: true, parciales: [],
    }).meses_parciales_forzados).toBeNull();

    expect(cuerpoDeParametros({
      desde: "2026-01", hasta: "2026-06", corte: "2026-07-01", parcialesAuto: false, parciales: [],
    }).meses_parciales_forzados).toEqual([]);

    expect(cuerpoDeParametros({
      desde: "2026-01", hasta: "2026-06", corte: "2026-07-01", parcialesAuto: false, parciales: ["2026-06"],
    }).meses_parciales_forzados).toEqual(["2026-06"]);
  });
});

describe("parametrosPorDefecto", () => {
  it("abre con doce meses y la heuristica activa", () => {
    const p = parametrosPorDefecto();
    expect(mesesDelRango(p.desde, p.hasta)).toHaveLength(12);
    expect(p.parcialesAuto).toBe(true);
    expect(p.corte.startsWith(p.hasta)).toBe(true);
  });
});

describe("meses", () => {
  it("cruza el anio al sumar y restar", () => {
    expect(mesMas("2026-01", -1)).toBe("2025-12");
    expect(mesMas("2025-12", 1)).toBe("2026-01");
    expect(mesMas("2026-08", -11)).toBe("2025-09");
  });

  it("enumera el rango inclusivo y devuelve vacio si esta invertido", () => {
    expect(mesesDelRango("2026-01", "2026-03")).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(mesesDelRango("2026-03", "2026-01")).toEqual([]);
  });

  it("etiqueta el mes sin construir un Date (no se corre de mes por zona horaria)", () => {
    expect(etiquetaMes("2026-01")).toBe("ene 2026");
    expect(etiquetaMes("2026-12")).toBe("dic 2026");
    expect(etiquetaMes(null)).toBe("—");
  });
});

describe("claveNormalizada", () => {
  // La política global de serialización de la API transforma las CLAVES de diccionario
  // (catSerie, advisor.porSub): "Redes y Conectividad" llega como "redes_y_conectividad". No se
  // puede revertir desde el front, así que la vista lo declara en vez de disimularlo.
  it("reconoce una clave transformada por SnakeCaseLower", () => {
    expect(claveNormalizada("redes_y_conectividad")).toBe(true);
    expect(claveNormalizada("azure_sql_database")).toBe(true);
  });

  it("no marca un nombre que llego intacto", () => {
    expect(claveNormalizada("Redes y Conectividad")).toBe(false);
    expect(claveNormalizada("Storage")).toBe(false);
    expect(claveNormalizada("(sin categoria)")).toBe(false);
  });
});

describe("porCategoria", () => {
  it("suma la serie mensual de cada categoria y ordena de mayor a menor", () => {
    const filas = porCategoria({
      storage: { "2026-01": 100, "2026-02": 50 },
      compute: { "2026-01": 400 },
    });
    expect(filas).toEqual([
      { name: "compute", value: 400 },
      { name: "storage", value: 150 },
    ]);
  });

  it("sin serie por categoria devuelve vacio, no una fila en cero", () => {
    expect(porCategoria(null)).toEqual([]);
  });
});

describe("lecturaVariacion", () => {
  // Convención de la atribución: positivo = el gasto BAJÓ. El texto ya viene orientado para que
  // nadie tenga que invertir el signo mentalmente.
  it("orienta el signo en el texto", () => {
    expect(lecturaVariacion(1200).tono).toBe("baja");
    expect(lecturaVariacion(1200).texto).toContain("menos por mes");
    expect(lecturaVariacion(-800).tono).toBe("sube");
    expect(lecturaVariacion(-800).texto).toContain("más por mes");
    expect(lecturaVariacion(0).tono).toBe("neutro");
  });
});

describe("fmtPct", () => {
  it("imprime el cero como cero, no como guion", () => {
    expect(fmtPct(0)).toBe("0.0%");
    expect(fmtPct(97.25)).toBe("97.3%");
  });
});

// ---- Entrega (tareas 6 y 7) ----

/** Modelo mínimo con facturación y postura, para el resumen de bloques. */
function modeloConCifras(over: Partial<InformeValorModelo> = {}): InformeValorModelo {
  return {
    meta: {
      cliente: "Cliente de prueba", periodo: "2026-01 a 2026-02", corte: "2026-03-01",
      cobertura: { total: 0, suscripciones: [] }, rbacOrigen: null, conciliacion: null,
    },
    tickets: null, rbac: null, matriz: null,
    catSerie: { compute: { "2026-01": 300 }, storage: { "2026-01": 100 } },
    ejecutado: null, opex: null, cronologia: null,
    fact: {
      filas: 10, filasEnRango: 8, total: 154000,
      meses: [["2026-01", 80000, 0], ["2026-02", 74000, 0]],
      ultCompleto: "2026-02", parciales: [], autoParciales: [], parcialesInexistentes: [],
      subs: [], nRecursos: 0, nIds: 0, nRg: 0, nCats: 2, picoAct: 0, picoMes: null,
      serie: [], bajasDef: 0, cargaRet: 0, unidadCargaRet: "USD",
      prom: [], ahorro: null, comp: null, cc: [["Operaciones", 100000], ["TI", 54000]],
      variacionConsumo: null, unitario: [], mom: [],
    },
    advisor: {
      n: 12, tipos_rec: 3, cats: [], subs: [], tipos: [], top: [], topSum: 0, det: [],
      nRes: 0, recomendacionesConRecurso: 0, high: 0, medium: 0, low: 0,
      bruto: 30000, real: 24000, descarte: 6000, nSav: 4, savLineas: [], porSub: {},
      rets: [], vencidos: 0, proximos: 0, retirosMedido: true, retirosMotivo: null,
      seguridadGestionadaExternamente: false, seguridadGestionadaNota: null,
    },
    ...over,
  };
}

describe("BLOQUES_ECONOMICOS", () => {
  // La grafía de la API (BloqueEconomicoExtensions.Clave() en el repo .NET). No es cosmética: una
  // clave que la API no reconoce sale APAGADA sin error, así que el informe se publicaría sin el
  // monto que el consultor creyó aprobar.
  it("usa las mismas claves camelCase que la API", () => {
    expect(BLOQUES_ECONOMICOS.map((b) => b.clave)).toEqual([
      "gastoTotal", "serieMensual", "composicionServicio", "ahorroActivo", "centroCosto", "ahorroAdvisor",
      "ahorroEjecutado", "reservasFacturadas",
    ]);
  });

  it("cada bloque dice que deja de viajar cuando esta apagado", () => {
    for (const b of BLOQUES_ECONOMICOS) {
      expect(b.apagado.length).toBeGreaterThan(0);
      expect(b.publica.length).toBeGreaterThan(0);
    }
  });
});

describe("cuerpoDeGeneracion", () => {
  const cuerpo = cuerpoPreview("2026-01", "2026-02", "2026-03-01", null);

  it("manda los bloques en el orden canonico, no en el orden en que se prendieron", () => {
    const body = cuerpoDeGeneracion(cuerpo, "cliente", ["ahorroAdvisor", "gastoTotal"]);
    expect(body.bloques).toEqual(["gastoTotal", "ahorroAdvisor"]);
    expect(body.variante).toBe("cliente");
  });

  it("conserva los parametros de la vista previa tal cual", () => {
    const body = cuerpoDeGeneracion(cuerpo, "interna", []);
    expect(body.period_start).toBe(cuerpo.period_start);
    expect(body.period_end).toBe(cuerpo.period_end);
    expect(body.corte).toBe(cuerpo.corte);
    expect(body.meses_parciales_forzados).toBeNull();
    expect(body.bloques).toEqual([]);
  });
});

describe("mismoCuerpo", () => {
  const base = cuerpoPreview("2026-01", "2026-06", "2026-07-01", null);

  it("reconoce dos cuerpos iguales", () => {
    expect(mismoCuerpo(base, cuerpoPreview("2026-01", "2026-06", "2026-07-01", null))).toBe(true);
  });

  it("detecta el cambio de periodo y de corte", () => {
    expect(mismoCuerpo(base, cuerpoPreview("2026-02", "2026-06", "2026-07-01", null))).toBe(false);
    expect(mismoCuerpo(base, cuerpoPreview("2026-01", "2026-06", "2026-07-02", null))).toBe(false);
  });

  // El tri-estado no se aplana: "que decida la heurística" y "declaro que ninguno es parcial" son
  // decisiones distintas y producen informes distintos.
  it("no confunde la heuristica con la declaracion vacia", () => {
    expect(mismoCuerpo(base, cuerpoPreview("2026-01", "2026-06", "2026-07-01", []))).toBe(false);
    expect(mismoCuerpo(
      cuerpoPreview("2026-01", "2026-06", "2026-07-01", []),
      cuerpoPreview("2026-01", "2026-06", "2026-07-01", []),
    )).toBe(true);
    expect(mismoCuerpo(
      cuerpoPreview("2026-01", "2026-06", "2026-07-01", ["2026-06"]),
      cuerpoPreview("2026-01", "2026-06", "2026-07-01", ["2026-05"]),
    )).toBe(false);
  });

  it("sin cuerpo revisado no hay nada que comparar", () => {
    expect(mismoCuerpo(null, base)).toBe(false);
    expect(mismoCuerpo(null, null)).toBe(true);
  });
});

describe("resumenBloques", () => {
  it("lee cada cifra de los mismos campos que dibuja la vista", () => {
    const filas = resumenBloques(modeloConCifras(), []);
    const por = (c: string) => filas.find((f) => f.clave === c)!;

    expect(por("gastoTotal").valor).toBe("$154,000.00");
    expect(por("serieMensual").valor).toContain("2 mes(es)");
    expect(por("composicionServicio").valor).toContain("$400.00");
    expect(por("centroCosto").valor).toContain("$154,000.00");
    expect(por("ahorroAdvisor").valor).toBe("$24,000.00");
  });

  it("los ocho salen apagados cuando no se aprobo ninguno", () => {
    expect(resumenBloques(modeloConCifras(), []).every((f) => !f.aprobado)).toBe(true);
  });

  it("marca aprobado solo el que se aprobo", () => {
    const filas = resumenBloques(modeloConCifras(), ["gastoTotal"]);
    expect(filas.filter((f) => f.aprobado).map((f) => f.clave)).toEqual(["gastoTotal"]);
  });

  // Ninguna cifra ausente se publica sin decir por qué está ausente, ni acá ni en el artefacto.
  it("sin facturacion no devuelve cero: devuelve el motivo", () => {
    const filas = resumenBloques(modeloConCifras({ fact: null, catSerie: null }), []);
    for (const clave of ["gastoTotal", "serieMensual", "composicionServicio", "ahorroActivo", "centroCosto"]) {
      const f = filas.find((x) => x.clave === clave)!;
      expect(f.valor).toBeNull();
      expect(f.motivo).toBeTruthy();
    }
    expect(filas.find((f) => f.clave === "gastoTotal")!.motivo).toMatch(/no es un gasto de cero/i);
  });

  it("sin ahorro cuantificado por Advisor no publica el cero del modelo", () => {
    const m = modeloConCifras();
    const filas = resumenBloques(
      { ...m, advisor: { ...m.advisor!, nSav: 0, bruto: 0, real: 0, descarte: 0 } }, []);
    const f = filas.find((x) => x.clave === "ahorroAdvisor")!;
    expect(f.valor).toBeNull();
    expect(f.motivo).toBe(MOTIVO_SIN_AHORRO_ADVISOR);
  });

  it("sin caida sostenida el ahorro activo dice que no hay caida, no un ahorro de cero", () => {
    const f = resumenBloques(modeloConCifras(), []).find((x) => x.clave === "ahorroActivo")!;
    expect(f.valor).toBeNull();
    expect(f.motivo).toMatch(/no es un ahorro de cero/i);
  });
});

describe("bloquesPublicadosTexto", () => {
  // La entrega sin bloques es legítima (es el default): se dice con palabras, porque una celda vacía
  // se lee como "no se sabe" y un 0 como "publicó ceros".
  it("la entrega sin bloques se lee como omision, no como cero", () => {
    expect(bloquesPublicadosTexto([]).texto).toBe("Ninguno: sin montos");
  });

  it("los ocho se resumen como Todos y los parciales se cuentan", () => {
    expect(bloquesPublicadosTexto(BLOQUES_ECONOMICOS.map((b) => b.clave)).texto).toBe("Todos");
    expect(bloquesPublicadosTexto(["gastoTotal", "centroCosto"]).texto).toBe("2 de 8");
  });

  // Un bloque que esta versión del front no conoce no desaparece de la fila: la entrega publicó algo
  // y la tabla lo dice.
  it("no esconde una clave que no conoce", () => {
    const r = bloquesPublicadosTexto(["gastoTotal", "bloqueNuevo"]);
    expect(r.desconocidas).toEqual(["bloqueNuevo"]);
    expect(r.etiquetas).toEqual(["Gasto total del período"]);
    expect(r.texto).toBe("2 de 8");
  });
});

describe("periodoSugerido - el periodo que se propone sale de los insumos", () => {
  const rango = (desde: string, hasta: string) => ({ desde, hasta });

  it("manda facturacion, que es el eje economico del informe", () => {
    expect(periodoSugerido({
      facturacion: rango("2025-03", "2026-06"),
      evolucion: rango("2024-01", "2024-12"),
      casos: rango("2020-01", "2020-02"),
    })).toEqual({ desde: "2025-03", hasta: "2026-06", fuente: "facturacion" });
  });

  it("sin facturacion cae a evolucion y despues a casos", () => {
    expect(periodoSugerido({ facturacion: null, evolucion: rango("2025-01", "2025-08"), casos: null }))
      .toEqual({ desde: "2025-01", hasta: "2025-08", fuente: "evolucion" });
    expect(periodoSugerido({ facturacion: null, evolucion: null, casos: rango("2026-02", "2026-05") }))
      .toEqual({ desde: "2026-02", hasta: "2026-05", fuente: "casos" });
  });

  it("sin ningun insumo con meses no propone nada, en vez de inventar un rango", () => {
    expect(periodoSugerido({ facturacion: null, evolucion: null, casos: null })).toBeNull();
    expect(periodoSugerido(null)).toBeNull();
    expect(periodoSugerido(undefined)).toBeNull();
  });

  it("un rango invertido no se propone: pasa al siguiente insumo", () => {
    expect(periodoSugerido({
      facturacion: rango("2026-06", "2025-03"),
      evolucion: rango("2025-01", "2025-08"),
      casos: null,
    })).toEqual({ desde: "2025-01", hasta: "2025-08", fuente: "evolucion" });
  });
});
