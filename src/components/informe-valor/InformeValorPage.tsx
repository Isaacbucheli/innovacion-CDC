import { useState } from "react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import ClientHeader from "@/components/ClientHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InsumoCards from "./InsumoCards";
import SubirInsumoDialog from "./SubirInsumoDialog";
import ControlesPreview from "./informe/ControlesPreview";
import InformeVista from "./informe/InformeVista";
import { useInformeValor } from "@/hooks/useInformeValor";
import { useInformePreview } from "@/hooks/useInformePreview";
import { borrarInsumoInformeValor, subirInsumoInformeValor } from "@/lib/api";
import { canEditModule } from "@/lib/auth";
import { cuerpoDeParametros, parametrosPorDefecto, type ParametrosInforme } from "@/lib/informeValor";
import type { InsumoKind } from "@/types";

const NOMBRE_INSUMO: Record<string, string> = {
  facturacion: "BITCOST (facturación)",
  casos: "casos de la mesa de servicio",
  rbac: "permisos (RBAC)",
};

export default function InformeValorPage({ onNavigate }: { onNavigate: (key: string) => void }) {
  const { clients, clientId, setClientId, estado, estadoRbac, loading, dataLoading, error, refresh } = useInformeValor();
  const [kind, setKind] = useState<InsumoKind | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState<{ title: string; detail?: string }>({ title: "Procesando…" });
  const [params, setParams] = useState<ParametrosInforme>(parametrosPorDefecto);
  const canEdit = canEditModule("informe-valor");

  // Vista previa en dos fases: el modelo primero, las reservas de Azure después (ver el hook).
  const informe = useInformePreview(clientId);

  const faltantes = (estado?.insumos ?? [])
    .filter((i) => i.obligatorio && !i.cargado)
    .map((i) => NOMBRE_INSUMO[i.kind] ?? i.kind);

  async function subir(file: File) {
    if (!clientId || !kind) return;
    setBusyMsg({ title: "Procesando el archivo", detail: file.name });
    setBusy(true);
    try {
      const r = await subirInsumoInformeValor(clientId, kind, file);
      // Solo RBAC puede llegar descartado ("gana la base"): la base ya tenia el insumo completo
      // cuando el archivo llego, y el servidor no lo uso. Un toast de exito acá convenceria al
      // consultor de que subio algo que no se aplico.
      if (r.descartado) {
        toast.warning(r.detail ?? "La base ya tenia el insumo completo: se descarto el archivo.");
      } else {
        toast.success(`${r.rows_processed.toLocaleString("en-US")} filas cargadas`
          + (r.rows_skipped ? ` · ${r.rows_skipped.toLocaleString("en-US")} descartadas` : ""));
      }
      r.warnings.forEach((w) => toast.warning(w));
      setOpen(false);
      // El informe que estaba en pantalla se calculó con los insumos de antes de esta carga.
      informe.limpiar();
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
      informe.limpiar();
      await refresh();
    } catch (e) {
      toast.error(`No se pudo quitar: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  }

  return (
    <AppShell
      title="Informe de valor del servicio"
      subtitle="Carga los insumos, revisa el informe y decide qué se publica"
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
          <Tabs defaultValue="insumos" className="space-y-4">
            <TabsList>
              <TabsTrigger value="insumos">Insumos</TabsTrigger>
              <TabsTrigger value="informe">Informe</TabsTrigger>
            </TabsList>

            <TabsContent value="insumos" className="space-y-4">
              {dataLoading ? (
                <div className="text-sm text-muted-foreground">Cargando insumos…</div>
              ) : estado ? (
                <InsumoCards
                  insumos={estado.insumos}
                  estadoRbac={estadoRbac}
                  canEdit={canEdit}
                  busy={busy}
                  onSubir={(k) => { setKind(k); setOpen(true); }}
                  onBorrar={borrar}
                  onIrARevisionAccesos={() => onNavigate("access-review")}
                />
              ) : null}
            </TabsContent>

            <TabsContent value="informe" className="space-y-4">
              <p className="max-w-3xl text-sm text-muted-foreground">
                Vista interna de revisión: se muestra todo, montos incluidos. Qué se publica al
                cliente se decide en la entrega, no acá.
              </p>

              <ControlesPreview
                params={params}
                onChange={setParams}
                cargando={informe.cargando}
                onGenerar={() => void informe.generar(cuerpoDeParametros(params))}
              />

              {faltantes.length > 0 && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Falta el insumo de {faltantes.join(" y el de ")}. El informe se calcula igual, pero
                  ese bloque va a salir declarado como ausente, no en cero.
                </p>
              )}

              {informe.error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  No se pudo calcular el informe: {informe.error}
                </div>
              )}

              {informe.cargando && (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              )}

              {!informe.cargando && !informe.modelo && !informe.error && (
                <p className="text-sm text-muted-foreground">
                  Elige el período y la fecha de corte, y pide el informe para revisarlo.
                </p>
              )}

              {informe.modelo && (
                <InformeVista
                  modelo={informe.modelo}
                  variacion={informe.variacion}
                  faseReservas={informe.faseReservas}
                  errorReservas={informe.errorReservas}
                  onReintentarReservas={informe.reintentarReservas}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
      <SubirInsumoDialog kind={kind} open={open} busy={busy} onOpenChange={setOpen} onConfirm={subir} />
      <BusyOverlay show={busy} title={busyMsg.title} detail={busyMsg.detail} />
    </AppShell>
  );
}
