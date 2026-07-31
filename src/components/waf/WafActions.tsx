import { useEffect, useState } from "react";
import { Download, MoreHorizontal, CloudUpload, GitMerge, RefreshCw, LineChart, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import BusyOverlay from "@/components/BusyOverlay";
import AdvisorSyncDialog from "@/components/waf/AdvisorSyncDialog";
import ImportCsvDialog from "@/components/waf/ImportCsvDialog";
import ConsolidateDialog from "@/components/waf/ConsolidateDialog";
import AdvisorScoreDialog from "@/components/waf/AdvisorScoreDialog";
import ExcelImportDialog from "@/components/waf/ExcelImportDialog";
import ScoreHistorySheet from "@/components/waf/ScoreHistorySheet";
import SecurityManagementDialog from "@/components/waf/SecurityManagementDialog";
import { uploadWafIngestion, downloadFromApi, consolidateWafDuplicates, refreshWafAdvisorScore, wafSubsQuery } from "@/lib/api";
import { ADVISOR_SYNC_COMPLETED_EVENT, startAdvisorSyncJob } from "@/lib/advisorSync";
import { canEditModule } from "@/lib/auth";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

export default function WafActions({ clientId, onChanged, pillarNames, subscriptions = [] }: {
  clientId: number; onChanged: () => void; pillarNames: Record<number, string>;
  /** Selección del filtro: el Excel se exporta con el mismo recorte que la vista. */
  subscriptions?: string[];
}) {
  const editable = canEditModule("waf");
  const editableIngestions = canEditModule("waf-ingestions");
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState<{ title: string; detail?: string }>({ title: "Procesando…" });
  const [syncOpen, setSyncOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [consOpen, setConsOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [secOpen, setSecOpen] = useState(false);

  useEffect(() => {
    const completed = (event: Event) => {
      const result = (event as CustomEvent<{ client_id?: number }>).detail;
      if (result?.client_id === clientId) onChanged();
    };
    window.addEventListener(ADVISOR_SYNC_COMPLETED_EVENT, completed);
    return () => window.removeEventListener(ADVISOR_SYNC_COMPLETED_EVENT, completed);
  }, [clientId, onChanged]);

  async function doExport() {
    const filtered = subscriptions.length > 0;
    setBusyMsg({ title: "Generando Excel", detail: filtered ? `Matriz WAF · ${subscriptions.length} suscripciones…` : "Matriz WAF…" });
    setBusy(true);
    try {
      const query = wafSubsQuery(subscriptions);
      const suffix = filtered ? `-${subscriptions.length}-suscripciones` : "";
      await downloadFromApi(
        `/waf/clients/${clientId}/export-excel${query ? `?${query}` : ""}`,
        `matriz-waf-cliente-${clientId}${suffix}.xlsx`,
      );
      toast.success(filtered
        ? `Excel descargado con el filtro de ${subscriptions.length} suscripciones.`
        : "Excel de la matriz WAF descargado.");
    } catch (e) {
      toast.error(`Error exportando Excel: ${msg(e)}`);
    } finally { setBusy(false); }
  }

  async function doSync(subscriptionIds: string[]) {
    setSyncOpen(false);
    setBusyMsg({ title: "Consultando Advisor", detail: "Puede tardar; no cierres la ventana." });
    setBusy(true);
    try {
      await startAdvisorSyncJob(clientId, subscriptionIds);
    } catch (e) {
      toast.error(`Error consultando Advisor: ${msg(e)}`);
    } finally { setBusy(false); }
  }

  async function doCsv(file: File) {
    setCsvOpen(false);
    setBusyMsg({ title: "Importando CSV", detail: file.name });
    setBusy(true);
    try {
      await uploadWafIngestion(clientId, file);
      toast.success("CSV de Advisor importado.");
      onChanged();
    } catch (e) {
      toast.error(`Error importando CSV: ${msg(e)}`);
    } finally { setBusy(false); }
  }

  async function doConsolidate(useAi: boolean) {
    setConsOpen(false);
    setBusyMsg({ title: "Consolidando duplicados", detail: useAi ? "con IA…" : "sin IA…" });
    setBusy(true);
    try {
      const r = await consolidateWafDuplicates(clientId, useAi);
      toast.success(`Consolidación completada · ${r.merged} fusionado${r.merged === 1 ? "" : "s"}`);
      onChanged();
    } catch (e) { toast.error(`Error consolidando: ${msg(e)}`); }
    finally { setBusy(false); }
  }

  async function doScoreRefresh(includeInReports: boolean) {
    setScoreOpen(false);
    setBusyMsg({ title: "Actualizando Advisor Score", detail: "Consultando Azure…" });
    setBusy(true);
    try {
      await refreshWafAdvisorScore(clientId, includeInReports);
      toast.success("Advisor Score actualizado.");
      onChanged();
    } catch (e) { toast.error(`Error actualizando Score: ${msg(e)}`); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <BusyOverlay show={busy} title={busyMsg.title} detail={busyMsg.detail} />
      {editable && (
        <Button size="sm" disabled={busy} onClick={() => setSyncOpen(true)}>
          <CloudUpload className="w-4 h-4 mr-1" /> Consultar Advisor
        </Button>
      )}
      <Button variant="outline" size="sm" disabled={busy} onClick={doExport}>
        <Download className="w-4 h-4 mr-1" /> Exportar Excel
      </Button>
      {/* "Opciones" siempre visible: "Histórico" es lectura (todos), los demás ítems van gateados. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>
            <MoreHorizontal className="w-4 h-4 mr-1" /> Opciones
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setHistoryOpen(true)}><LineChart className="w-4 h-4 mr-2" />Histórico del score</DropdownMenuItem>
          {(editableIngestions || editable) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Cargar datos</DropdownMenuLabel>
              {editableIngestions && <DropdownMenuItem onClick={() => setCsvOpen(true)}>Importar Advisor CSV</DropdownMenuItem>}
              {editable && <DropdownMenuItem onClick={() => setExcelOpen(true)}>Importar matriz Excel</DropdownMenuItem>}
            </>
          )}
          {editable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Mantenimiento</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setConsOpen(true)}><GitMerge className="w-4 h-4 mr-2" />Consolidar duplicados</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSecOpen(true)}><ShieldCheck className="w-4 h-4 mr-2" />Gestión de Vulnerabilidades…</DropdownMenuItem>
              {/* Antes era admin-only y el consultor no lo veía: ahora basta "Editar" en el módulo,
                  y el backend restringe el refresh a los clientes asignados. */}
              <DropdownMenuItem onClick={() => setScoreOpen(true)}><RefreshCw className="w-4 h-4 mr-2" />Actualizar Advisor Score</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AdvisorSyncDialog open={syncOpen} clientId={clientId} busy={busy} onOpenChange={setSyncOpen} onConfirm={doSync} />
      <ImportCsvDialog open={csvOpen} clientId={clientId} busy={busy} onOpenChange={setCsvOpen} onConfirm={doCsv} />
      <ConsolidateDialog open={consOpen} busy={busy} onOpenChange={setConsOpen} onConfirm={doConsolidate} />
      <AdvisorScoreDialog open={scoreOpen} busy={busy} onOpenChange={setScoreOpen} onConfirm={doScoreRefresh} />
      <ExcelImportDialog open={excelOpen} clientId={clientId} onOpenChange={setExcelOpen} onChanged={onChanged} />
      <ScoreHistorySheet clientId={clientId} open={historyOpen} onOpenChange={setHistoryOpen} pillarNames={pillarNames} />
      <SecurityManagementDialog clientId={clientId} open={secOpen} onOpenChange={setSecOpen} onChanged={onChanged} />
    </div>
  );
}
