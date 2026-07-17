import { ClipboardList, CloudDownload, Layers } from "lucide-react";
import { useCountUp } from "@/lib/useCountUp";
import { AZURE_BLUE } from "@/lib/waf";
import type { WafSummary } from "@/types";

// Tarjeta KPI compacta: icono a la izquierda, label + valor + subtexto a la derecha (una fila).
function CountCard({ icon, label, value, sub, subClass }: {
  icon: React.ReactNode; label: string; value: number; sub?: string; subClass?: string;
}) {
  const n = useCountUp(value);
  return (
    <div className="rounded-xl border bg-background p-3 flex items-center gap-3 transition-shadow hover:shadow-md">
      <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0 bg-secondary text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground truncate">{label}</div>
        <div className="text-xl font-bold tabular-nums tracking-tight leading-none mt-0.5">{n}</div>
        {sub && <div className={`text-[10px] mt-0.5 truncate ${subClass ?? "text-muted-foreground"}`}>{sub}</div>}
      </div>
    </div>
  );
}

/** Avance promedio como anillo compacto (azul Azure), tarjeta de acento. */
function AvanceRing({ pct }: { pct: number }) {
  const n = useCountUp(pct);
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, n)) / 100);
  return (
    <div className="rounded-xl border border-transparent bg-[#A3C243]/10 p-3 flex items-center gap-3 transition-shadow hover:shadow-md">
      <div className="relative w-11 h-11 shrink-0">
        <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
          <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-secondary" />
          <circle cx="24" cy="24" r={r} fill="none" stroke={AZURE_BLUE} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={offset} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-[11px] font-bold tabular-nums">{n}%</div>
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground truncate">Avance promedio</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">de remediación</div>
      </div>
    </div>
  );
}

export default function WafKpis({ summary, avgProgress, highImpact }: {
  summary: WafSummary | null; avgProgress: number; highImpact: number;
}) {
  const ing = summary?.latest_ingestion;
  const ingLabel = ing?.completed_at ? new Date(ing.completed_at).toLocaleDateString("es-EC") : "—";
  const source = ing?.source_file_name ?? "";
  const ingSub = source ? (/advisor/i.test(source) ? "vía Azure Advisor" : source) : "sin ingestas aún";
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <CountCard
        icon={<ClipboardList className="w-4 h-4" />}
        label="Recomendaciones activas"
        value={summary?.active_recommendations ?? 0}
        sub={highImpact > 0 ? `${highImpact} de alto impacto` : undefined}
        subClass="text-red-600 dark:text-red-400 font-medium"
      />
      <CountCard
        icon={<Layers className="w-4 h-4" />}
        label="Recursos afectados"
        value={summary?.active_findings ?? 0}
      />
      <AvanceRing pct={avgProgress} />
      <div className="rounded-xl border bg-background p-3 flex items-center gap-3 transition-shadow hover:shadow-md">
        <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0 bg-secondary text-muted-foreground">
          <CloudDownload className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground truncate">Última ingesta</div>
          <div className="text-base font-bold tracking-tight leading-none mt-0.5">{ingLabel}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{ingSub}</div>
        </div>
      </div>
    </div>
  );
}
