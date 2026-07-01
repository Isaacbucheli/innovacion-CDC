import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import WafClientHeader from "@/components/waf/WafClientHeader";
import DataTablePagination from "@/components/DataTablePagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePagedRows } from "@/hooks/usePagedRows";
import { listClientsAdmin, getWafIngestionRuns } from "@/lib/api";
import { resolveInitialClient, writeActiveClient } from "@/lib/clientSelection";
import type { ClientAdmin, WafIngestionRun } from "@/types";

function statusChip(status: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s.includes("complet") && !s.includes("error")) return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200";
  if (s.includes("run")) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  if (s.includes("fail") || s.includes("error")) return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
}
function fmtDate(d: string | null): string { return d ? new Date(d).toLocaleString("es-EC") : "—"; }

export default function IngestionsPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const [clients, setClients] = useState<ClientAdmin[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [runs, setRuns] = useState<WafIngestionRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listClientsAdmin().then((cs) => {
      setClients(cs);
      setClientId(resolveInitialClient(cs));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (clientId == null) return;
    setLoading(true);
    getWafIngestionRuns(clientId).then(setRuns).catch(() => setRuns([])).finally(() => setLoading(false));
  }, [clientId]);

  function selectClient(id: number) { writeActiveClient(id); setClientId(id); }
  const { table, pageRows } = usePagedRows(runs);

  return (
    <AppShell title="Historial de ingestas" subtitle="Matriz mejoras Azure · cargas de Advisor/Excel"
      active="waf-ingestions" onNavigate={onNavigate}
      headerRight={<WafClientHeader clients={clients} clientId={clientId} onSelect={selectClient} />}>
      <BusyOverlay show={loading} title="Cargando historial" />
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Archivo</TableHead><TableHead>Estado</TableHead><TableHead>Filas</TableHead>
            <TableHead>Nuevas / Hallazgos</TableHead><TableHead>Resueltos</TableHead>
            <TableHead>Inicio</TableHead><TableHead>Fin</TableHead><TableHead>Usuario</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin ingestas registradas.</TableCell></TableRow>
            ) : pageRows.map((r) => (
              <TableRow key={r.run_id}>
                <TableCell className="max-w-[220px] truncate">{r.source_file_name ?? "—"}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full ${statusChip(r.status)}`}>{r.status ?? "—"}</span>
                  {r.error_message && <div className="text-[11px] text-destructive mt-1 max-w-[220px] truncate">{r.error_message}</div>}
                </TableCell>
                <TableCell className="tabular-nums">{r.rows_processed ?? 0}/{r.rows_total ?? 0}</TableCell>
                <TableCell className="tabular-nums">{r.new_recommendations ?? 0} / {r.new_findings ?? 0}</TableCell>
                <TableCell className="tabular-nums">{r.resolved_findings ?? 0}</TableCell>
                <TableCell className="text-xs">{fmtDate(r.started_at)}</TableCell>
                <TableCell className="text-xs">{fmtDate(r.completed_at)}</TableCell>
                <TableCell className="text-xs">{r.created_by ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </AppShell>
  );
}
