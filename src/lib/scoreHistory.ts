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

// --- Reconciliación del sparkline con el score EN VIVO -----------------------------
// La tarjeta muestra el score en vivo (lastRefreshedScore) como headline, pero el sparkline
// sale del timeSeries mensual de Azure, que va rezagado (el bucket del mes actual no alcanza
// aún al score vivo). Para que headline, último punto y tendencia cuenten la misma historia,
// cerramos el sparkline en el score en vivo: reemplazamos el punto del período actual, o lo
// añadimos como columna "actual" si el histórico todavía no lo tiene.

// Clave de período para comparar el último punto del histórico contra "hoy".
function periodKey(y: number, m: number, d: number, granularity: string): string {
  return granularity === "month" ? `${y}-${m}` : `${y}-${m}-${d}`;
}

// ¿Falta en el histórico el punto del período actual? (true también si no hay histórico).
export function needsCurrentColumn(history: WafScoreHistory | null, now: Date, granularity = "month"): boolean {
  if (!history || history.series.length === 0) return true;
  const last = history.series[history.series.length - 1].date;
  const [ly, lm, ld] = last.split("-").map(Number);
  if (!ly || !lm) return true;
  const nowKey = periodKey(now.getFullYear(), now.getMonth() + 1, now.getDate(), granularity);
  return periodKey(ly, lm, ld ?? 1, granularity) !== nowKey;
}

// Etiquetas del eje + si hay que añadir una columna "actual" para anclar el score en vivo.
// Determinista salvo por `now` (inyectable para tests).
export function reconciledAxis(history: WafScoreHistory | null, now: Date, granularity = "month"): { labels: string[]; appendCurrent: boolean } {
  const labels = historyLabels(history, granularity);
  const appendCurrent = needsCurrentColumn(history, now, granularity);
  if (appendCurrent) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    labels.push(formatHistoryLabel(`${y}-${m}-${d}`, granularity));
  }
  return { labels, appendCurrent };
}

// Serie de un pilar reconciliada: termina en el score EN VIVO (el headline de la tarjeta).
// `live=null` deja la serie intacta. `appendCurrent` decide reemplazar el último punto (mismo
// período que hoy) o añadir uno nuevo (el histórico aún no tiene el período actual).
export function reconcilePillarSeries(base: (number | null)[], live: number | null, appendCurrent: boolean): (number | null)[] {
  if (live == null) return base;
  if (appendCurrent) return [...base, live];
  if (base.length === 0) return [live];
  const out = base.slice();
  out[out.length - 1] = live;
  return out;
}
