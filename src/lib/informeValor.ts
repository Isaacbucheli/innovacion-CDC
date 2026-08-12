// Helpers de la vista del informe de valor (entrega 3, tarea 5). Sin JSX: lo que se pueda probar
// sin montar un componente vive acá.

import { fmtDateISO } from "@/lib/dates";
import type { InformeValorModelo, InformeValorPreviewRequest } from "@/types";

/**
 * Los seis bloques económicos que se aprueban uno por uno en la ENTREGA (spec §UX). Acá, en la
 * vista de revisión, se muestran todos: el consultor tiene que ver el monto para poder decidir si
 * lo publica. Esta lista existe en un solo lugar para que la pestaña de entrega (tarea 6) y las
 * marcas de esta vista no puedan discrepar sobre cuáles son ni cómo se llaman.
 */
export const BLOQUES_ECONOMICOS = [
  { clave: "gasto_total", etiqueta: "Gasto total del período", publica: "El monto acumulado y el promedio mensual" },
  { clave: "serie_mensual", etiqueta: "Serie mensual de consumo", publica: "La facturación mes a mes con sus montos" },
  { clave: "composicion_servicio", etiqueta: "Composición por servicio", publica: "En qué se gasta, con monto y porcentaje por categoría" },
  { clave: "ahorro_activo", etiqueta: "Ahorro activo", publica: "La línea que dejó de facturar, con su tasa mensual y anualizada" },
  { clave: "centro_costo", etiqueta: "Reparto por centro de costo", publica: "El gasto asignado a cada área del cliente" },
  { clave: "ahorro_advisor", etiqueta: "Ahorro identificado por Advisor", publica: "La cifra realizable tras depurar duplicados y opciones excluyentes" },
] as const;

export type BloqueEconomico = (typeof BLOQUES_ECONOMICOS)[number]["clave"];

const MONEDA = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2,
});

/** Monto en USD. `null`/`undefined` NO se formatean acá: quien los tiene tiene que mostrar el
 * motivo por el que no hay cifra (ver el componente SinMedir), nunca un "$0.00" ni un guion mudo. */
export function fmtMonto(n: number): string {
  return Number.isFinite(n) ? MONEDA.format(n) : "n/d";
}

/** Entero con separador de miles. */
export function fmtNum(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "n/d";
}

/** Porcentaje con un decimal. Un 0% es un dato válido y se imprime "0.0%", no un guion. */
export function fmtPct(n: number, decimales = 1): string {
  return Number.isFinite(n) ? `${n.toFixed(decimales)}%` : "n/d";
}

/** Horas con un decimal (duraciones de la mesa de servicio). */
export function fmtHoras(n: number): string {
  return Number.isFinite(n) ? `${n.toFixed(1)} h` : "n/d";
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * "2026-01" -> "ene 2026". Es una etiqueta de mes calendario, no un instante: se formatea por
 * string a propósito, sin construir un Date, porque cualquier conversión de zona movería el mes al
 * anterior (la regla de lib/dates aplica a timestamps del backend, no a estas claves).
 */
export function etiquetaMes(ym: string | null | undefined): string {
  if (!ym) return "—";
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  const i = Number(m[2]) - 1;
  return i >= 0 && i < 12 ? `${MESES_CORTOS[i]} ${m[1]}` : ym;
}

/** El mes calendario ("aaaa-MM") de una fecha, en hora de Quito. */
export function mesDe(fechaIso: string): string {
  return fechaIso.slice(0, 7);
}

/** Hoy en Quito, "aaaa-MM-dd" (valor por defecto del corte). */
export function hoyQuito(): string {
  return fmtDateISO(new Date());
}

/** Suma de meses a un "aaaa-MM" (negativo para restar). */
export function mesMas(ym: string, delta: number): string {
  const [a, m] = ym.split("-").map(Number);
  const total = a * 12 + (m - 1) + delta;
  const anio = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

/** Los meses "aaaa-MM" de un rango inclusivo. Vacío si el rango está invertido. */
export function mesesDelRango(desde: string, hasta: string): string[] {
  if (!desde || !hasta || hasta < desde) return [];
  const out: string[] = [];
  for (let m = desde; m <= hasta && out.length < 600; m = mesMas(m, 1)) out.push(m);
  return out;
}

/**
 * Lo que el consultor elige antes de calcular. Vive acá (y no dentro del formulario) porque la
 * pestaña de entrega necesita exactamente los mismos parámetros: el artefacto que se genera tiene
 * que salir del mismo período, el mismo corte y los mismos meses parciales que se revisaron.
 */
export interface ParametrosInforme {
  /** Primer mes del período, "aaaa-MM". */
  desde: string;
  /** Último mes del período, "aaaa-MM". */
  hasta: string;
  /** Fecha de corte, "aaaa-MM-dd". */
  corte: string;
  /** true = la heurística de la API decide qué meses son parciales. */
  parcialesAuto: boolean;
  /** Meses declarados parciales cuando `parcialesAuto` es false. Vacío = "ninguno es parcial". */
  parciales: string[];
}

/** Doce meses hasta el mes en curso, corte de hoy, meses parciales por heurística. */
export function parametrosPorDefecto(): ParametrosInforme {
  const hoy = hoyQuito();
  const hasta = mesDe(hoy);
  return { desde: mesMas(hasta, -11), hasta, corte: hoy, parcialesAuto: true, parciales: [] };
}

/** Cuerpo de las dos fases a partir de los parámetros elegidos. */
export function cuerpoDeParametros(p: ParametrosInforme): InformeValorPreviewRequest {
  return cuerpoPreview(p.desde, p.hasta, p.corte, p.parcialesAuto ? null : p.parciales);
}

/**
 * Cuerpo de las dos fases. El corte viaja al MEDIODÍA UTC: la API lo resuelve a fecha de Guayaquil
 * (UTC-5) y un "T00:00:00Z" caería en el día anterior, con lo que los retiros de Azure se
 * clasificarían contra un corte que el consultor no eligió.
 */
export function cuerpoPreview(
  desde: string, hasta: string, corte: string, mesesParciales: string[] | null,
): InformeValorPreviewRequest {
  return {
    // El rango filtra por mes (año*12+mes en la API), así que el día es indistinto: se manda el 01.
    period_start: `${desde}-01`,
    period_end: `${hasta}-01`,
    corte: `${corte}T12:00:00Z`,
    meses_parciales_forzados: mesesParciales,
  };
}

/**
 * Una clave de diccionario que la política global de serialización de la API dejó normalizada
 * (SnakeCaseLower): "Redes y Conectividad" llega como "redes_y_conectividad".
 *
 * Solo pasa con las CLAVES de diccionario del modelo (`catSerie`, `advisor.porSub`), porque son lo
 * único que no lleva [JsonPropertyName]. No es recuperable desde el front -- la transformación
 * pierde mayúsculas y espacios -- así que la vista lo declara en vez de disimularlo.
 */
export function claveNormalizada(clave: string): boolean {
  return /^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(clave);
}

/** Gasto por categoría (suma de la serie mensual), de mayor a menor. */
export function porCategoria(
  catSerie: InformeValorModelo["catSerie"],
): { name: string; value: number }[] {
  if (!catSerie) return [];
  return Object.entries(catSerie)
    .map(([name, meses]) => ({ name, value: Object.values(meses).reduce((s, v) => s + v, 0) }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Lectura de un monto bajo la convención de signo de la atribución: positivo = el gasto BAJÓ.
 * Devuelve el texto ya orientado para que nadie tenga que invertir el signo mentalmente.
 */
export function lecturaVariacion(monto: number): { texto: string; tono: "baja" | "sube" | "neutro" } {
  if (monto > 0) return { texto: `${fmtMonto(monto)} menos por mes`, tono: "baja" };
  if (monto < 0) return { texto: `${fmtMonto(Math.abs(monto))} más por mes`, tono: "sube" };
  return { texto: "sin variación", tono: "neutro" };
}

/** Valor numérico de una celda posicional (las filas del modelo son tuplas). */
export function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Texto de una celda posicional. */
export function txt(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}
