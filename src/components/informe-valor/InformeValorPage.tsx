import { useState } from "react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import ClientHeader from "@/components/ClientHeader";
import { Skeleton } from "@/components/ui/skeleton";
import InsumoCards from "./InsumoCards";
import SubirInsumoDialog from "./SubirInsumoDialog";
import { useInformeValor } from "@/hooks/useInformeValor";
import { borrarInsumoInformeValor, subirInsumoInformeValor } from "@/lib/api";
import { canEditModule } from "@/lib/auth";
import type { InsumoKind } from "@/types";

export default function InformeValorPage({ onNavigate }: { onNavigate: (key: string) => void }) {
  const { clients, clientId, setClientId, estado, loading, dataLoading, error, refresh } = useInformeValor();
  const [kind, setKind] = useState<InsumoKind | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState<{ title: string; detail?: string }>({ title: "Procesando…" });
  const canEdit = canEditModule("informe-valor");

  async function subir(file: File) {
    if (!clientId || !kind) return;
    setBusyMsg({ title: "Procesando el archivo", detail: file.name });
    setBusy(true);
    try {
      const r = await subirInsumoInformeValor(clientId, kind, file);
      toast.success(`${r.rows_processed.toLocaleString("en-US")} filas cargadas`
        + (r.rows_skipped ? ` · ${r.rows_skipped.toLocaleString("en-US")} descartadas` : ""));
      r.warnings.forEach((w) => toast.warning(w));
      setOpen(false);
      await refresh();
    } catch (e) {
      toast.error(`No se pudo cargar el archivo: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  }

  async function borrar(k: InsumoKind) {
    if (!clientId) return;
    setBusyMsg({ title: "Quitando el insumo" });
    setBusy(true);
    try {
      await borrarInsumoInformeValor(clientId, k);
      toast.success("Insumo quitado");
      await refresh();
    } catch (e) {
      toast.error(`No se pudo quitar: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  }

  return (
    <AppShell
      title="Informe de valor del servicio"
      subtitle="Carga los insumos que la plataforma no puede obtener sola"
      active="informe-valor"
      onNavigate={onNavigate}
      headerRight={
        <ClientHeader
          clients={clients}
          clientId={clientId}
          onSelect={setClientId}
          disabled={loading || dataLoading || busy}
        />
      }
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</div>
          )}
          {dataLoading ? (
            <div className="text-sm text-muted-foreground">Cargando insumos…</div>
          ) : estado ? (
            <InsumoCards
              insumos={estado.insumos}
              canEdit={canEdit}
              busy={busy}
              onSubir={(k) => { setKind(k); setOpen(true); }}
              onBorrar={borrar}
            />
          ) : null}
        </div>
      )}
      <SubirInsumoDialog kind={kind} open={open} busy={busy} onOpenChange={setOpen} onConfirm={subir} />
      <BusyOverlay show={busy} title={busyMsg.title} detail={busyMsg.detail} />
    </AppShell>
  );
}
