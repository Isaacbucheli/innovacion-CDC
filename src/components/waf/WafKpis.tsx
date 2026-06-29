import { ClipboardList, CloudDownload, Layers } from "lucide-react";
import { useCountUp } from "@/lib/useCountUp";
import { AZURE_BLUE } from "@/lib/waf";
import type { WafSummary } from "@/types";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-9 h-9 rounded-lg grid place-items-center mb-2 bg-secondary text-muted-foreground">
      {children}
    </div>
  );
}

/** Tarjeta de conteo con icono en chip y número animado (count-up). */
function CountCard({ icon, label, value, sub, subClass }: {
  icon: React.ReactNode; label: string; value: number; sub?: string; subClass?: string;
}) {
  const n = useCountUp(value);
  return (
    <div className="rounded-xl border bg-background p-5 transition-shadow hover:shadow-md">
      <Chip>{icon}</Chip>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums tracking-tight mt-1">{n}</div>
      {sub && <div className={`text-[11px] mt-1 ${subClass ?? "text-muted-foreground"}`}>{sub}</div>}
    </div>
  );
}

/** Métrica principal: avance promedio como anillo de progreso (azul Azure), tarjeta de acento. */
function AvanceRing({ pct }: { pct: number }) {
  const n = useCountUp(pct);
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, n)) / 100);
  return (
    <div className="rounded-xl border border-transparent bg-[#A3C243]/10 p-5 transition-shadow hover:shadow-md flex items-center gap-4">
      <div className="relative w-16 h-16 shrink-0">
        <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-secondary" />
          <circle cx="32" cy="32" r={r} fill="none" stroke={AZURE_BLUE} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={offset} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums">{n}%</div>
      </div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Avance promedio</div>
        <div className="text-[11px] text-muted-foreground mt-1">de remediación</div>
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
        icon={<ClipboardList className="w-5 h-5" />}
        label="Recomendaciones activas"
        value={summary?.active_recommendations ?? 0}
        sub={highImpact > 0 ? `${highImpact} de alto impacto` : undefined}
        subClass="text-red-600 dark:text-red-400 font-medium"
      />
      <CountCard
        icon={<Layers className="w-5 h-5" />}
        label="Recursos afectados"
        value={summary?.active_findings ?? 0}
      />
      <AvanceRing pct={avgProgress} />
      <div className="rounded-xl border bg-background p-5 transition-shadow hover:shadow-md">
        <Chip><CloudDownload className="w-5 h-5" /></Chip>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Última ingesta</div>
        <div className="text-lg font-bold tracking-tight mt-1">{ingLabel}</div>
        <div className="text-[11px] text-muted-foreground mt-1">{ingSub}</div>
      </div>
    </div>
  );
}
