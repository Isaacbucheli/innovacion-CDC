import type { Scenario } from "@/types";
import { bestScenario, formatMoney, formatPct } from "@/lib/costs";
import GrowBar from "@/components/costs/GrowBar";

export default function ScenarioCards({ scenarios }: { scenarios: Scenario[] }) {
  if (!scenarios.length) {
    return (
      <p className="text-sm text-muted-foreground py-12 text-center">
        Sin escenarios calculados. Use “Calcular costos” para generarlos.
      </p>
    );
  }
  const ordered = [...scenarios].sort((a, b) => a.number - b.number);
  const best = bestScenario(scenarios);
  const maxPct = Math.max(...scenarios.map((s) => s.savings_pct || 0), 0.0001);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {ordered.map((s) => {
        const isBest = best?.scenario_id === s.scenario_id;
        return (
          <article
            key={s.scenario_id}
            className={`relative rounded-xl border p-5 flex flex-col transition-shadow hover:shadow-md ${
              isBest ? "border-[#A3C243] ring-1 ring-[#A3C243]" : ""
            }`}
          >
            {isBest && (
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wide bg-[#A3C243] text-white rounded-full px-2 py-0.5">
                Mejor
              </span>
            )}
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Escenario {s.number}
            </div>
            <div className="font-semibold leading-snug mt-1 pr-12">{s.name}</div>
            {s.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{s.description}</p>}
            <div className="mt-4 pt-3 border-t">
              <div className="text-xs text-muted-foreground">Total mensual</div>
              <div className="text-2xl font-bold tabular-nums tracking-tight">{formatMoney(s.total_monthly)}</div>
              <div className="text-sm font-semibold text-[#5a7016] mt-1">
                Ahorro {formatMoney(s.savings_monthly)}
                {s.savings_pct ? ` · ${formatPct(s.savings_pct)}` : ""}
              </div>
              <GrowBar pct={(Math.max(0, s.savings_pct) / maxPct) * 100} height="h-1.5" className="mt-3" />
            </div>
          </article>
        );
      })}
    </div>
  );
}
