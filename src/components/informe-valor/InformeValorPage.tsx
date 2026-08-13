import { useEffect, useState } from "react";
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
import PanelEntrega from "./entrega/PanelEntrega";
import TablaEntregas from "./entrega/TablaEntregas";
import { useInformeValor } from "@/hooks/useInformeValor";
import { useInformePreview } from "@/hooks/useInformePreview";
import { useEntregas } from "@/hooks/useEntregas";
import { borrarInsumoInformeValor, descargarEntregaInformeValor, subirInsumoInformeValor } from "@/lib/api";
import { canEditModule } from "@/lib/auth";
import {
  cuerpoDeGeneracion, cuerpoDeParametros, parametrosPorDefecto,
  type BloqueEconomico, type ParametrosInforme,
} from "@/lib/informeValor";
import type { InformeValorEntrega, InsumoKind, VarianteInforme } from "@/types";

const NOMBRE_INSUMO: Record<string, string> = {
  facturacion: "BITCOST (facturación)",
  evolucion: "evolución por recurso (BITCOST)",
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
  // Los seis bloques económicos nacen APAGADOS (F1): generar sin decidir produce el informe sin
  // cifras, que es una entrega válida. Ningún estado inicial los prende, ni "para arrancar".
  const [aprobados, setAprobados] = useState<BloqueEconomico[]>([]);
  const [ultimaEntrega, setUltimaEntrega] = useState<InformeValorEntrega | null>(null);
  const canEdit = canEditModule("informe-valor");

  // Vista previa en dos fases: el modelo primero, las reservas de Azure después (ver el hook).
  const informe = useInformePreview(clientId);
  // El archivo de entregas del cliente y la generación de una nueva (misma pieza: generar produce
  // una fila del archivo).
  const entregas = useEntregas(clientId);

  // La aprobación es de un informe concreto: al cambiar de cliente, los seis vuelven a apagarse. Una
  // aprobación heredada del cliente anterior es la peor forma de equivocarse en este módulo.
  useEffect(() => {
    setAprobados([]);
    setUltimaEntrega(null);
  }, [clientId]);

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

  /**
   * Genera el artefacto con el cuerpo REVISADO (no con el del formulario, que se puede haber tocado
   * después) y lo descarga. Lo que se cuenta al terminar sale de lo que la API archivó, no de los
   * interruptores: la variante interna publica los seis sin mirarlos.
   */
  async function generarArtefacto(variante: VarianteInforme) {
    const cuerpo = informe.cuerpoRevisado;
    if (!clientId || !cuerpo) return;
    try {
      const entrega = await entregas.generar(cuerpoDeGeneracion(cuerpo, variante, aprobados));
      setUltimaEntrega(entrega);
      const nPublicados = entrega.bloques_publicados.length;
      toast.success(nPublicados === 0
        ? "Informe generado sin montos: las secciones van con sus conteos y porcentajes."
        : `Informe generado con ${nPublicados} bloque(s) económico(s) publicado(s).`);
    } catch (e) {
      toast.error(`No se pudo generar el informe: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function descargarEntrega(entrega: InformeValorEntrega) {
    if (!clientId) return;
    try {
      await descargarEntregaInformeValor(clientId, entrega);
    } catch (e) {
      toast.error(`No se pudo descargar la entrega: ${e instanceof Error ? e.message : String(e)}`);
    }
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
              <TabsTrigger value="entrega">Entrega</TabsTrigger>
              <TabsTrigger value="entregas">Entregas</TabsTrigger>
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

            <TabsContent value="entrega" className="space-y-4">
              <PanelEntrega
                modelo={informe.modelo}
                cuerpoRevisado={informe.cuerpoRevisado}
                cuerpoActual={cuerpoDeParametros(params)}
                aprobados={aprobados}
                onAprobados={setAprobados}
                canEdit={canEdit}
                generando={entregas.generando}
                onGenerar={(v) => void generarArtefacto(v)}
                ultima={ultimaEntrega}
              />
            </TabsContent>

            <TabsContent value="entregas" className="space-y-4">
              <p className="max-w-3xl text-sm text-muted-foreground">
                Cada descarga queda archivada con sus parámetros. Reemitir el mismo período es
                legítimo: dos filas del mismo período son dos emisiones, no un duplicado.
              </p>
              <TablaEntregas
                entregas={entregas.entregas}
                cargando={entregas.cargando}
                error={entregas.error}
                onDescargar={(e) => void descargarEntrega(e)}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
      <SubirInsumoDialog kind={kind} open={open} busy={busy} onOpenChange={setOpen} onConfirm={subir} />
      <BusyOverlay show={busy} title={busyMsg.title} detail={busyMsg.detail} />
    </AppShell>
  );
}
