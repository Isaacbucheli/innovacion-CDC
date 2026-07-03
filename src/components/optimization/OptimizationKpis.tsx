import type { ReactNode } from "react";
import { DollarSign, ListChecks, Layers, CalendarClock } from "lucide-react";
import { formatMoney } from "@/lib/costs";
import { useCountUp } from "@/lib/useCountUp";
import type { OptKpis } from "@/lib/optimization";
import type { OptScan } from "@/types";

function Card({ accent, icon, label, value, sub }: {
  accent?: boolean; icon: ReactNode; label: string; value: ReactNode; sub?: string;
}) {
  return (
    <div className={`rounded-xl border p-5 transition-shadow hover:shadow-md ${accent ? "bg-[#A3C243]/10 border-transparent" : "bg-background"}`}>
      <div className={`w-9 h-9 rounded-lg grid place-items-center mb-3 text-[#5a7016] dark:text-[#a9c46a] ${accent ? "bg-background/70" : "bg-secondary"}`}>
        {icon}
      </div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums tracking-tight mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{sub}</div>}
    </div>
  );
}

function MoneyValue({ n }: { n: number }) {
  return <>{formatMoney(useCountUp(n))}</>;
}
function NumValue({ n }: { n: number }) {
  return <>{useCountUp(n).toLocaleString("en-US")}</>;
}

function scanStatusLabel(scan: OptScan | null): string {
  if (!scan) return "Sin barridos aún.";
  const estado = scan.status === "completed" ? "completado" : scan.status === "running" ? "en curso" : "con error";
  return `Barrido ${estado}.`;
}

export default function OptimizationKpis({ kpis, latestScan }: { kpis: OptKpis; latestScan: OptScan | null }) {
  const { high, medium, low } = kpis.severity;
  const when = latestScan ? new Date(latestScan.finished_at ?? latestScan.started_at) : null;
  const whenLabel = when && !Number.isNaN(when.getTime())
    ? when.toLocaleDateString("es-EC", { dateStyle: "medium" })
    : "—";
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card
        accent
        icon={<DollarSign className="w-[18px] h-[18px]" />}
        label="Ahorro mensual estimado"
        value={<MoneyValue n={kpis.totalSavings} />}
        sub="Suma de hallazgos con costo evitable."
      />
      <Card
        icon={<ListChecks className="w-[18px] h-[18px]" />}
        label="Hallazgos"
        value={<NumValue n={kpis.count} />}
        sub={`🔴 ${high} alta · 🟠 ${medium} media · ⚪ ${low} baja`}
      />
      <Card
        icon={<Layers className="w-[18px] h-[18px]" />}
        label="Suscripciones analizadas"
        value={<NumValue n={latestScan?.subscriptions_scanned ?? 0} />}
        sub="Solo administradas y activas."
      />
      <Card
        icon={<CalendarClock className="w-[18px] h-[18px]" />}
        label="Último barrido"
        value={<span className="text-xl">{whenLabel}</span>}
        sub={scanStatusLabel(latestScan)}
      />
    </div>
  );
}
