import type { WafSummary } from "@/types";

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-secondary p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums tracking-tight mt-1">{value}</div>
    </div>
  );
}

export default function WafKpis({ summary }: { summary: WafSummary | null }) {
  const ing = summary?.latest_ingestion;
  const ingLabel = ing?.completed_at ? new Date(ing.completed_at).toLocaleDateString("es-EC") : "—";
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Kpi label="Recomendaciones activas" value={summary?.active_recommendations ?? 0} />
      <Kpi label="Hallazgos activos" value={summary?.active_findings ?? 0} />
      <Kpi label="Recomendaciones de costo" value={summary?.cost_recommendations ?? 0} />
      <Kpi label="Última ingesta" value={ingLabel} />
    </div>
  );
}
