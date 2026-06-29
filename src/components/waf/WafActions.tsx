import { useState } from "react";
import { Download, MoreHorizontal, CloudUpload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import BusyOverlay from "@/components/BusyOverlay";
import AdvisorSyncDialog from "@/components/waf/AdvisorSyncDialog";
import ImportCsvDialog from "@/components/waf/ImportCsvDialog";
import { runWafAdvisorSync, uploadWafIngestion, downloadFromApi } from "@/lib/api";
import { advisorSyncSummary } from "@/lib/waf";
import { canEdit } from "@/lib/auth";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

export default function WafActions({ clientId, onChanged }: { clientId: number; onChanged: () => void }) {
  const editable = canEdit();
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState<{ title: string; detail?: string }>({ title: "" });
  const [syncOpen, setSyncOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

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
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <AdvisorSyncDialog open={syncOpen} clientId={clientId} busy={busy} onOpenChange={setSyncOpen} onConfirm={doSync} />
      <ImportCsvDialog open={csvOpen} clientId={clientId} busy={busy} onOpenChange={setCsvOpen} onConfirm={doCsv} />
    </div>
  );
}
