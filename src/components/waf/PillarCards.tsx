import type { WafSection } from "@/types";
import { pillarColor } from "@/lib/waf";

export default function PillarCards({ sections, activePillar, onPick }: {
  sections: WafSection[];
  activePillar: number | null;
  onPick: (pillar: number | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {sections.map((s) => {
        const active = activePillar === s.section_num;
        const color = pillarColor(s.section_num);
        return (
          <button
            key={s.section_num}
            type="button"
            onClick={() => onPick(active ? null : s.section_num)}
            aria-pressed={active}
            className={`text-left rounded-xl border p-3 flex flex-col gap-2 transition-colors hover:bg-accent ${active ? "border-primary ring-1 ring-primary" : "border-border bg-card"}`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
              {s.section_name}
            </div>
            <div className="text-2xl font-bold tabular-nums">{s.total_recs}</div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <span className="block h-full rounded-full" style={{ width: `${Math.round(s.avg_progress)}%`, background: color }} />
            </div>
            <div className="text-[11px] text-muted-foreground">{Math.round(s.avg_progress)}% · Alta {s.high_recs}</div>
          </button>
        );
      })}
    </div>
  );
}
