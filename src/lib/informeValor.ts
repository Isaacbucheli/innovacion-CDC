// Helpers de la vista del informe de valor (entrega 3, tarea 5). Sin JSX: lo que se pueda probar
// sin montar un componente vive acá.

import { fmtDateISO } from "@/lib/dates";
import type {
  CoberturaInsumos, InformeValorGenerarRequest, InformeValorModelo, InformeValorPreviewRequest,
  RangoMeses, VarianteInforme,
} from "@/types";

/**
 * Los ocho bloques económicos que se aprueban uno por uno en la ENTREGA (spec §UX). En la vista de
 * revisión se muestran todos: el consultor tiene que ver el monto para poder decidir si lo publica.
 * Esta lista existe en un solo lugar para que la pestaña de entrega y las marcas de la vista no
 * puedan discrepar sobre cuáles son ni cómo se llaman.
 *
 * `clave` es LA MISMA GRAFÍA que la API (`BloqueEconomicoExtensions.Clave()` en el repo .NET): el
 * literal que viaja en el POST de generación, el que se guarda en
 * `informe_valor_entrega.bloques_publicados` y el que aparece en el objeto `PUBLICACION` del
 * artefacto. Es camelCase a propósito y no se traduce en el camino: la API no adivina, y un bloque
 * que no reconoce sale APAGADO sin avisar (`Parsear` devuelve null), o sea que una grafía distinta
 * acá no rompe nada visible — publica un informe sin los montos que el consultor creyó aprobar.
 *
 * `apagado` dice qué deja de viajar cuando el bloque NO está aprobado, siguiendo al exportador
 * (`InformeValorHtmlExporter.Recortar`), que es quien decide qué sale del archivo. Ojo que no
 * coincide con las secciones de esta vista: la carga mensual retirada se dibuja bajo "Gasto del
 * período" y el artefacto la recorta con "Ahorro activo", y el reparto por suscripción y la
 * comparativa interanual se dibujan en secciones sin marca y viajan con "Composición por servicio".
 */
export const BLOQUES_ECONOMICOS = [
  {
    clave: "gastoTotal", etiqueta: "Gasto total del período",
    publica: "El monto acumulado y el promedio mensual",
    apagado: "El total del período y las columnas de promedio mensual y total del año",
  },
  {
    clave: "serieMensual", etiqueta: "Serie mensual de consumo",
    publica: "La facturación mes a mes con sus montos",
    apagado: "El monto de cada mes, en el gráfico y en la serie de altas y bajas",
  },
  {
    clave: "composicionServicio", etiqueta: "Composición por servicio",
    publica: "En qué se gasta, con monto y porcentaje por categoría",
    apagado: "La serie por categoría completa, el reparto por suscripción y la comparativa interanual",
  },
  {
    clave: "ahorroActivo", etiqueta: "Ahorro activo",
    publica: "La línea que dejó de facturar, con su tasa mensual y anualizada",
    apagado: "La línea base, la tasa mensual, la anualizada y la carga mensual retirada",
  },
  {
    clave: "centroCosto", etiqueta: "Reparto por centro de costo",
    publica: "El gasto asignado a cada área del cliente",
    apagado: "El monto de cada centro de costo (los centros siguen listados)",
  },
  {
    clave: "ahorroAdvisor", etiqueta: "Ahorro identificado por Advisor",
    publica: "La cifra realizable tras depurar duplicados y opciones excluyentes",
    apagado: "El ahorro bruto, el realizable, el descartado y el monto de cada línea",
  },
  {
    clave: "ahorroEjecutado", etiqueta: "Ahorro ejecutado",
    publica: "El acumulado, sus gráficos por categoría y por oportunidad, y la proyección a fin de año",
    apagado: "El acumulado, la tasa vigente, la proyección, los dos gráficos y el monto de cada acción de la tabla",
  },
  {
    clave: "reservasFacturadas", etiqueta: "Reservas facturadas",
    publica: "La tabla que cruza cada VM cubierta por reserva contra lo que costaba por demanda",
    apagado: "El total por demanda, el de la reserva, el ahorro, el ahorro anualizado y el monto de cada fila",
  },
] as const;

export type BloqueEconomico = (typeof BLOQUES_ECONOMICOS)[number]["clave"];

/**
 * Lo que la variante del cliente no lleva nunca, con interruptores o sin ellos: la variación del
 * consumo (los tres baldes de la atribución) no la cubre ninguno de los ocho bloques, así que el
 * exportador la recorta entera. Se dice en pantalla porque el consultor la acaba de revisar en la
 * pestaña del informe y no tiene por qué adivinar que no viaja.
 */
export const FUERA_DE_LOS_OCHO = "La variación del consumo (aporte de reservas y los tres baldes) "
  + "no la cubre ninguno de los ocho bloques: el informe del cliente no la lleva, ni siquiera "
  + "aprobando todo. Para publicarla hace falta su propio interruptor.";

/**
 * Por qué el ahorro de Advisor puede venir en cero sin que el cliente tenga cero ahorro. Vive acá y
 * no en la sección que lo dibuja porque la pestaña de entrega publica el mismo motivo: dos
 * redacciones del mismo vacío son dos definiciones del mismo concepto.
 */
export const MOTIVO_SIN_AHORRO_ADVISOR =
  "Ninguna recomendación de este cliente trae el ahorro anual cuantificado: "
  + "Azure no siempre lo devuelve y no se persiste en columna propia. La cifra no es cero, no se pudo medir.";

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

export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * "2026-01" -> "ene 2026". Es una etiqueta de mes calendario, no un instante: se formatea por
 * string a propósito, sin construir un Date, porque cualquier conversión de zona movería el mes al
 * anterior (la regla de lib/dates aplica a timestamps del backend, no a estas claves).
 */
export function etiquetaMes(ym: string | null | undefined): string {
  if (!ym) return "";
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

/** De qué insumo salió el período que la pantalla propone. */
export type FuenteDelPeriodo = "facturacion" | "evolucion" | "casos";

export interface PeriodoSugerido extends RangoMeses {
  fuente: FuenteDelPeriodo;
}

/** Cómo se llama cada insumo cuando hay que decir de dónde salió el período. */
export const NOMBRE_FUENTE: Record<FuenteDelPeriodo, string> = {
  facturacion: "facturación (BITCOST)",
  evolucion: "evolución por recurso (BITCOST)",
  casos: "casos de la mesa de servicio",
};

/**
 * El período que la pantalla propone: el que cubren los insumos cargados, no una ventana fija.
 *
 * Manda facturación porque es el eje económico del informe (gasto, costo unitario, variación); si
 * no está, sirve evolución, que trae los mismos meses por otro camino, y recién al final los casos,
 * que cubren la operación pero no el dinero. Sin ninguno de los tres devuelve `null` y quien llama
 * se queda con su criterio: proponer un rango sin datos detrás sería inventarlo.
 */
export function periodoSugerido(cobertura: CoberturaInsumos | null | undefined): PeriodoSugerido | null {
  const fuentes: FuenteDelPeriodo[] = ["facturacion", "evolucion", "casos"];
  for (const fuente of fuentes) {
    const r = cobertura?.[fuente];
    if (r?.desde && r.hasta && r.hasta >= r.desde) return { ...r, fuente };
  }
  return null;
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

// ---- Entrega: qué se publica y con qué parámetros (tareas 6 y 7) ----

/**
 * Cuerpo del POST de generación: los MISMOS parámetros con los que se calculó la vista previa, más
 * la variante y los bloques aprobados.
 *
 * `bloques` va siempre, también en la variante interna, donde la API los ignora a propósito (pedir
 * la interna es pedir el informe completo). Lo que queda archivado no es esta lista sino la que el
 * artefacto publica de verdad, así que mandarla no puede inflar la bitácora.
 *
 * El orden sale de `BLOQUES_ECONOMICOS` y no del orden en que el consultor fue prendiendo los
 * interruptores: el mismo pedido produce siempre el mismo cuerpo.
 */
export function cuerpoDeGeneracion(
  cuerpo: InformeValorPreviewRequest, variante: VarianteInforme, aprobados: readonly BloqueEconomico[],
): InformeValorGenerarRequest {
  return {
    ...cuerpo,
    variante,
    bloques: BLOQUES_ECONOMICOS.filter((b) => aprobados.includes(b.clave)).map((b) => b.clave),
  };
}

/** Los meses parciales de dos cuerpos, sin aplanar el tri-estado. */
function mismosParciales(a: string[] | null, b: string[] | null): boolean {
  // `null` (la heurística decide) y `[]` (el consultor declaró que ninguno es parcial) son
  // decisiones distintas y reemiten distinto: no se pueden comparar como si fueran lo mismo.
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((m, i) => m === b[i]);
}

/**
 * Si dos cuerpos miden la misma ventana. Lo usa la pestaña de entrega para no dejar generar un
 * artefacto con parámetros que nadie revisó: el consultor puede tocar el período después de mirar
 * el informe, y el archivo saldría de otra ventana que la que aprobó.
 */
export function mismoCuerpo(
  a: InformeValorPreviewRequest | null, b: InformeValorPreviewRequest | null,
): boolean {
  if (a === null || b === null) return a === b;
  return a.period_start === b.period_start
    && a.period_end === b.period_end
    && a.corte === b.corte
    && mismosParciales(a.meses_parciales_forzados, b.meses_parciales_forzados);
}

/** Una fila del resumen de entrega: el bloque, si está aprobado, y qué cifra tiene hoy el modelo. */
export interface ResumenBloque {
  clave: BloqueEconomico;
  etiqueta: string;
  publica: string;
  apagado: string;
  aprobado: boolean;
  /** La cifra que este bloque publicaría, ya formateada. `null` = el modelo no la tiene. */
  valor: string | null;
  /** Por qué no hay cifra. Nunca null cuando `valor` es null: un bloque sin cifra dice por qué. */
  motivo: string | null;
}

/**
 * Qué cifra pondría cada bloque en el artefacto, leída del modelo que el consultor acaba de revisar.
 *
 * Las cifras salen de los mismos campos que dibuja la vista del informe (`fact.total`,
 * `fact.ahorro.dif`, `advisor.real`...) y los motivos de vacío usan la misma redacción: la pestaña
 * de entrega no vuelve a definir ninguna cifra por su cuenta.
 *
 * Un bloque sin cifra igual se puede aprobar. Aprobarlo no inventa un monto: la sección del
 * artefacto va a decir lo mismo que dice esta pantalla.
 */
export function resumenBloques(
  modelo: InformeValorModelo, aprobados: readonly BloqueEconomico[],
): ResumenBloque[] {
  const fact = modelo.fact;
  const advisor = modelo.advisor;
  const categorias = porCategoria(modelo.catSerie);
  const sinFacturacion = "Sin facturación en el período: el bloque no tiene ninguna cifra que "
    + "publicar. No es un gasto de cero.";

  function cifra(clave: BloqueEconomico): { valor: string | null; motivo: string | null } {
    switch (clave) {
      case "gastoTotal":
        return fact
          ? { valor: fmtMonto(fact.total), motivo: null }
          : { valor: null, motivo: sinFacturacion };
      case "serieMensual":
        return fact && fact.meses.length > 0
          ? { valor: `${fmtNum(fact.meses.length)} mes(es) con monto`, motivo: null }
          : { valor: null, motivo: fact ? "Ningún mes con facturación en el rango." : sinFacturacion };
      case "composicionServicio":
        return categorias.length > 0
          ? {
            valor: `${fmtNum(categorias.length)} categoría(s) · ${fmtMonto(categorias.reduce((s, c) => s + c.value, 0))}`,
            motivo: null,
          }
          : { valor: null, motivo: "El modelo no trae la serie por categoría para este rango." };
      case "ahorroActivo":
        return fact?.ahorro
          ? { valor: `${fmtMonto(fact.ahorro.dif)} por mes`, motivo: null }
          : {
            valor: null,
            motivo: fact
              ? "Ninguna categoría muestra una caída sostenida que cumpla la regla en este rango. "
                + "No es un ahorro de cero."
              : sinFacturacion,
          };
      case "centroCosto":
        return fact && fact.cc.length > 0
          ? {
            valor: `${fmtNum(fact.cc.length)} centro(s) · ${fmtMonto(fact.cc.reduce((s, c) => s + num(c[1]), 0))}`,
            motivo: null,
          }
          : {
            valor: null,
            motivo: fact
              ? "El insumo no trae centro de costo para ninguna fila del rango."
              : sinFacturacion,
          };
      case "ahorroAdvisor":
        if (!advisor) {
          return {
            valor: null,
            motivo: "Sin recomendaciones de Advisor para este cliente. No equivale a una postura perfecta.",
          };
        }
        // nSav es el conteo de líneas con ahorro cuantificado: con 0, `real` vale 0 por falta de
        // dato y no por falta de ahorro. Misma lectura que la sección de postura.
        return advisor.nSav === 0
          ? { valor: null, motivo: MOTIVO_SIN_AHORRO_ADVISOR }
          : { valor: fmtMonto(advisor.real), motivo: null };
      case "ahorroEjecutado": {
        const ej = modelo.ejecutado;
        if (!ej || !ej.medido) {
          return {
            valor: null,
            motivo: ej?.motivo
              ?? "No hay registro de acciones ejecutadas para este período: sin barrido, sin matriz y sin reservas.",
          };
        }
        return { valor: `${fmtMonto(ej.total)} acumulado · ${fmtMonto(ej.tasaVigente)}/mes vigente`, motivo: null };
      }
      case "reservasFacturadas": {
        const rs = modelo.ejecutado?.reservas;
        if (!rs || !rs.medido) {
          return { valor: null, motivo: rs?.motivo ?? "No se pudieron leer las reservas del cliente." };
        }
        return rs.filas.length > 0
          ? { valor: `${fmtNum(rs.filas.length)} VM · ${fmtMonto(rs.totalAhorro)}/mes de ahorro`, motivo: null }
          : { valor: null, motivo: "Ninguna VM está cubierta por una instancia reservada en este rango." };
      }
    }
  }

  return BLOQUES_ECONOMICOS.map((b) => ({
    clave: b.clave,
    etiqueta: b.etiqueta,
    publica: b.publica,
    apagado: b.apagado,
    aprobado: aprobados.includes(b.clave),
    ...cifra(b.clave),
  }));
}

/**
 * Cómo se lee la columna "Bloques publicados" del archivo de entregas.
 *
 * Una lista vacía es una entrega legítima —el default es publicar sin montos— y se dice con
 * palabras: una celda en blanco o un "0" se leerían como "no se sabe" o como "publicó ceros".
 *
 * Una clave que esta versión del front no conoce se muestra tal cual y se cuenta aparte, en vez de
 * desaparecer: si la API agrega un bloque, la tabla lo dice en lugar de mostrar una entrega con
 * menos bloques de los que publicó.
 */
export function bloquesPublicadosTexto(claves: readonly string[]): {
  texto: string; etiquetas: string[]; desconocidas: string[];
} {
  const etiquetas: string[] = [];
  const desconocidas: string[] = [];
  for (const c of claves) {
    const b = BLOQUES_ECONOMICOS.find((x) => x.clave === c);
    if (b) etiquetas.push(b.etiqueta); else desconocidas.push(c);
  }
  if (claves.length === 0) return { texto: "Ninguno: sin montos", etiquetas, desconocidas };
  if (desconocidas.length === 0 && etiquetas.length === BLOQUES_ECONOMICOS.length) {
    return { texto: "Todos", etiquetas, desconocidas };
  }
  return { texto: `${claves.length} de ${BLOQUES_ECONOMICOS.length}`, etiquetas, desconocidas };
}
