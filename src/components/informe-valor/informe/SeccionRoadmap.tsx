import ReportBars from "@/components/reports/ReportBars";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import { REPORT_COLORS } from "@/lib/report";
import { fmtNum, fmtPct } from "@/lib/informeValor";
import { fmtDateOnly } from "@/lib/dates";
import type { InformeRoadmap, InformeRoadmapAmbito, InformeRoadmapItem } from "@/types";
import { Aviso, Cifra, Kpi, Recorte, Seccion, SinMedir } from "./Piezas";

/** Tope de filas de la tabla de hallazgos. Va con <Recorte>, nunca en silencio. */
const TOPE_FILAS = 50;

const MOTIVO_HORAS = "El esfuerzo de la matriz todavía es texto libre y nadie lo parsea: la columna "
  + "de horas llega en la entrega 4. Publicar 0 h afirmaría que cerrar el roadmap no cuesta trabajo.";

/**
 * Bloque de roadmap (`matriz`): hallazgos de la matriz Well-Architected.
 *
 * Las horas pendientes salen `null` mientras el esfuerzo no esté medido, y también cuando falta el
 * dato de alguno de los ítems sin iniciar: una suma parcial pareciendo el total es peor que no
 * publicar la suma.
 */
export default function SeccionRoadmap({ mz }: { mz: InformeRoadmap }) {
  const cols: SimpleCol<InformeRoadmapItem>[] = [
    { key: "a", label: "Ámbito", render: (i) => i.a },
    { key: "t", label: "Hallazgo", render: (i) => i.t },
    { key: "p", label: "Prioridad", render: (i) => i.p ?? "" },
    { key: "i", label: "Impacto", align: "right", render: (i) => fmtNum(i.i) },
    { key: "v", label: "Avance", align: "right", render: (i) => fmtPct(i.v, 0) },
    {
      key: "e", label: "Esfuerzo", align: "right",
      render: (i) => <Cifra valor={i.e} formato={(n) => `${n} h`} motivoSinMedir={MOTIVO_HORAS} etiquetaSinMedir="Sin medir" />,
    },
    { key: "f", label: "Desde", render: (i) => (i.f ? fmtDateOnly(i.f) : "") },
    { key: "n", label: "Recomendaciones", align: "right", render: (i) => fmtNum(i.n) },
  ];

  return (
    <div className="space-y-8">
      <Seccion
        titulo="Roadmap de mejoras"
        descripcion="Hallazgos de la matriz Well-Architected del cliente, agrupados por pilar."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Kpi label="Hallazgos" valor={fmtNum(mz.n)} tono="neutro" />
          <Kpi label="Cerrados" valor={fmtNum(mz.cerrados)} tono="bueno" />
          <Kpi label="En curso" valor={fmtNum(mz.curso)} tono="neutro" />
          <Kpi label="Sin iniciar" valor={fmtNum(mz.sinIniciar)} tono={mz.sinIniciar > 0 ? "aviso" : "neutro"} />
          <Kpi
            label="Horas pendientes"
            valor={<Cifra valor={mz.horas} formato={(n) => `${n} h`} motivoSinMedir={MOTIVO_HORAS} />}
            hint={mz.horas === null ? "El esfuerzo no está medido" : "Para cerrar los hallazgos sin iniciar"}
            tono="neutro"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ReportBars title="Hallazgos por ámbito" color={REPORT_COLORS.greenDark}
            data={mz.amb.map((a) => ({ name: a.n, value: a.c }))} />
          <ReportBars title="Avance promedio por ámbito (%)" color={REPORT_COLORS.gold} unit="%"
            data={mz.amb.map((a) => ({ name: a.n, value: a.av }))} />
        </div>
        {/* Hallazgos y recomendaciones asociadas son dos cifras distintas por ámbito. Van las dos, en
            columnas propias: un gráfico solo puede llevar una y el rótulo de una describiendo a la
            otra es el defecto que este módulo ya pagó una vez. */}
        <SimpleTable
          cols={[
            { key: "n", label: "Ámbito", render: (a: InformeRoadmapAmbito) => a.n },
            { key: "c", label: "Hallazgos", align: "right", render: (a) => fmtNum(a.c) },
            { key: "rec", label: "Recomendaciones de Advisor", align: "right", render: (a) => fmtNum(a.rec) },
            { key: "av", label: "Avance", align: "right", render: (a) => fmtPct(a.av, 0) },
          ]}
          rows={mz.amb}
          empty="La matriz no agrupa hallazgos en ningún ámbito."
        />
        <p className="text-sm">
          Avance promedio del roadmap: <strong className="tabular-nums">{fmtPct(mz.avance, 0)}</strong>.
        </p>
        {mz.horas === null && mz.sinIniciar > 0 && (
          <Aviso>
            Quedan {fmtNum(mz.sinIniciar)} hallazgo(s) sin iniciar y el esfuerzo no está medido, así que
            el roadmap sale sin horas pendientes. <SinMedir motivo={MOTIVO_HORAS} etiqueta="Por qué" />
          </Aviso>
        )}
      </Seccion>

      <Seccion titulo="Hallazgos priorizados">
        <SimpleTable cols={cols} rows={mz.items.slice(0, TOPE_FILAS)}
          empty="La matriz de este cliente no tiene hallazgos." />
        <Recorte mostradas={TOPE_FILAS} total={mz.items.length} que="hallazgos" />
      </Seccion>
    </div>
  );
}
