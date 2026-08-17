import { useState } from "react";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import { fmtNum, fmtPct } from "@/lib/informeValor";
import { fmtDateOnly } from "@/lib/dates";
import type { FaseReservas } from "@/hooks/useInformePreview";
import type {
  InformeCoberturaSub, InformeOperacion, InformeOpex, InformeValorModelo, InformeVariacionConsumo,
} from "@/types";
import { BloqueAusente, Dato, Kpi } from "./Piezas";
import SeccionConsumo from "./SeccionConsumo";
import SeccionCronologia from "./SeccionCronologia";
import SeccionEjecutado from "./SeccionEjecutado";
import SeccionOperacion from "./SeccionOperacion";
import SeccionPostura from "./SeccionPostura";
import SeccionRoadmap from "./SeccionRoadmap";
import SeccionSeguridad from "./SeccionSeguridad";
import VariacionConsumo from "./VariacionConsumo";

const SECCIONES = [
  { clave: "ejecutado", label: "Ejecutado" },
  { clave: "consumo", label: "Consumo" },
  { clave: "operacion", label: "Operación" },
  { clave: "seguridad", label: "Seguridad" },
  { clave: "postura", label: "Postura" },
  { clave: "cronologia", label: "Cronología" },
  { clave: "roadmap", label: "Roadmap" },
];

/**
 * Prosa del score de Opex: el delta del período dice más que "vs. mes anterior" en un informe
 * semestral. Espejo de `opexProsa` en `Plantilla-Dashboard-BIT.html` (mismo dato, misma lectura).
 */
function opexProsa(ox: InformeOpex): string {
  if (ox.serie.length < 2) return `Score al ${ox.fecha ?? "corte"}.`;
  const a = Number(ox.serie[0][1] ?? 0);
  const b = Number(ox.serie[ox.serie.length - 1][1] ?? 0);
  if (a === b) return `Se mantuvo en ${a}% durante el período.`;
  return `${b > a ? "Subió" : "Bajó"} de ${a}% a ${b}% en el período.`;
}

/**
 * Prosa del cumplimiento de SLA para la tarjeta de la cabecera. Espejo de `slaProsa`/`slaSinMedir`
 * en la plantilla: regla de copy de la reunión del 2026-08-13, cada cifra aparece una sola vez.
 */
function operacionProsa(t: InformeOperacion): string {
  if (t.denominadorPct === 0) {
    return `${fmtNum(t.n)} casos registrados y ninguno trae el resultado del acuerdo registrado: el `
      + "cumplimiento de SLA no se pudo medir en este período. No es un cumplimiento de cero, es un "
      + `dato que el insumo no trajo. Mediana de atención de ${t.mediana.toFixed(2)} horas.`;
  }
  const base = t.denominadorPct === t.n && t.cumple === t.n
    ? `${fmtNum(t.n)} casos registrados, todos con SLA evaluado y dentro del acuerdo.`
    : `${fmtNum(t.n)} casos registrados; de los ${fmtNum(t.denominadorPct)} con SLA evaluado, `
      + `${fmtNum(t.cumple)} dentro del acuerdo`
      + `${t.sinEvaluar ? ` y ${fmtNum(t.sinEvaluar)} sin resultado registrado` : ""}.`;
  return `${base} Mediana de atención de ${t.mediana.toFixed(2)} horas.`;
}

/**
 * La vista de revisión del informe: el modelo dibujado con los componentes de gráficos del repo.
 *
 * Es la vista INTERNA y completa. Los ocho bloques económicos se ven todos, con sus montos: la
 * selección de qué se publica es de la pestaña de entrega, no de acá. Los que van a poder apagarse
 * llevan la marca "Económico" para que el consultor sepa cuáles son antes de llegar a esa pantalla.
 *
 * Un bloque en `null` no es un bloque en cero: es un insumo que no está o que no se solapa con el
 * período. Cada uno dice cuál de los dos, en vez de desaparecer de la pantalla.
 */
export default function InformeVista({ modelo, variacion, faseReservas, errorReservas, onReintentarReservas }: {
  modelo: InformeValorModelo;
  variacion: InformeVariacionConsumo | null;
  faseReservas: FaseReservas;
  errorReservas: string | null;
  onReintentarReservas: () => void;
}) {
  const [seccion, setSeccion] = useState("consumo");
  const { meta, ejecutado, opex, tickets, matriz, cronologia } = modelo;

  const colsCobertura: SimpleCol<InformeCoberturaSub>[] = [
    { key: "nombre", label: "Suscripción", render: (s) => s.nombre },
    { key: "fact", label: "Facturación", render: (s) => (s.facturacion ? "Sí" : "—") },
    { key: "rbac", label: "Permisos", render: (s) => (s.rbac ? "Sí" : "—") },
    { key: "advisor", label: "Advisor", render: (s) => (s.advisor ? "Sí" : "—") },
  ];

  // Las cuatro tarjetas de la reunión del 2026-08-13 (mismo contenido que el hero de la plantilla
  // HTML): Optimización, Opex, Operación (SLA) y Avance de remediación. RBAC no entra acá -- su
  // detalle sigue viviendo en la sección Seguridad.
  const optimizacion = !ejecutado
    ? { valor: "—", hint: "Falta el registro de acciones ejecutadas para medir la optimización.", tono: "aviso" as const }
    : !ejecutado.medido
      ? {
        valor: "Sin medición",
        hint: ejecutado.motivo ?? "El registro de acciones ejecutadas no se pudo medir.",
        tono: "aviso" as const,
      }
      : ejecutado.pctGasto === null
        ? {
          valor: "Sin medición",
          hint: "El acumulado no se puede comparar contra el gasto del período porque el gasto no se midió.",
          tono: "aviso" as const,
        }
        : {
          valor: fmtPct(ejecutado.pctGasto, 1),
          hint: `El ahorro acumulado del período equivale al ${ejecutado.pctGasto.toFixed(1)}% del gasto `
            + `total del mismo período. Viene de ${fmtNum(ejecutado.filas.length)} acción(es) de `
            + "optimización ejecutadas; el detalle en dinero va en la sección Ejecutado.",
          tono: "" as const,
        };

  const opexTarjeta = !opex || !opex.medido
    ? {
      valor: "Sin medición",
      hint: (opex && opex.motivo) || "No hay snapshot de Azure Advisor para este cliente.",
      tono: "aviso" as const,
    }
    : {
      valor: opex.actual === null ? "Sin medición" : fmtPct(opex.actual, 1),
      hint: `Pilar de costos de Azure Advisor. ${opexProsa(opex)}`,
      tono: "" as const,
    };

  const operacion = !tickets
    ? { valor: "—", hint: "Falta el export de la mesa de servicio para medir el cumplimiento de SLA.", tono: "aviso" as const }
    : tickets.denominadorPct > 0
      ? { valor: fmtPct(tickets.pct, 2), hint: operacionProsa(tickets), tono: "" as const }
      : { valor: "Sin medir", hint: operacionProsa(tickets), tono: "aviso" as const };

  const avanceRemediacion = !matriz
    ? { valor: "—", hint: "Falta la matriz de mejoras para medir el avance de remediación.", tono: "aviso" as const }
    : {
      valor: fmtPct(matriz.avance, 0),
      hint: `Avance promedio de remediación de la matriz de mejoras. ${fmtNum(matriz.cerrados)} de `
        + `${fmtNum(matriz.n)} recomendación(es) cerrada(s) al 100%.`,
      tono: "" as const,
    };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Resumen de la reunión
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi label="Optimización" valor={optimizacion.valor} hint={optimizacion.hint} tono={optimizacion.tono} />
          <Kpi label="Opex" valor={opexTarjeta.valor} hint={opexTarjeta.hint} tono={opexTarjeta.tono} />
          <Kpi label="Operación" valor={operacion.valor} hint={operacion.hint} tono={operacion.tono} />
          <Kpi label="Avance de remediación" valor={avanceRemediacion.valor} hint={avanceRemediacion.hint} tono={avanceRemediacion.tono} />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Dato label="Cliente">{meta.cliente}</Dato>
          <Dato label="Período">{meta.periodo}</Dato>
          <Dato label="Fecha de corte">
            {fmtDateOnly(meta.corte)}
            <span className="ml-1 text-xs text-muted-foreground">(congelada en el cálculo)</span>
          </Dato>
          <Dato label="Origen de los permisos">
            {meta.rbacOrigen === "base" ? "Revisión de accesos"
              : meta.rbacOrigen === "archivo" ? "Archivo subido"
                : <span className="text-muted-foreground">Sin insumo de permisos</span>}
          </Dato>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {SECCIONES.map((s) => (
          <button key={s.clave} type="button" onClick={() => setSeccion(s.clave)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${seccion === s.clave
              ? "border-primary font-medium text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {seccion === "ejecutado" && (ejecutado
        ? <SeccionEjecutado ej={ejecutado} />
        : <BloqueAusente titulo="Ejecutado"
          motivo="No hay registro de acciones ejecutadas para este cliente: se arma del barrido de optimización, de la matriz de mejoras y de las reservas. No es que no se haya ejecutado nada." />)}

      {seccion === "consumo" && (
        <div className="space-y-8">
          {modelo.fact
            ? <SeccionConsumo fact={modelo.fact} catSerie={modelo.catSerie} />
            : <BloqueAusente titulo="Consumo"
              motivo="No hay facturación en el rango pedido: o el insumo BITCOST no está cargado, o ninguna de sus filas cae en este período. No es un gasto de cero." />}
          <VariacionConsumo
            variacion={variacion}
            fase={faseReservas}
            error={errorReservas}
            motivoFase1={modelo.fact?.variacionConsumo?.reservas.motivo ?? null}
            onReintentar={onReintentarReservas}
          />
        </div>
      )}

      {seccion === "operacion" && (tickets
        ? <SeccionOperacion t={tickets} />
        : <BloqueAusente titulo="Operación"
          motivo="Sin casos de la mesa de servicio en el período: o el insumo no está cargado, o ninguno de sus casos cae en este rango. No es una mesa sin trabajo." />)}

      {seccion === "seguridad" && (modelo.rbac
        ? <SeccionSeguridad rb={modelo.rbac} origen={meta.rbacOrigen} />
        : <BloqueAusente titulo="Seguridad"
          motivo="Sin insumo de permisos: ni la Revisión de accesos ni un archivo subido tienen filas para este cliente. No es un cliente sin permisos asignados." />)}

      {seccion === "postura" && (modelo.advisor
        ? <SeccionPostura ad={modelo.advisor} corte={fmtDateOnly(meta.corte)} opex={opex} />
        : <BloqueAusente titulo="Postura"
          motivo="Sin recomendaciones de Advisor para este cliente. Puede ser que la sincronización todavía no haya corrido: no equivale a una postura perfecta." />)}

      {seccion === "cronologia" && (cronologia
        ? <SeccionCronologia cr={cronologia} />
        : <BloqueAusente titulo="Cronología"
          motivo="La bitácora de la matriz de mejoras no tiene hitos publicables para este cliente." />)}

      {seccion === "roadmap" && (matriz
        ? <SeccionRoadmap mz={matriz} />
        : <BloqueAusente titulo="Roadmap"
          motivo="La matriz Well-Architected de este cliente no tiene hallazgos cargados. No es un roadmap terminado." />)}

      <section className="space-y-2">
        <h3 className="text-base font-semibold">Cobertura del informe</h3>
        <p className="max-w-3xl text-xs text-muted-foreground">
          Las {fmtNum(meta.cobertura.total)} suscripción(es) que ve al menos una de las tres fuentes.
          Es la unión, no la intersección: una suscripción que solo aparece en una fuente sigue
          contando, con esa única fuente marcada.
        </p>
        <SimpleTable cols={colsCobertura} rows={meta.cobertura.suscripciones}
          empty="Ninguna de las tres fuentes reporta suscripciones para este cliente." />
      </section>
    </div>
  );
}
