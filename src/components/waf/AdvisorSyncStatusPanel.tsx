import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  humanizeSyncError, overallSyncStatus, subStatusLabel, subStatusTone,
  type SyncStatus, type SyncTone,
} from "@/lib/advisorSyncStatus";
import type { WafIngestionRun } from "@/types";

const TONE_CHIP: Record<SyncTone, string> = {
  ok: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};
const OVERALL_LABEL: Record<SyncStatus, string> = { ok: "Completa", partial: "Parcial", error: "Con problemas" };
const OVERALL_ICON: Record<SyncStatus, typeof CheckCircle2> = { ok: CheckCircle2, partial: Clock, error: AlertTriangle };

function fmtDate(d: string | null | undefined): string { return d ? new Date(d).toLocaleString("es-EC") : "—"; }

/** Deriva un estado sintético desde el string de estado de una corrida (fallback sin detalle). */
function statusToSync(status: string | null): SyncStatus {
  const s = (status ?? "").toLowerCase();
  if (s.includes("fail") || s.includes("error")) return "error";
  if (s.includes("partial") || s.includes("run")) return "partial";
  return "ok";
}

/** Panel compacto con la transparencia del último sync de Advisor del cliente. */
export default function AdvisorSyncStatusPanel({ run }: { run: WafIngestionRun | null }) {
  if (!run) {
    return <p className="text-xs text-muted-foreground">Sin sincronizaciones registradas.</p>;
  }

  const results = run.subscription_results && run.subscription_results.length > 0 ? run.subscription_results : null;
  const overall: SyncStatus = results ? overallSyncStatus(results) : statusToSync(run.status);
  const OverallIcon = OVERALL_ICON[overall];
  const total = results?.length ?? 0;
  const synced = results ? results.filter((r) => r.status !== "error").length : 0;
  const when = run.completed_at ?? run.started_at;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Última sincronización Advisor</h3>
            <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full ${TONE_CHIP[subStatusTone(overall)]}`}>
              <OverallIcon className="w-3.5 h-3.5" /> {OVERALL_LABEL[overall]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmtDate(when)}{run.created_by ? ` · ${run.created_by}` : ""}
          </p>
        </div>
        {results && (
          <div className="text-xs text-muted-foreground self-center">
            <span className="font-semibold text-foreground tabular-nums">{synced} de {total}</span> suscripciones sincronizadas
          </div>
        )}
      </div>

      {results ? (
        <ul className="mt-3 space-y-1.5">
          {results.map((r) => (
            <li key={r.subscription_id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
              <span className={`shrink-0 px-2 py-0.5 rounded-full font-medium ${TONE_CHIP[subStatusTone(r.status)]}`}>
                {subStatusLabel(r.status)}
              </span>
              <span className="font-medium">{r.subscription_name || r.subscription_id}</span>
              {r.status !== "ok" && (
                <span className="text-muted-foreground">— {humanizeSyncError(r.status, r.error)}</span>
              )}
            </li>
          ))}
        </ul>
      ) : run.error_message ? (
        <p className="mt-2 text-xs text-destructive">{run.error_message}</p>
      ) : null}
    </Card>
  );
}
