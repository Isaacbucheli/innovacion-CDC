import type { WafSection } from "@/types";
import { pillarColor, pillarIcon, scoreClass } from "@/lib/waf";

export default function PillarCards({ sections, activePillar, onPick, scores }: {
  sections: WafSection[];
  activePillar: number | null;
  onPick: (pillar: number | null) => void;
  scores: Record<number, number> | null;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {sections.map((s) => {
        const active = activePillar === s.section_num;
        const color = pillarColor(s.section_num);
        const score = scores ? scores[s.section_num] : undefined;
        const avance = Math.round(s.avg_progress);
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
            <div className="text-sm font-medium leading-snug">{s.section_name}</div>
            {score != null && (
              <div className="pl-2 border-l-2" style={{ borderColor: color }}>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Score</div>
                <div className={`text-xl font-bold tabular-nums ${scoreClass(score)}`}>{score}%</div>
              </div>
            )}
            <div className="text-2xl font-bold tabular-nums">{s.total_recs}</div>
            <div className="text-[11px] text-muted-foreground">
              {s.total_recs === 1 ? "recomendación" : "recomendaciones"} · {s.total_resources} {s.total_resources === 1 ? "recurso" : "recursos"}
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <span className="block h-full rounded-full" style={{ width: `${avance}%`, background: color }} />
            </div>
            <div className="text-[11px] text-muted-foreground">avance {avance}%</div>
          </button>
        );
      })}
    </div>
  );
}
