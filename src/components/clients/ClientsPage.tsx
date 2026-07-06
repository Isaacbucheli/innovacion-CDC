import { useMemo, useState } from "react";
import { Cloud, MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SearchInput from "@/components/SearchInput";
import { Skeleton } from "@/components/ui/skeleton";
import ClientCard from "@/components/clients/ClientCard";
import ClientFormDialog from "@/components/clients/ClientFormDialog";
import ClientDangerDialog, { type DangerMode } from "@/components/clients/ClientDangerDialog";
import ClientLogoDialog from "@/components/clients/ClientLogoDialog";
import ClientCredentialsDialog from "@/components/clients/ClientCredentialsDialog";
import LighthouseConnectCard from "@/components/credentials/LighthouseConnectCard";
import LighthouseClientPicker from "@/components/credentials/LighthouseClientPicker";
import AdvisorScoreDialog from "@/components/waf/AdvisorScoreDialog";
import DataTablePagination from "@/components/DataTablePagination";
import { useClients } from "@/hooks/useClients";
import { usePagedRows } from "@/hooks/usePagedRows";
import { refreshWafAdvisorScore } from "@/lib/api";
import { refreshAdvisorScoreBatch } from "@/lib/advisorScore";
import { canEdit, getRole } from "@/lib/auth";
import type { ClientAdmin } from "@/types";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

export default function ClientsPage({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const { clients, loading, error, reload } = useClients();
  const editable = canEdit();
  const isAdmin = getRole() === "admin";

  const [q, setQ] = useState("");
  // undefined = diálogo cerrado, null = crear, objeto = renombrar
  const [formClient, setFormClient] = useState<ClientAdmin | null | undefined>(undefined);
  const [logoClient, setLogoClient] = useState<ClientAdmin | null>(null);
  const [credClient, setCredClient] = useState<ClientAdmin | null>(null);
  const [scoreClient, setScoreClient] = useState<ClientAdmin | null>(null);
  const [scoreAllOpen, setScoreAllOpen] = useState(false);
  // Cliente temporal (Lighthouse): flujo independiente de cualquier cliente, disparado
  // desde el menú Opciones (no dentro del detalle de un cliente).
  const [lighthouseOpen, setLighthouseOpen] = useState(false);
  const [lighthousePickerOpen, setLighthousePickerOpen] = useState(false);
  const [lighthouseReprobe, setLighthouseReprobe] = useState(0);
  const [busy, setBusy] = useState(false);
  const [scoreProgress, setScoreProgress] = useState<string | undefined>(undefined);
  const [danger, setDanger] = useState<{ mode: DangerMode; client: ClientAdmin } | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((c) => c.client_name.toLowerCase().includes(term));
  }, [clients, q]);

  const activeCount = useMemo(() => clients.filter((c) => c.is_active).length, [clients]);

  const { table, pageRows } = usePagedRows(filtered);

  function done(message: string) {
    toast.success(message);
    reload();
  }

  async function doScoreRefresh(includeInReports: boolean) {
    if (!scoreClient) return;
    setBusy(true);
    try {
      await refreshWafAdvisorScore(scoreClient.client_id, includeInReports);
      toast.success(`Advisor Score actualizado · ${scoreClient.client_name}.`);
      setScoreClient(null);
    } catch (e) { toast.error(msg(e)); }
    finally { setBusy(false); }
  }

  async function doScoreRefreshAll(includeInReports: boolean) {
    const active = clients.filter((c) => c.is_active);
    if (active.length === 0) { toast.error("No hay clientes activos para actualizar."); return; }
    // Orquestado cliente por cliente para no reventar el timeout del gateway (~230s) que la
    // ruta all-clients síncrona provocaba ("Failed to fetch"). Ver lib/advisorScore.ts.
    setScoreAllOpen(false);
    setBusy(true);
    try {
      const r = await refreshAdvisorScoreBatch(
        clients,
        includeInReports,
        (done, total, name) => setScoreProgress(`Cliente ${done + 1} de ${total}: ${name}`),
      );
      toast.success(`Advisor Score actualizado · ${r.refreshed} de ${r.total} clientes${r.failed ? ` · ${r.failed} con error` : ""}.`);
      reload();
    } catch (e) { toast.error(msg(e)); }
    finally { setBusy(false); setScoreProgress(undefined); }
  }

  return (
    <AppShell
      title="Clientes"
      subtitle="Portafolio de clientes administrados. Gestiona nombre, logo y datos por cliente."
      active="clientes"
      onNavigate={onNavigate}
    >
      <BusyOverlay show={busy} title="Actualizando Advisor Score" detail={scoreProgress} />
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[66px] w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive py-6">{error}</p>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
          <p className="text-muted-foreground">Aún no hay clientes.</p>
          {editable && (
            <Button size="sm" onClick={() => setFormClient(null)}>
              <Plus className="w-4 h-4 mr-1" /> Nuevo cliente
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <span className="text-sm text-muted-foreground">
              {clients.length} {clients.length === 1 ? "cliente" : "clientes"} · {activeCount} {activeCount === 1 ? "activo" : "activos"}
            </span>
            <SearchInput
              className="ml-auto min-w-[200px] max-w-sm flex-1"
              placeholder="Buscar cliente…"
              value={q}
              onChange={setQ}
            />
            {editable && (
              <Button size="sm" onClick={() => setFormClient(null)}>
                <Plus className="w-4 h-4 mr-1" /> Nuevo cliente
              </Button>
            )}
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreHorizontal className="w-4 h-4 mr-1" /> Opciones
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setScoreAllOpen(true)}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Sincronizar Advisor Score (todos)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLighthouseOpen(true)}>
                    <Cloud className="w-4 h-4 mr-2" /> Cliente temporal (Lighthouse)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {pageRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin clientes que coincidan.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {pageRows.map((client) => (
                <ClientCard
                  key={client.client_id}
                  client={client}
                  canEdit={editable}
                  isAdmin={isAdmin}
                  onRename={(c) => setFormClient(c)}
                  onLogo={(c) => setLogoClient(c)}
                  onCredentials={(c) => setCredClient(c)}
                  onAdvisorScore={(c) => setScoreClient(c)}
                  onPurge={(c) => setDanger({ mode: "purge", client: c })}
                  onDelete={(c) => setDanger({ mode: "delete", client: c })}
                />
              ))}
            </div>
          )}

          <DataTablePagination table={table} />
        </>
      )}

      <ClientFormDialog
        open={formClient !== undefined}
        client={formClient ?? null}
        onOpenChange={(o) => !o && setFormClient(undefined)}
        onSaved={() => done(formClient ? "Cliente renombrado correctamente." : "Cliente creado correctamente.")}
      />

      <ClientLogoDialog
        open={logoClient !== null}
        client={logoClient}
        onOpenChange={(o) => !o && setLogoClient(null)}
        onSaved={() => done("Logo actualizado correctamente.")}
      />

      <ClientCredentialsDialog
        open={credClient !== null}
        client={credClient}
        onOpenChange={(o) => !o && setCredClient(null)}
      />

      {/* Cliente temporal (Lighthouse): conectar cuenta Azure → elegir clientes delegados → vincular. */}
      <Dialog open={lighthouseOpen} onOpenChange={setLighthouseOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Cliente temporal (Lighthouse)</DialogTitle></DialogHeader>
          <LighthouseConnectCard
            embedded
            reprobeSignal={lighthouseReprobe}
            onConnected={() => { setLighthouseOpen(false); setLighthousePickerOpen(true); }}
          />
        </DialogContent>
      </Dialog>

      <LighthouseClientPicker
        open={lighthousePickerOpen}
        onOpenChange={setLighthousePickerOpen}
        onLinked={() => reload()}
        onSessionLost={() => setLighthouseReprobe((n) => n + 1)}
      />

      <AdvisorScoreDialog
        open={scoreClient !== null}
        busy={busy}
        onOpenChange={(o) => !o && setScoreClient(null)}
        onConfirm={doScoreRefresh}
      />

      <AdvisorScoreDialog
        open={scoreAllOpen}
        busy={busy}
        allClients
        onOpenChange={setScoreAllOpen}
        onConfirm={doScoreRefreshAll}
      />

      <ClientDangerDialog
        open={danger !== null}
        mode={danger?.mode ?? "purge"}
        client={danger?.client ?? null}
        onOpenChange={(o) => !o && setDanger(null)}
        onDone={() => done(danger?.mode === "delete" ? "Cliente eliminado correctamente." : "Datos del cliente purgados correctamente.")}
      />
    </AppShell>
  );
}
