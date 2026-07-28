import { useState } from "react";
import { Check, ShieldCheck, Info } from "lucide-react";
import type { WafSection, WafScoreHistory } from "@/types";
import { pillarIcon, scoreColor, computePillarAvance, AZURE_BLUE } from "@/lib/waf";
import { pillarSeries, reconciledAxis, reconcilePillarSeries } from "@/lib/scoreHistory";
import PillarSparkline from "@/components/waf/PillarSparkline";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/** El histórico es por cliente: no existe serie por suscripción, así que con filtro se atenúa. */
const HISTORY_NOT_FILTERED = "El histórico es del cliente completo: no refleja el filtro de suscripciones.";

export default function PillarCards({
  sections, activePillar, onPick, scores, history,
  subscriptionFilterActive = false, scoreFiltered = true,
}: {
  sections: WafSection[];
  activePillar: number | null;
  onPick: (pillar: number | null) => void;
  scores: Record<number, number> | null;
  history?: WafScoreHistory | null;
  subscriptionFilterActive?: boolean;
  /** false = el snapshot no tiene breakdown por suscripción y el score sigue siendo el global. */
  scoreFiltered?: boolean;
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
        // Pilar gestionado externamente (Gestión de Vulnerabilidades): tarjeta no interactiva con
        // score + nota + diálogo, sin conteo (filtrar por él daría tabla vacía).
        if (s.managed_externally) {
          return (
            <ManagedSecurityCard key={s.section_num} section={s} score={score}
              history={history} labels={labels} appendCurrent={appendCurrent} />
          );
        }
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
                {subscriptionFilterActive && !scoreFiltered && (
                  <div className="text-[11px] text-muted-foreground">Score del cliente completo (sin detalle por suscripción)</div>
                )}
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
              {score != null && (
                <span className={subscriptionFilterActive ? "opacity-40" : undefined}
                  title={subscriptionFilterActive ? HISTORY_NOT_FILTERED : undefined}>
                  <PillarSparkline values={reconcilePillarSeries(pillarSeries(history ?? null, s.section_num), score, appendCurrent)} labels={labels} color={scoreColor(score)} />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Tarjeta del pilar cuya seguridad se gestiona externamente: score + nota + diálogo (sin conteo). */
function ManagedSecurityCard({ section: s, score, history, labels, appendCurrent }: {
  section: WafSection;
  score: number | undefined;
  history?: WafScoreHistory | null;
  labels: string[];
  appendCurrent: boolean;
}) {
  const [open, setOpen] = useState(false);
  const note = s.managed_note || "La seguridad de este cliente se gestiona externamente.";
  return (
    <div className="text-left rounded-xl border p-3 flex flex-col gap-2 border-border bg-card">
      <div className="flex items-start justify-between gap-2">
        <img src={pillarIcon(s.section_num)} alt="" aria-hidden className="w-7 h-7 object-contain" />
      </div>
      <div className="text-sm font-medium leading-snug min-h-[2.5rem]">{s.section_name}</div>
      {score != null && (
        <div className="pl-2.5 border-l-[3px]" style={{ borderColor: scoreColor(score) }}>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Score</div>
          <div className="text-xl font-bold tabular-nums leading-tight">{score}%</div>
        </div>
      )}
      <div className="mt-auto flex flex-col gap-2 pt-1">
        <div className="text-[11px] text-muted-foreground inline-flex items-start gap-1">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#5a7016] dark:text-[#a9c46a]" />
          <span>{note}</span>
        </div>
        <button type="button" onClick={() => setOpen(true)} aria-label="Detalle de seguridad gestionada"
          className="self-start text-[11px] inline-flex items-center gap-1 text-primary hover:underline">
          <Info className="w-3 h-3" /> ¿Por qué?
        </button>
        {score != null && (
          <PillarSparkline values={reconcilePillarSeries(pillarSeries(history ?? null, s.section_num), score, appendCurrent)} labels={labels} color={scoreColor(score)} />
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seguridad gestionada por otro servicio</DialogTitle>
            <DialogDescription>
              Las recomendaciones de seguridad de este cliente no se listan aquí porque se atienden
              mediante el servicio de Gestión de Vulnerabilidades. El puntaje (score) del pilar se
              mantiene como referencia.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{note}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
