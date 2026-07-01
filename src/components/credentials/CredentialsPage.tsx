import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import WafClientHeader from "@/components/waf/WafClientHeader";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import CredentialFormDialog from "@/components/credentials/CredentialFormDialog";
import RotateSecretDialog from "@/components/credentials/RotateSecretDialog";
import CredentialAuditSheet from "@/components/credentials/CredentialAuditSheet";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  listClientsAdmin, listCredentials, listClientSubscriptions, testCredential, updateCredential,
  updateSubscription, syncSubscriptions,
} from "@/lib/api";
import { getRole } from "@/lib/auth";
import type { ClientAdmin, Credential, ClientSubscription } from "@/types";

const KEY = "innovacion_cdc_waf_client";
function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }
const chip = (cls: string, text: React.ReactNode) => <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{text}</span>;
const OK = "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200";
const BAD = "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
const NEUTRAL = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";

export default function CredentialsPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const isAdmin = getRole() === "admin";
  const [clients, setClients] = useState<ClientAdmin[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [creds, setCreds] = useState<Credential[]>([]);
  const [subs, setSubs] = useState<ClientSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [rotate, setRotate] = useState<Credential | null>(null);
  const [audit, setAudit] = useState<Credential | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const reload = useCallback((cid: number) => {
    setLoading(true);
    Promise.all([listCredentials(cid), listClientSubscriptions(cid)])
      .then(([c, s]) => { if (mounted.current) { setCreds(c); setSubs(s); } })
      .catch((e) => toast.error(msg(e)))
      .finally(() => { if (mounted.current) setLoading(false); });
  }, []);

  useEffect(() => {
    listClientsAdmin().then((cs) => {
      setClients(cs);
      const stored = Number(localStorage.getItem(KEY));
      setClientId(cs.some((c) => c.client_id === stored) ? stored : cs[0]?.client_id ?? null);
    }).catch((e) => toast.error(msg(e))).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (clientId != null) reload(clientId); }, [clientId, reload]);

  function selectClient(id: number) { localStorage.setItem(KEY, String(id)); setClientId(id); }

  async function testCred(c: Credential) {
    setBusy(`test-${c.credential_id}`);
    try {
      const r = await testCredential(c.credential_id);
      if (r.success) toast.success(`${c.credential_name}: autenticación correcta.`);
      else toast.error(`${c.credential_name}: ${r.error ?? "falló la autenticación"}`);
      if (clientId != null) reload(clientId);
    } catch (e) { toast.error(msg(e)); } finally { setBusy(""); }
  }
  async function toggleCred(c: Credential) {
    setBusy(`upd-${c.credential_id}`);
    try {
      await updateCredential(c.credential_id, { is_active: !c.is_active });
      toast.success(c.is_active ? "Credencial desactivada." : "Credencial activada.");
      if (clientId != null) reload(clientId);
    } catch (e) { toast.error(msg(e)); } finally { setBusy(""); }
  }
  async function toggleSub(s: ClientSubscription) {
    setBusy(`sub-${s.client_subscription_id}`);
    try {
      await updateSubscription(s.client_subscription_id, { is_managed: !s.is_managed });
      toast.success(s.is_managed ? "Suscripción excluida." : "Suscripción marcada como administrada.");
      if (clientId != null) reload(clientId);
    } catch (e) { toast.error(msg(e)); } finally { setBusy(""); }
  }
  async function sync() {
    if (clientId == null) return;
    setBusy("sync");
    try {
      const r = await syncSubscriptions(clientId);
      toast.success(`Sincronizado — nuevas: ${r.created}, actualizadas: ${r.updated}, inactivas: ${r.deactivated}.`);
      if (r.errors?.length) toast.error(`${r.errors.length} credencial(es) con error al sincronizar.`);
      reload(clientId);
    } catch (e) { toast.error(msg(e)); } finally { setBusy(""); }
  }

  const credCols: SimpleCol<Credential>[] = [
    { key: "credential_id", label: "ID", render: (c) => <span className="tabular-nums text-muted-foreground">{c.credential_id}</span> },
    { key: "credential_name", label: "Nombre", render: (c) => <span className="font-medium">{c.credential_name}</span> },
    { key: "tenant_id", label: "Tenant", render: (c) => <span className="font-mono text-xs">{c.tenant_id}</span> },
    { key: "app_client_id", label: "App Client", render: (c) => <span className="font-mono text-xs">{c.app_client_id}</span> },
    { key: "val", label: "Validación", render: (c) => chip(c.last_validation_status === "success" ? OK : c.last_validation_status ? BAD : NEUTRAL, c.last_validation_status ?? "sin validar") },
    { key: "act", label: "Estado", render: (c) => chip(c.is_active ? OK : NEUTRAL, c.is_active ? "Activa" : "Inactiva") },
    { key: "acc", label: "", render: (c) => (
      <div className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Acciones" disabled={!isAdmin}><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => testCred(c)}>Probar conexión</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRotate(c)}>Rotar secreto</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleCred(c)}>{c.is_active ? "Desactivar" : "Activar"}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAudit(c)}>Ver historial</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ) },
  ];

  const subCols: SimpleCol<ClientSubscription>[] = [
    { key: "credential_name", label: "Credencial", render: (s) => s.credential_name || (s.credential_id ? `#${s.credential_id}` : "—") },
    { key: "subscription_id", label: "Subscription ID", render: (s) => <span className="font-mono text-xs">{s.subscription_id}</span> },
    { key: "subscription_name", label: "Nombre", render: (s) => s.subscription_name || "—" },
    { key: "is_active", label: "Estado", render: (s) => chip(s.is_active ? OK : NEUTRAL, s.is_active ? "Activa" : "Inactiva") },
    { key: "is_managed", label: "Administrada", render: (s) => chip(s.is_managed ? OK : NEUTRAL, s.is_managed ? "Sí" : "No") },
    { key: "last_synced_at", label: "Última sync", render: (s) => (s.last_synced_at || "").slice(0, 16) || "—" },
    { key: "acc", label: "", render: (s) => (
      <div className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Acciones" disabled={!isAdmin}><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => toggleSub(s)}>{s.is_managed ? "Excluir (no administrar)" : "Marcar administrada"}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ) },
  ];

  return (
    <AppShell title="Credenciales Azure" subtitle="Administración · App Registrations y suscripciones por cliente"
      active="credenciales" onNavigate={onNavigate}
      headerRight={<WafClientHeader clients={clients} clientId={clientId} onSelect={selectClient} />}>
      <BusyOverlay
        show={loading || busy !== ""}
        title={
          busy === "sync" ? "Sincronizando suscripciones"
          : busy.startsWith("test-") ? "Probando conexión"
          : busy.startsWith("upd-") ? "Actualizando credencial"
          : busy.startsWith("sub-") ? "Actualizando suscripción"
          : "Cargando"
        }
      />
      {!isAdmin ? (
        <p className="text-sm text-muted-foreground">Esta sección es solo para administradores.</p>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Credenciales</h2>
              <Button size="sm" disabled={clientId == null} onClick={() => setFormOpen(true)}><Plus className="w-4 h-4 mr-1" />Nueva credencial</Button>
            </div>
            <SimpleTable cols={credCols} rows={creds} empty="Este cliente no tiene credenciales registradas." />
            <p className="text-xs text-muted-foreground border-l-2 border-border pl-3">El secreto (client secret) se guarda cifrado en Key Vault y nunca se muestra. Toda alta o rotación se valida contra Azure.</p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Suscripciones</h2>
              <Button size="sm" variant="outline" disabled={clientId == null || busy === "sync"} onClick={sync}>
                <RefreshCw className={`w-4 h-4 mr-1 ${busy === "sync" ? "animate-spin" : ""}`} />Sincronizar
              </Button>
            </div>
            <SimpleTable cols={subCols} rows={subs} empty="Sin suscripciones. Usa Sincronizar para importarlas desde Azure." />
            <p className="text-xs text-muted-foreground border-l-2 border-border pl-3">Las suscripciones no administradas se excluyen de importaciones de inventario, costos e informes.</p>
          </section>
        </div>
      )}
      {clientId != null && <CredentialFormDialog clientId={clientId} open={formOpen} onOpenChange={setFormOpen} onSaved={() => reload(clientId)} />}
      <RotateSecretDialog credential={rotate} open={rotate != null} onOpenChange={(o) => !o && setRotate(null)} onSaved={() => clientId != null && reload(clientId)} />
      <CredentialAuditSheet credential={audit} open={audit != null} onOpenChange={(o) => !o && setAudit(null)} />
    </AppShell>
  );
}
