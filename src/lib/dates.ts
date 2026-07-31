// Fechas de toda la app: se muestran SIEMPRE en hora de Quito, Ecuador (America/Guayaquil,
// UTC-5 sin horario de verano), sin importar la zona del navegador.
//
// El backend persiste timestamps en UTC. Históricamente los serializaba sin sufijo 'Z'
// (Kind=Unspecified), y el navegador interpretaba esa hora UTC como local. parseApiDate
// asume UTC cuando el string trae hora pero no zona, así el resultado es correcto con
// respuestas viejas (sin 'Z') y nuevas (con 'Z').

export const APP_TIME_ZONE = "America/Guayaquil";
const LOCALE = "es-EC";

const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Parsea un valor del API. Strings con hora y sin zona se asumen UTC. Devuelve null si no es válido. */
export function parseApiDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = value.trim();
  const iso = !DATE_ONLY.test(s) && !HAS_ZONE.test(s) ? `${s}Z` : s;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fecha y hora en Quito, ej. "31/7/2026, 10:29:40 a. m.". */
export function fmtDateTime(
  value: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = parseApiDate(value);
  return d ? d.toLocaleString(LOCALE, { timeZone: APP_TIME_ZONE, ...options }) : "—";
}

/** Solo la fecha (de un timestamp) en Quito, ej. "31/7/2026". */
export function fmtDate(
  value: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = parseApiDate(value);
  return d ? d.toLocaleDateString(LOCALE, { timeZone: APP_TIME_ZONE, ...options }) : "—";
}

/** Fecha de un timestamp como "yyyy-MM-dd" en Quito (para nombres de archivo, inputs date). */
export function fmtDateISO(value: string | Date | null | undefined): string {
  const d = parseApiDate(value);
  // en-CA formatea yyyy-MM-dd.
  return d ? d.toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE }) : "";
}

/**
 * Fecha calendario literal (sin conversión de zona), ej. "15/7/2026" para "2026-07-15" o
 * "2026-07-15T00:00:00Z". Para campos que son fechas puras (inicio de remediación, cortes de
 * mes): convertirlas a Quito las movería al día anterior.
 */
export function fmtDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return fmtDate(value);
  return `${Number(m[3])}/${Number(m[2])}/${m[1]}`;
}
