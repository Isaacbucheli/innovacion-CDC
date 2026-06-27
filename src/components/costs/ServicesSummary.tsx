import type { CostResult } from "@/types";
import { formatMoney, groupByService } from "@/lib/costs";
import GrowBar from "@/components/costs/GrowBar";

export default function ServicesSummary({ rows }: { rows: CostResult[] }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground py-12 text-center">
        Este cliente aún no tiene costos calculados. Use “Calcular costos” para generarlos.
      </p>
    );
  }
  const groups = groupByService(rows).sort((a, b) => b.payg - a.payg);
  const max = Math.max(...groups.map((g) => g.payg), 1);

  return (
    <div className="rounded-xl border bg-background p-6">
      <h3 className="text-sm font-semibold mb-5">Costo mensual por servicio</h3>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.serviceKey} className="grid grid-cols-[minmax(130px,1.1fr)_2fr_auto] items-center gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <img src={g.icon} alt="" aria-hidden className="w-4 h-4 flex-none" />
              <span className="text-sm truncate">{g.label}</span>
              {g.issues > 0 && (
                <span className="text-[11px] text-amber-700 flex-none whitespace-nowrap">· {g.issues} por revisar</span>
              )}
            </div>
            <GrowBar pct={(g.payg / max) * 100} height="h-2.5" />
            <span className="text-sm font-semibold tabular-nums text-right w-24">{formatMoney(g.payg)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
