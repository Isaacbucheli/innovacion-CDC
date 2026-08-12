import ReportBars from "@/components/reports/ReportBars";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import { REPORT_COLORS } from "@/lib/report";
import { MOTIVO_SIN_AHORRO_ADVISOR, fmtMonto, fmtNum, fmtPct, num, txt } from "@/lib/informeValor";
import type {
  FilaInforme, InformePostura, InformePosturaLineaAhorro, InformePosturaPilar, InformePosturaRetiro,
} from "@/types";
import { Aviso, Kpi, Recorte, Seccion, SinMedir } from "./Piezas";

/** Tope de filas del backlog desagregado. Va con <Recorte>, nunca en silencio. */
const TOPE_FILAS = 50;

// El motivo vive en lib/informeValor: la pestaña de entrega publica el mismo texto para el mismo
// vacío, y dos redacciones del mismo hueco son dos definiciones del mismo concepto.
const MOTIVO_SIN_AHORRO = MOTIVO_SIN_AHORRO_ADVISOR;

/**
 * Bloque de postura (`advisor`): recomendaciones de Azure Advisor y retiros de Azure.
 *
 * Dos ceros que acá no se dejan pasar como cifras:
 *
 * - Con `nSav` en cero no hay ninguna recomendación con ahorro cuantificado, así que el ahorro
 *   bruto, el realizable y el descartado salen en cero por falta de dato, no por falta de ahorro.
 * - Un pilar de Seguridad vacío puede ser un cliente sin hallazgos o un cliente que gestiona su
 *   seguridad por fuera y cuyos hallazgos ya se excluyeron. El modelo trae la bandera y la nota:
 *   se muestran.
 */
export default function SeccionPostura({ ad, corte }: { ad: InformePostura; corte: string }) {
  const sinAhorroCuantificado = ad.nSav === 0;

  const colsLineas: SimpleCol<InformePosturaLineaAhorro>[] = [
    { key: "rec", label: "Recomendación", render: (l) => l.rec },
    { key: "sub", label: "Suscripción", render: (l) => l.sub },
    { key: "tipo", label: "Tipo", render: (l) => l.tipo },
    { key: "monto", label: "Ahorro anual", align: "right", render: (l) => fmtMonto(l.monto) },
    {
      key: "contada", label: "¿Suma al realizable?",
      render: (l) => (l.contada
        ? <span className="text-primary">Sí</span>
        : <span className="text-muted-foreground" title="Reserva y savings plan no se pueden comprar sobre el mismo cómputo: de las dos se toma la mayor.">No, excluyente</span>),
    },
  ];

  // El desglose de impacto por pilar (`h`/`m`/`l`) es lo que decide por dónde empezar, y es lo que el
  // artefacto dibuja como barra segmentada. Un gráfico de barras simple acá solo lleva el total.
  const colsPilares: SimpleCol<InformePosturaPilar>[] = [
    { key: "n", label: "Pilar", render: (c) => c.n },
    { key: "c", label: "Recomendaciones", align: "right", render: (c) => fmtNum(c.c) },
    {
      key: "h", label: "Alto", align: "right",
      render: (c) => (c.h > 0 ? <span className="text-red-700 dark:text-red-400">{fmtNum(c.h)}</span> : "—"),
    },
    { key: "m", label: "Medio", align: "right", render: (c) => (c.m > 0 ? fmtNum(c.m) : "—") },
    { key: "l", label: "Bajo", align: "right", render: (c) => (c.l > 0 ? fmtNum(c.l) : "—") },
  ];

  const colsRetiros: SimpleCol<InformePosturaRetiro>[] = [
    { key: "f", label: "Característica", render: (r) => r.f },
    { key: "d", label: "Fecha de retiro", render: (r) => r.d ?? <SinMedir motivo="El anuncio no trae fecha de retiro." etiqueta="Sin fecha" /> },
    { key: "c", label: "Recursos", align: "right", render: (r) => fmtNum(r.c) },
    {
      key: "est", label: "Situación",
      render: (r) => (
        <span className={r.vencido ? "text-red-700 dark:text-red-400" : r.proximoATresMeses ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>
          {r.est}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <Seccion
        titulo="Postura: recomendaciones de Advisor"
        descripcion={`${fmtNum(ad.tipos_rec)} tipo(s) de recomendación sobre ${fmtNum(ad.nRes)} recurso(s) evaluado(s).`}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Recomendaciones activas" valor={fmtNum(ad.n)} tono="neutro" />
          <Kpi label="Impacto alto" valor={fmtNum(ad.high)} tono={ad.high > 0 ? "malo" : "neutro"} />
          <Kpi label="Impacto medio" valor={fmtNum(ad.medium)} tono="neutro" />
          <Kpi label="Impacto bajo" valor={fmtNum(ad.low)} tono="neutro" />
          <Kpi label="Recursos evaluados" valor={fmtNum(ad.nRes)}
            hint={ad.nRes > 0
              ? `${(ad.recomendacionesConRecurso / ad.nRes).toFixed(1)} recomendaciones por recurso`
              : "Ninguna recomendación trae recurso identificado"}
            tono="neutro" />
          <Kpi label="Retiros de Azure" valor={fmtNum(ad.rets.length)}
            hint={`${fmtNum(ad.vencidos)} vencido(s) · ${fmtNum(ad.proximos)} a menos de 3 meses`}
            tono={ad.vencidos > 0 ? "malo" : ad.proximos > 0 ? "aviso" : "neutro"} />
          <Kpi label="Concentración del backlog"
            valor={ad.n > 0 ? fmtPct((ad.topSum / ad.n) * 100) : <SinMedir motivo="Sin recomendaciones activas no hay backlog que concentrar." />}
            hint={`Las 15 recomendaciones más repetidas suman ${fmtNum(ad.topSum)} de ${fmtNum(ad.n)}: son 15 decisiones de estándar, no ${fmtNum(ad.topSum)} tareas sueltas`}
            tono="neutro" />
        </div>

        {ad.seguridadGestionadaExternamente && (
          <Aviso tono="info">
            {ad.seguridadGestionadaNota ?? "Este cliente gestiona su seguridad por fuera de la plataforma."}
            {" "}Las recomendaciones del pilar de Seguridad quedaron excluidas a propósito: el conteo de
            este bloque no las incluye.
          </Aviso>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ReportBars title="Recomendaciones por pilar" color={REPORT_COLORS.greenDark}
            data={ad.cats.map((c) => ({ name: c.n, value: c.c }))} />
          <ReportBars title="Recomendaciones por tipo de recurso" color={REPORT_COLORS.muted}
            data={ad.tipos.slice(0, 12).map((tp) => ({ name: tp.n, value: tp.c }))} />
        </div>
        <SimpleTable cols={colsPilares} rows={ad.cats}
          empty="Sin recomendaciones agrupadas por pilar." />
      </Seccion>

      <Seccion
        titulo="Ahorro identificado por Advisor"
        bloque="ahorroAdvisor"
        descripcion="El realizable sale de depurar duplicados y de quedarse con la mayor entre reserva y savings plan de la misma suscripción: no se pueden comprar las dos sobre el mismo cómputo."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            label="Ahorro realizable"
            valor={sinAhorroCuantificado ? <SinMedir motivo={MOTIVO_SIN_AHORRO} /> : fmtMonto(ad.real)}
            hint="Anual, tras depurar duplicados y opciones excluyentes"
          />
          <Kpi
            label="Ahorro bruto"
            valor={sinAhorroCuantificado ? <SinMedir motivo={MOTIVO_SIN_AHORRO} /> : fmtMonto(ad.bruto)}
            hint="Suma de todas las líneas, sin depurar" tono="neutro"
          />
          <Kpi
            label="Descartado"
            valor={sinAhorroCuantificado ? <SinMedir motivo={MOTIVO_SIN_AHORRO} /> : fmtMonto(ad.descarte)}
            hint="La diferencia entre bruto y realizable, con nombre propio" tono="neutro"
          />
          <Kpi label="Líneas con ahorro cuantificado" valor={fmtNum(ad.nSav)}
            hint={`De ${fmtNum(ad.n)} recomendación(es) activas`} tono={sinAhorroCuantificado ? "aviso" : "neutro"} />
        </div>

        {sinAhorroCuantificado && (
          <Aviso>{MOTIVO_SIN_AHORRO}</Aviso>
        )}

        <SimpleTable cols={colsLineas} rows={ad.savLineas}
          empty="Ninguna recomendación de este cliente trae ahorro anual cuantificado." />
        <p className="text-xs text-muted-foreground">
          Las filas de la tabla suman el ahorro realizable, no el bruto: el bruto se explica aparte,
          arriba, para que las líneas visibles siempre sumen la cifra que tienen al pie.
        </p>
      </Seccion>

      <Seccion titulo="Retiros de Azure"
        descripcion={`Clasificados contra la fecha de corte del informe (${corte}), no contra la fecha en que alguien abra este informe.`}>
        <SimpleTable cols={colsRetiros} rows={ad.rets} empty="Ningún retiro de Azure alcanza a este cliente." />
      </Seccion>

      <Seccion titulo="Recomendaciones principales">
        <SimpleTable
          cols={[
            { key: "rec", label: "Recomendación", render: (r: FilaInforme) => txt(r[0]) },
            { key: "pilar", label: "Pilar", render: (r) => txt(r[1]) },
            { key: "imp", label: "Impacto", render: (r) => txt(r[2]) },
            { key: "n", label: "Recursos", align: "right", render: (r) => fmtNum(num(r[3])) },
          ]}
          rows={ad.top}
          empty="Sin recomendaciones activas."
        />
      </Seccion>

      <Seccion titulo="Backlog desagregado por suscripción"
        descripcion="Las mismas recomendaciones abiertas por suscripción: es la tabla que el informe entregado deja explorar con filtros.">
        <SimpleTable
          cols={[
            { key: "rec", label: "Recomendación", render: (r: FilaInforme) => txt(r[0]) },
            { key: "pilar", label: "Pilar", render: (r) => txt(r[1]) },
            { key: "imp", label: "Impacto", render: (r) => txt(r[2]) },
            { key: "sub", label: "Suscripción", render: (r) => txt(r[3]) },
            { key: "n", label: "Recursos", align: "right", render: (r) => fmtNum(num(r[4])) },
          ]}
          rows={ad.det.slice(0, TOPE_FILAS)}
          empty="Sin recomendaciones activas."
        />
        <Recorte mostradas={TOPE_FILAS} total={ad.det.length} que="filas de recomendación por suscripción" />
      </Seccion>
    </div>
  );
}
