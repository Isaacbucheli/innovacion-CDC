import { useState } from "react";
import { Download, MoreHorizontal, CloudUpload, GitMerge, RefreshCw } from "lucide-react";
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
import { runWafAdvisorSync, uploadWafIngestion, downloadFromApi, consolidateWafDuplicates, refreshWafAdvisorScore } from "@/lib/api";
import { advisorSyncSummary } from "@/lib/waf";
import { canEdit, getRole } from "@/lib/auth";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

export default function WafActions({ clientId, onChanged }: { clientId: number; onChanged: () => void }) {
  const editable = canEdit();
  const isAdmin = getRole() === "admin";
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState<{ title: string; detail?: string }>({ title: "Procesando…" });
  const [syncOpen, setSyncOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [consOpen, setConsOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);

  async function doExport() {
    setBusyMsg({ title: "Generando Excel", detail: "Matriz WAF…" });
    setBusy(true);
    try {
      await downloadFromApi(`/waf/clients/${clientId}/export-excel`, `matriz-waf-cliente-${clientId}.xlsx`);
      toast.success("Excel de la matriz WAF descargado.");
    } catch (e) {
      toast.error(`Error exportando Excel: ${msg(e)}`);
    } finally { setBusy(false); }
  }

  async function doSync(subscriptionIds: string[]) {
    setSyncOpen(false);
    setBusyMsg({ title: "Consultando Advisor", detail: "Puede tardar; no cierres la ventana." });
    setBusy(true);
    try {
      const r = await runWafAdvisorSync(clientId, { subscriptions: subscriptionIds, timeout_seconds_per_subscription: 600 });
      toast.success(`Advisor sincronizado · ${advisorSyncSummary(r)}`);
      onChanged();
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
      {editable && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={busy}>
              <MoreHorizontal className="w-4 h-4 mr-1" /> Opciones
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Cargar datos</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setCsvOpen(true)}>Importar Advisor CSV</DropdownMenuItem>
            {(editable || isAdmin) && <DropdownMenuSeparator />}
            {(editable || isAdmin) && <DropdownMenuLabel>Mantenimiento</DropdownMenuLabel>}
            {editable && <DropdownMenuItem onClick={() => setConsOpen(true)}><GitMerge className="w-4 h-4 mr-2" />Consolidar duplicados</DropdownMenuItem>}
            {isAdmin && <DropdownMenuItem onClick={() => setScoreOpen(true)}><RefreshCw className="w-4 h-4 mr-2" />Actualizar Advisor Score</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <AdvisorSyncDialog open={syncOpen} clientId={clientId} busy={busy} onOpenChange={setSyncOpen} onConfirm={doSync} />
      <ImportCsvDialog open={csvOpen} clientId={clientId} busy={busy} onOpenChange={setCsvOpen} onConfirm={doCsv} />
      <ConsolidateDialog open={consOpen} busy={busy} onOpenChange={setConsOpen} onConfirm={doConsolidate} />
      <AdvisorScoreDialog open={scoreOpen} busy={busy} onOpenChange={setScoreOpen} onConfirm={doScoreRefresh} />
    </div>
  );
}
