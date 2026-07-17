import { describe, expect, test } from "vitest";
import { pillarSeries, sparklineCoords, sparklinePoints, lastDelta, formatHistoryLabel, historyLabels } from "@/lib/scoreHistory";
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
