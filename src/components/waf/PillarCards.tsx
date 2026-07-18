import { Check } from "lucide-react";
import type { WafSection, WafScoreHistory } from "@/types";
import { pillarIcon, scoreColor, computePillarAvance, AZURE_BLUE } from "@/lib/waf";
import { pillarSeries, reconciledAxis, reconcilePillarSeries } from "@/lib/scoreHistory";
import PillarSparkline from "@/components/waf/PillarSparkline";

export default function PillarCards({ sections, activePillar, onPick, scores, history }: {
  sections: WafSection[];
  activePillar: number | null;
  onPick: (pillar: number | null) => void;
  scores: Record<number, number> | null;
  history?: WafScoreHistory | null;
}) {
  // Si algún pilar tiene recomendaciones, los pilares vacíos significan "todo aplicado".
  const matrixPopulated = sections.some((x) => x.total_recs > 0);
  // Eje del sparkline reconciliado con el score en vivo: el gráfico cierra en el mismo valor que
  // el headline (evita que la tarjeta muestre 84% al lado de un histórico que termina en 76%).
  // Etiquetas y `appendCurrent` son iguales para todos los pilares (mismas fechas); el valor vivo
  // se aplica por pilar más abajo.
  const { labels, appendCurrent } = reconciledAxis(history ?? null, new Date());
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {sections.map((s) => {
        const active = activePillar === s.section_num;
        const score = scores ? scores[s.section_num] : undefined;
        const avance = computePillarAvance(s.total_recs, s.avg_progress, matrixPopulated);
        return (
          <button
            key={s.section_num}
            type="button"
            onClick={() => onPick(active ? null : s.section_num)}
            aria-pressed={active}
            className={`text-left rounded-xl border p-3 flex flex-col gap-2 transition-colors hover:bg-accent ${active ? "border-primary ring-1 ring-primary" : "border-border bg-card"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <img src={pillarIcon(s.section_num)} alt="" aria-hidden className="w-7 h-7 object-contain" />
              {s.high_recs > 0 && (
                <span className="text-[11px] font-medium text-red-600 dark:text-red-400">{s.high_recs} High</span>
              )}
            </div>
            <div className="text-sm font-medium leading-snug min-h-[2.5rem]">{s.section_name}</div>
            {score != null && (
              <>
                {/* Barra lateral de altura constante (solo Score + %), estilo Azure Advisor. */}
                <div className="pl-2.5 border-l-[3px]" style={{ borderColor: scoreColor(score) }}>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Score</div>
                  <div className="text-xl font-bold tabular-nums leading-tight">{score}%</div>
                </div>
                {s.total_recs === 0 && (
                  <div className="text-[11px] text-[#5a7016] dark:text-[#a9c46a] inline-flex items-center gap-1"><Check className="w-3 h-3" />Estás siguiendo todas las recomendaciones</div>
                )}
              </>
            )}
            {/* Bloque de métricas anclado al fondo: alinea número/recursos/barra/avance entre tarjetas. */}
            <div className="mt-auto flex flex-col gap-2 pt-1">
              <div className="text-2xl font-bold tabular-nums">{s.total_recs}</div>
              <div className="text-[11px] text-muted-foreground">
                {s.total_recs === 1 ? "recomendación" : "recomendaciones"} · {s.total_resources} {s.total_resources === 1 ? "recurso" : "recursos"}
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <span className="block h-full rounded-full" style={{ width: `${avance}%`, background: AZURE_BLUE }} />
              </div>
              <div className="text-[11px] text-muted-foreground">avance {avance}%</div>
              {score != null && <PillarSparkline values={reconcilePillarSeries(pillarSeries(history ?? null, s.section_num), score, appendCurrent)} labels={labels} color={scoreColor(score)} />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
