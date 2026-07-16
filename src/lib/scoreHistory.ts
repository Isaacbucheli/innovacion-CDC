import type { WafScoreHistory } from "@/types";

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Serie de un pilar (1..5) como lista cronológica de números|null.
export function pillarSeries(history: WafScoreHistory | null, pillar: number): (number | null)[] {
  if (!history) return [];
  return history.series.map((p) => p.pillars[String(pillar)] ?? null);
}

// Puntos SVG (polyline) de una mini-sparkline. X uniforme por índice, Y invertida (0 abajo,
// 100 arriba). Ignora nulls conectando los válidos. "" si hay <2 válidos.
export function sparklinePoints(values: (number | null)[], width: number, height: number, pad = 2): string {
  const valid = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null);
  if (valid.length < 2) return "";
  const n = values.length - 1 || 1;
  const span = height - pad * 2;
  return valid
    .map((p) => {
      const x = (p.i / n) * width;
      const clamped = Math.max(0, Math.min(100, p.v));
      const y = pad + (1 - clamped / 100) * span;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
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
