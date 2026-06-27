import type { ReactNode } from "react";
import { DollarSign, FileSpreadsheet, LayoutGrid, TrendingUp } from "lucide-react";
import type { CostKpis } from "@/lib/costs";
import { formatMoney, formatPct } from "@/lib/costs";
import { useCountUp } from "@/lib/useCountUp";
import GrowBar from "@/components/costs/GrowBar";

function Card({
  accent,
  icon,
  label,
  value,
  sub,
  bar,
}: {
  accent?: boolean;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: string;
  bar?: number;
}) {
  return (
    <div
      className={`rounded-xl border p-5 transition-shadow hover:shadow-md ${
        accent ? "bg-[#A3C243]/10 border-transparent" : "bg-background"
      }`}
    >
      <div className={`w-9 h-9 rounded-lg grid place-items-center mb-3 text-[#5a7016] ${accent ? "bg-white/70" : "bg-secondary"}`}>
        {icon}
      </div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums tracking-tight mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{sub}</div>}
      {bar !== undefined && <GrowBar pct={bar} height="h-1.5" className="mt-3" />}
    </div>
  );
}

function ResourcesValue({ n }: { n: number }) {
  return <>{useCountUp(n).toLocaleString("en-US")}</>;
}

export default function CostsKpis({ kpis }: { kpis: CostKpis }) {
  const best = kpis.best;
  const calcPct = kpis.resources ? (kpis.calculated / kpis.resources) * 100 : 0;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <Card
        icon={<DollarSign className="w-[18px] h-[18px]" />}
        label="Costo mensual PAYG"
        value={formatMoney(kpis.payg)}
        sub="Base calculada con Azure Retail Prices."
      />
      <Card
        accent
        icon={<TrendingUp className="w-[18px] h-[18px]" />}
        label="Mejor ahorro estimado"
        value={best ? formatMoney(best.savings_monthly) : "$0.00"}
        sub={best ? `${best.name || "Mejor escenario"} · ${formatPct(best.savings_pct)}` : "Sin escenarios cargados."}
      />
      <Card
        icon={<LayoutGrid className="w-[18px] h-[18px]" />}
        label="Recursos calculados"
        value={<ResourcesValue n={kpis.resources} />}
        sub={`${kpis.calculated} calculados${kpis.review ? `, ${kpis.review} por revisar` : ""}.`}
        bar={calcPct}
      />
      <Card
        icon={<FileSpreadsheet className="w-[18px] h-[18px]" />}
        label="Plantilla"
        value={<span className="text-xl">Business IT</span>}
        sub="Excel ejecutivo para entregar al cliente."
      />
    </div>
  );
}
