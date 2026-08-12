import { describe, expect, it } from "vitest";
import { fmtDateISO } from "@/lib/dates";
import {
  claveNormalizada, cuerpoDeParametros, cuerpoPreview, etiquetaMes, fmtPct, lecturaVariacion,
  mesMas, mesesDelRango, parametrosPorDefecto, porCategoria,
} from "@/lib/informeValor";

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
