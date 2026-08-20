import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import ClientHeader from "@/components/ClientHeader";
import DataTablePagination from "@/components/DataTablePagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePagedRows } from "@/hooks/usePagedRows";
import { listClientsAdmin, getWafIngestionRuns } from "@/lib/api";
import { fmtDateTime } from "@/lib/dates";
import { resolveInitialClient, writeActiveClient } from "@/lib/clientSelection";
import { humanizeSyncError, subStatusLabel, subStatusTone, syncOmittedNote, type SyncTone } from "@/lib/advisorSyncStatus";
import type { ClientAdmin, WafIngestionRun } from "@/types";

const COLS = 9;
const TONE_CHIP: Record<SyncTone, string> = {
  ok: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

function statusChip(status: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s.includes("complet") && !s.includes("error")) return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200";
  if (s.includes("run")) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  if (s.includes("fail") || s.includes("error")) return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
}

export default function IngestionsPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const [clients, setClients] = useState<ClientAdmin[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [runs, setRuns] = useState<WafIngestionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    listClientsAdmin().then((cs) => {
      setClients(cs);
      setClientId(resolveInitialClient(cs));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (clientId == null) return;
    setLoading(true);
    setExpanded(null);
    getWafIngestionRuns(clientId).then(setRuns).catch(() => setRuns([])).finally(() => setLoading(false));
  }, [clientId]);

  function selectClient(id: number) { writeActiveClient(id); setClientId(id); }
  function toggle(runId: number) { setExpanded((cur) => (cur === runId ? null : runId)); }
  const { table, pageRows } = usePagedRows(runs);

  return (
    <AppShell title="Historial de ingestas" subtitle="Matriz mejoras Azure · cargas de Advisor/Excel"
      active="waf-ingestions" onNavigate={onNavigate}
      headerRight={<ClientHeader clients={clients} clientId={clientId} onSelect={selectClient} />}>
      <BusyOverlay show={loading} title="Cargando historial" />
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Archivo</TableHead><TableHead>Estado</TableHead><TableHead>Filas</TableHead>
            <TableHead>Nuevas / Hallazgos</TableHead><TableHead>Resueltos</TableHead>
            <TableHead>Inicio</TableHead><TableHead>Fin</TableHead><TableHead>Usuario</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow><TableCell colSpan={COLS} className="text-center text-muted-foreground py-8">Sin ingestas registradas.</TableCell></TableRow>
            ) : pageRows.map((r) => {
              const isOpen = expanded === r.run_id;
              const subs = r.subscription_results ?? [];
              return (
                <Fragment key={r.run_id}>
                  <TableRow className="cursor-pointer" onClick={() => toggle(r.run_id)}>
                    <TableCell className="align-middle text-muted-foreground">
                      <button type="button" aria-label={isOpen ? "Contraer detalle" : "Expandir detalle"}
                        aria-expanded={isOpen} onClick={(e) => { e.stopPropagation(); toggle(r.run_id); }}
                        className="flex items-center justify-center rounded hover:bg-muted p-0.5">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{r.source_file_name ?? ""}</TableCell>
                    <TableCell>
                      {r.status && <span className={`text-xs px-2.5 py-0.5 rounded-full ${statusChip(r.status)}`}>{r.status}</span>}
                      {r.error_message && <div className="text-[11px] text-destructive mt-1 max-w-[220px] truncate">{r.error_message}</div>}
                    </TableCell>
                    <TableCell className="tabular-nums">{r.rows_processed ?? 0}/{r.rows_total ?? 0}</TableCell>
                    <TableCell className="tabular-nums">{r.new_recommendations ?? 0} / {r.new_findings ?? 0}</TableCell>
                    <TableCell className="tabular-nums">{r.resolved_findings ?? 0}</TableCell>
                    <TableCell className="text-xs">{fmtDateTime(r.started_at)}</TableCell>
                    <TableCell className="text-xs">{fmtDateTime(r.completed_at)}</TableCell>
                    <TableCell className="text-xs">{r.created_by ?? ""}</TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={COLS} className="py-3">
                        {subs.length === 0 ? (
                          <p className="text-xs text-muted-foreground pl-2">Sin detalle por suscripción (corrida antigua o carga por CSV).</p>
                        ) : (
                          <div className="space-y-1.5 pl-2">
                            <p className="text-xs font-medium text-muted-foreground">Detalle por suscripción</p>
                            <ul className="space-y-1.5">
                              {subs.map((s) => (
                                <li key={s.subscription_id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                                  <span className={`shrink-0 px-2 py-0.5 rounded-full font-medium ${TONE_CHIP[subStatusTone(s.status)]}`}>
                                    {subStatusLabel(s.status)}
                                  </span>
                                  <span className="font-medium">{s.subscription_name || s.subscription_id}</span>
                                  {s.credential_name && <span className="text-muted-foreground">({s.credential_name})</span>}
                                  {s.status !== "ok" && (
                                    <span className="text-muted-foreground">— {humanizeSyncError(s.status, s.error)}</span>
                                  )}
                                  {syncOmittedNote(s) && (
                                    <span className="text-muted-foreground">— {syncOmittedNote(s)}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </AppShell>
  );
}
