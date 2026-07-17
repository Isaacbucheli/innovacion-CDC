import type { WafScoreHistory } from "@/types";

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Serie de un pilar (1..5) como lista cronológica de números|null.
export function pillarSeries(history: WafScoreHistory | null, pillar: number): (number | null)[] {
  if (!history) return [];
  return history.series.map((p) => p.pillars[String(pillar)] ?? null);
}

// Coordenada de un punto válido escalada al viewBox (Y invertida: 0 abajo, 100 arriba).
export interface SparkCoord { x: number; y: number; value: number; index: number }

// Coordenadas (x,y) de los puntos válidos. X uniforme por índice sobre la longitud total
// (los nulls dejan hueco pero no rompen la escala). [] si hay <2 válidos.
export function sparklineCoords(values: (number | null)[], width: number, height: number, pad = 2): SparkCoord[] {
  const valid = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null);
  if (valid.length < 2) return [];
  const n = values.length - 1 || 1;
  const span = height - pad * 2;
  return valid.map((p) => {
    const clamped = Math.max(0, Math.min(100, p.v));
    return { x: (p.i / n) * width, y: pad + (1 - clamped / 100) * span, value: p.v, index: p.i };
  });
}

// Puntos SVG (polyline) de una mini-sparkline. "" si hay <2 válidos. Deriva de sparklineCoords.
export function sparklinePoints(values: (number | null)[], width: number, height: number, pad = 2): string {
  return sparklineCoords(values, width, height, pad)
    .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
}

// Delta del último válido vs el válido anterior. null si no hay dos válidos.
export function lastDelta(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length < 2) return null;
  return Math.round((valid[valid.length - 1] - valid[valid.length - 2]) * 10) / 10;
}

// Etiqueta de eje X: mes → "Mmm YY"; día/semana → "d/m". Determinista (sin Intl).
export function formatHistoryLabel(isoDate: string, granularity: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m) return isoDate;
  if (granularity === "month") return `${MONTHS_ES[m - 1]} ${String(y).slice(2)}`;
  return `${d ?? 1}/${m}`;
}

// Etiquetas por punto de la serie (alineadas por índice con pillarSeries). [] si no hay historial.
export function historyLabels(history: WafScoreHistory | null, granularity = "month"): string[] {
  if (!history) return [];
  return history.series.map((p) => formatHistoryLabel(p.date, granularity));
}
