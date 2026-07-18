import { describe, expect, test } from "vitest";
import { pillarSeries, sparklineCoords, sparklinePoints, lastDelta, formatHistoryLabel, historyLabels, needsCurrentColumn, reconciledAxis, reconcilePillarSeries } from "@/lib/scoreHistory";
import type { WafScoreHistory } from "@/types";

const H: WafScoreHistory = {
  granularity: "month",
  series: [
    { date: "2026-05-01", global: 70, pillars: { "3": 40 } },
    { date: "2026-06-01", global: 76, pillars: { "3": 45 } },
  ],
};

describe("pillarSeries", () => {
  test("extrae la serie de un pilar en orden, con null donde falta", () => {
    expect(pillarSeries(H, 3)).toEqual([40, 45]);
    expect(pillarSeries(H, 1)).toEqual([null, null]);
    expect(pillarSeries(null, 3)).toEqual([]);
  });
});

describe("sparklinePoints", () => {
  test("devuelve puntos escalados (Y invertida) con >=2 válidos", () => {
    const pts = sparklinePoints([0, 100], 100, 20, 0);
    // x: 0 y 100; y: 0→abajo (20), 100→arriba (0)
    expect(pts).toBe("0.0,20.0 100.0,0.0");
  });
  test("devuelve '' con menos de 2 puntos válidos", () => {
    expect(sparklinePoints([null, 50], 100, 20)).toBe("");
    expect(sparklinePoints([], 100, 20)).toBe("");
  });
});

describe("sparklineCoords", () => {
  test("coordenadas con value/index, Y invertida, >=2 válidos", () => {
    expect(sparklineCoords([0, 100], 100, 20, 0)).toEqual([
      { x: 0, y: 20, value: 0, index: 0 },
      { x: 100, y: 0, value: 100, index: 1 },
    ]);
  });
  test("[] con menos de 2 válidos", () => {
    expect(sparklineCoords([null, 50], 100, 20)).toEqual([]);
    expect(sparklineCoords([], 100, 20)).toEqual([]);
  });
  test("nulls iniciales no 'cortan' la línea: se ancla al primer válido (x=0)", () => {
    // Antes [null,50,100] arrancaba a mitad (x=50); ahora abarca todo el ancho.
    expect(sparklineCoords([null, 50, 100], 100, 20, 0)).toEqual([
      { x: 0, y: 10, value: 50, index: 1 },
      { x: 100, y: 0, value: 100, index: 2 },
    ]);
  });
  test("hueco intermedio: se conserva proporcional al índice; index queda original (tooltip alineado)", () => {
    const c = sparklineCoords([40, null, 60, 80], 90, 10, 0);
    expect(c.map((p) => p.x)).toEqual([0, 60, 90]); // i=0→0, i=2→(2/3)*90=60, i=3→90
    expect(c.map((p) => p.index)).toEqual([0, 2, 3]);
  });
});

describe("historyLabels", () => {
  test("una etiqueta por punto de la serie; [] si no hay historial", () => {
    expect(historyLabels(H)).toEqual(["May 26", "Jun 26"]);
    expect(historyLabels(null)).toEqual([]);
  });
});

describe("lastDelta", () => {
  test("último válido menos el anterior válido", () => {
    expect(lastDelta([40, 45])).toBe(5);
    expect(lastDelta([40, null, 45])).toBe(5);
  });
  test("null con menos de 2 válidos", () => {
    expect(lastDelta([45])).toBeNull();
    expect(lastDelta([null, null])).toBeNull();
  });
});

describe("formatHistoryLabel", () => {
  test("mes → 'Mmm YY'; otros → 'd/m'", () => {
    expect(formatHistoryLabel("2026-06-01", "month")).toBe("Jun 26");
    expect(formatHistoryLabel("2026-06-15", "day")).toBe("15/6");
  });
});

describe("needsCurrentColumn", () => {
  const jul18 = new Date(2026, 6, 18); // mes 6 = julio (0-based)
  test("false si el último punto es el mes actual", () => {
    const h: WafScoreHistory = { granularity: "month", series: [{ date: "2026-07-01", global: 76, pillars: {} }] };
    expect(needsCurrentColumn(h, jul18)).toBe(false);
  });
  test("true si el último punto es un mes anterior", () => {
    const h: WafScoreHistory = { granularity: "month", series: [{ date: "2026-06-01", global: 80, pillars: {} }] };
    expect(needsCurrentColumn(h, jul18)).toBe(true);
  });
  test("true si no hay histórico", () => {
    expect(needsCurrentColumn(null, jul18)).toBe(true);
    expect(needsCurrentColumn({ granularity: "month", series: [] }, jul18)).toBe(true);
  });
});

describe("reconciledAxis", () => {
  const jul18 = new Date(2026, 6, 18);
  test("reemplaza (no añade) cuando el histórico ya tiene el mes actual", () => {
    const h: WafScoreHistory = { granularity: "month", series: [
      { date: "2026-06-01", global: 80, pillars: {} },
      { date: "2026-07-01", global: 76, pillars: {} },
    ] };
    expect(reconciledAxis(h, jul18)).toEqual({ labels: ["Jun 26", "Jul 26"], appendCurrent: false });
  });
  test("añade columna 'actual' cuando falta el mes de hoy", () => {
    const h: WafScoreHistory = { granularity: "month", series: [{ date: "2026-06-01", global: 80, pillars: {} }] };
    expect(reconciledAxis(h, jul18)).toEqual({ labels: ["Jun 26", "Jul 26"], appendCurrent: true });
  });
});

describe("reconcilePillarSeries", () => {
  test("reemplaza el último punto con el score en vivo (cierra en el headline)", () => {
    expect(reconcilePillarSeries([80.4, 76], 84, false)).toEqual([80.4, 84]);
  });
  test("añade el score en vivo como punto actual", () => {
    expect(reconcilePillarSeries([80.4, 76], 84, true)).toEqual([80.4, 76, 84]);
  });
  test("deja la serie intacta si no hay score en vivo", () => {
    expect(reconcilePillarSeries([80.4, 76], null, false)).toEqual([80.4, 76]);
  });
  test("serie vacía + score vivo → un solo punto", () => {
    expect(reconcilePillarSeries([], 84, false)).toEqual([84]);
  });
});

describe("escenario de la tarjeta (headline 84 vs histórico 76)", () => {
  test("el sparkline cierra en el headline y la tendencia se corrige", () => {
    const base = [80.4, 76];      // jun, jul (mensual de Azure, rezagado)
    const live = 84;              // lastRefreshedScore = headline
    const rec = reconcilePillarSeries(base, live, false);
    expect(rec[rec.length - 1]).toBe(live); // el gráfico termina en el mismo valor del headline
    expect(lastDelta(rec)).toBe(3.6);       // ▲ +3.6 (antes mostraba ▼ -4.4)
  });
});
