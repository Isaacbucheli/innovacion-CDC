import type { PendienteItem, PendienteNota } from "@/types";

/** Umbral de "sin novedad" del tablero original (STALE_DIAS = 7). */
export const STALE_DIAS = 7;

/** La UI muestra "En progreso"; la BD guarda EN_PROGRESO. Traducción en un solo lugar. */
export const ESTADO_LABEL: Record<string, string> = {
  ABIERTO: "Abierto",
  EN_PROGRESO: "En progreso",
  CERRADO: "Cerrado",
};

export const TIPO_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  BLOQUEANTE: "Bloqueante",
};

export const estadoLabel = (v: string | null | undefined) =>
  v ? ESTADO_LABEL[v] ?? v : "";

export const tipoLabel = (v: string | null | undefined) =>
  v ? TIPO_LABEL[v] ?? v : "";

/**
 * Texto principal de la fila. El título está vacío en casi todos los registros reales, así que la
 * descripción manda; no se inventa texto cuando ambos faltan.
 */
export const tituloPrincipal = (p: PendienteItem) =>
  (p.descripcion?.trim() || p.titulo?.trim() || "(sin descripción)");

/** Última nota del timeline: la de mayor `orden`, no la de fecha más reciente. */
export function ultimaNota(p: PendienteItem): PendienteNota | null {
  if (p.historial.length === 0) return null;
  return p.historial.reduce((max, n) => (n.orden >= max.orden ? n : max), p.historial[0]);
}

/** Fecha de la última novedad: la nota más reciente del timeline, o la creación si no hay notas. */
export function fechaUltimaNovedad(p: PendienteItem): string | null {
  const fechas = p.historial.map((n) => n.fecha).filter((f): f is string => !!f);
  if (fechas.length > 0) return fechas.reduce((a, b) => (a > b ? a : b));
  return p.fecha_creacion;
}

/** Días transcurridos desde la última novedad (null si no hay fecha con la que comparar). */
export function diasSinNovedad(p: PendienteItem, hoy = new Date()): number | null {
  const fecha = fechaUltimaNovedad(p);
  if (!fecha) return null;
  const desde = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(desde.getTime())) return null;
  const ms = new Date(hoy.toDateString()).getTime() - desde.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Un pendiente cerrado nunca está "sin novedad": ya no espera nada. */
export function estaEstancado(p: PendienteItem, hoy = new Date()): boolean {
  if (p.estado === "CERRADO") return false;
  const dias = diasSinNovedad(p, hoy);
  return dias !== null && dias > STALE_DIAS;
}
