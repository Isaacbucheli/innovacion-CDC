import type { PendienteCliente, PendienteItem, PendienteNota } from "@/types";

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

/** Un nombre escrito por gente distinta llega con dobles espacios; se guarda sin ellos. */
export const nombreLimpio = (raw: string | null | undefined) => (raw ?? "").replace(/\s+/g, " ").trim();

/**
 * Clave para comparar nombres: sin mayúsculas ni tildes, porque "Hector" y "Héctor" son la misma
 * persona y la columna es texto libre.
 */
export const claveNombre = (raw: string | null | undefined) =>
  nombreLimpio(raw).toLocaleLowerCase("es").normalize("NFD").replace(/\p{Diacritic}/gu, "");

/**
 * Nombres que ofrece la lista de "Responsable": los que ya se usaron en los pendientes del área más
 * el coordinador y el consultor de cada cliente del tablero.
 *
 * Esta base no tiene catálogo de personas y el tablero es independiente de Asignación de consultores
 * (decisión del usuario, 2026-07-28), así que el propio dato del tablero es la fuente. El campo sigue
 * siendo texto libre: la lista es una ayuda para no volver a escribir el mismo nombre de tres formas.
 */
export function responsablesDelTablero(
  pendientes: PendienteItem[],
  clientes: PendienteCliente[],
): string[] {
  // Clave de comparación → nombre tal como está escrito en la BD, que es lo que se muestra.
  const vistos = new Map<string, string>();
  const agregar = (raw: string | null | undefined) => {
    const nombre = nombreLimpio(raw);
    if (!nombre) return;
    const clave = claveNombre(nombre);
    if (!vistos.has(clave)) vistos.set(clave, nombre);
  };
  // Los responsables primero: si el mismo nombre aparece con otra grafía en la ficha del cliente,
  // gana la grafía que ya vive en la columna Responsable.
  for (const p of pendientes) agregar(p.responsable);
  for (const c of clientes) { agregar(c.coordinador); agregar(c.consultor); }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, "es"));
}
