import { useMemo, useState } from "react";
import { Download, History, Radar } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ClientHeader from "@/components/ClientHeader";
import OptimizationKpis from "@/components/optimization/OptimizationKpis";
import SavingsDonut from "@/components/optimization/SavingsDonut";
import FindingsGroup from "@/components/optimization/FindingsGroup";
import FindingsTable from "@/components/optimization/FindingsTable";
import FindingDetailSheet from "@/components/optimization/FindingDetailSheet";
import ScanHistoryDialog from "@/components/optimization/ScanHistoryDialog";
import ExportExcelDialog from "@/components/optimization/ExportExcelDialog";
import { useOptimization } from "@/hooks/useOptimization";
import { computeKpis, groupFindings, optimizationExcelFileName } from "@/lib/optimization";
import { formatMoney } from "@/lib/costs";
import { downloadOptimizationExcel, runOptimizationScan } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import type { FindingState, OptFinding } from "@/types";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Error inesperado");

export default function OptimizationPage({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const { clients, clientId, allowed, scans, latestScan, findings, loading, dataLoading, error, selectClient, reload } = useOptimization();
  const editable = canEdit();

  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState<{ title: string; detail?: string }>({ title: "" });
  const [detail, setDetail] = useState<OptFinding | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const kpis = useMemo(() => computeKpis(findings), [findings]);
  const sections = useMemo(() => groupFindings(findings), [findings]);

  async function doScan() {
    if (clientId == null) return;
    setBusyMsg({ title: "Ejecutando barrido", detail: "Analizando el tenant en Azure… (puede tardar unos minutos)" });
    setBusy(true);
    try {
      const s = await runOptimizationScan(clientId);
      toast.success(`Barrido completado: ${s.findings_count} hallazgos · ahorro estimado ${formatMoney(s.total_estimated_monthly_savings)}/mes.`);
      reload();
    } catch (e) {
      toast.error(`El barrido no pudo completarse: ${msg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function doExport(states: FindingState[]) {
    if (clientId == null || !latestScan) return;
    const clientName = clients.find((c) => c.client_id === clientId)?.client_name ?? "cliente";
    setBusyMsg({ title: "Generando Excel", detail: "Armando el archivo de hallazgos…" });
    setBusy(true);
    try {
      await downloadOptimizationExcel(latestScan.scan_id, states, optimizationExcelFileName(clientName, latestScan.started_at));
      toast.success("Excel exportado.");
      setExportOpen(false);
    } catch (e) {
      toast.error(`No se pudo exportar: ${msg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const clientSelect = <ClientHeader clients={clients} clientId={clientId} onSelect={selectClient} disabled={busy} />;

  return (
    <AppShell
      title="Oportunidades de Optimización"
      subtitle="Barrido del tenant (solo lectura): recomendaciones de costo y gobernanza al estilo FinOps Toolkit."
      active="optimization"
      onNavigate={onNavigate}
      headerRight={allowed ? clientSelect : undefined}
    >
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : allowed === false ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <Radar className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Módulo no disponible para este usuario.</p>
          <p className="text-sm text-muted-foreground mt-1">
            La Optimización Azure está habilitada solo para cuentas autorizadas. Contacta a un administrador si necesitas acceso.
          </p>
        </div>
      ) : (
        <>
          {error && <p className="text-destructive mb-4">{error}</p>}

          <div className="flex flex-wrap gap-2 mb-5">
            {editable && (
              <Button size="sm" disabled={busy || clientId == null} onClick={doScan}>
                <Radar className="w-4 h-4 mr-1" />
                Ejecutar barrido
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setHistoryOpen(true)}>
              <History className="w-4 h-4 mr-1" />
              Historial
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !latestScan || findings.length === 0}
              onClick={() => setExportOpen(true)}
            >
              <Download className="w-4 h-4 mr-1" />
              Exportar
            </Button>
          </div>

          {dataLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !latestScan ? (
            <div className="rounded-xl border bg-card p-8 text-center">
              <p className="font-semibold">Este cliente aún no tiene barridos.</p>
              <p className="text-sm text-muted-foreground mt-1">
                {editable ? "Ejecuta un barrido para descubrir recomendaciones de optimización." : "Pide a un consultor que ejecute el primer barrido."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-[320px_1fr] mb-6">
                <SavingsDonut findings={findings} />
                <OptimizationKpis kpis={kpis} latestScan={latestScan} />
              </div>

              {findings.length === 0 ? (
                <div className="rounded-xl border bg-card p-8 text-center">
                  <p className="font-semibold">Sin hallazgos abiertos.</p>
                  <p className="text-sm text-muted-foreground mt-1">El último barrido no encontró recomendaciones. 🎉</p>
                </div>
              ) : (
                sections.map((sec) => (
                  <section key={sec.section} className="mb-8">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-1 h-5 rounded bg-primary" aria-hidden />
                      <h2 className="text-lg font-bold">{sec.label}</h2>
                      {sec.savings > 0 && (
                        <span className="ml-auto font-bold tabular-nums text-[#5a7016] dark:text-[#a9c46a]">
                          {formatMoney(sec.savings)} /mes
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">
                      {sec.groups.map((g) => (
                        <FindingsGroup key={g.group} label={g.label} count={g.count} savings={g.savings} color={g.color}>
                          <FindingsTable findings={g.findings} onOpen={setDetail} />
                        </FindingsGroup>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </>
          )}
        </>
      )}

      <FindingDetailSheet
        finding={detail}
        canEdit={editable}
        open={detail !== null}
        onOpenChange={(o) => !o && setDetail(null)}
        onSaved={reload}
      />
      <ScanHistoryDialog scans={scans} open={historyOpen} onOpenChange={setHistoryOpen} />
      <ExportExcelDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        findings={findings}
        busy={busy}
        onConfirm={doExport}
      />

      <BusyOverlay show={busy} title={busyMsg.title} detail={busyMsg.detail} />
    </AppShell>
  );
}
