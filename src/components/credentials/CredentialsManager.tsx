import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";
import BusyOverlay from "@/components/BusyOverlay";
import CredentialFormDialog from "@/components/credentials/CredentialFormDialog";
import RotateSecretDialog from "@/components/credentials/RotateSecretDialog";
import CredentialAuditSheet from "@/components/credentials/CredentialAuditSheet";
import DataTablePagination from "@/components/DataTablePagination";
import { Button } from "@/components/ui/button";
import { usePagedRows } from "@/hooks/usePagedRows";
import {
  listCredentials, listClientSubscriptions, testCredential, updateCredential,
  updateSubscription, syncSubscriptions,
} from "@/lib/api";
import { getRole } from "@/lib/auth";
import { fmtDateISO } from "@/lib/dates";
import type { Credential, ClientSubscription } from "@/types";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }
const chip = (cls: string, text: React.ReactNode) => <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{text}</span>;
const OK = "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200";
const BAD = "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
const NEUTRAL = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";

/**
 * Gestor de credenciales + suscripciones para un cliente fijo. Reúne todo lo que
 * antes vivía en la página "Credenciales Azure", pero sin AppShell ni selector de
 * cliente: se monta dentro del detalle del cliente (ver ClientCredentialsDialog).
 * Layout en tarjetas/filas (no tabla ancha) para que quepa sin scroll horizontal;
 * acciones en botones en línea (no dropdown), evitando que el menú se salga del panel.
 */
export default function CredentialsManager({ clientId }: { clientId: number }) {
  const isAdmin = getRole() === "admin";
  const [creds, setCreds] = useState<Credential[]>([]);
  const [subs, setSubs] = useState<ClientSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [rotate, setRotate] = useState<Credential | null>(null);
  const [audit, setAudit] = useState<Credential | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([listCredentials(clientId), listClientSubscriptions(clientId)])
      .then(([c, s]) => { if (mounted.current) { setCreds(c); setSubs(s); } })
      .catch((e) => toast.error(msg(e)))
      .finally(() => { if (mounted.current) setLoading(false); });
  }, [clientId]);
  useEffect(() => { reload(); }, [reload]);

  async function testCred(c: Credential) {
    setBusy(`test-${c.credential_id}`);
    try {
      const r = await testCredential(c.credential_id);
      if (r.success) toast.success(`${c.credential_name}: autenticación correcta.`);
      else toast.error(`${c.credential_name}: ${r.error ?? "falló la autenticación"}`);
      reload();
    } catch (e) { toast.error(msg(e)); } finally { setBusy(""); }
  }
  async function toggleCred(c: Credential) {
    setBusy(`upd-${c.credential_id}`);
    try {
      await updateCredential(c.credential_id, { is_active: !c.is_active });
      toast.success(c.is_active ? "Credencial desactivada." : "Credencial activada.");
      reload();
    } catch (e) { toast.error(msg(e)); } finally { setBusy(""); }
  }
  async function toggleSub(s: ClientSubscription) {
    setBusy(`sub-${s.client_subscription_id}`);
    try {
      await updateSubscription(s.client_subscription_id, { is_managed: !s.is_managed });
      toast.success(s.is_managed ? "Suscripción excluida." : "Suscripción marcada como administrada.");
      reload();
    } catch (e) { toast.error(msg(e)); } finally { setBusy(""); }
  }
  async function sync() {
    setBusy("sync");
    try {
      const r = await syncSubscriptions(clientId);
      toast.success(`Sincronizado — nuevas: ${r.created}, actualizadas: ${r.updated}, inactivas: ${r.deactivated}.`);
      if (r.errors?.length) toast.error(`${r.errors.length} credencial(es) con error al sincronizar.`);
      reload();
    } catch (e) { toast.error(msg(e)); } finally { setBusy(""); }
  }

  const credPages = usePagedRows(creds);
  const subPages = usePagedRows(subs);

  const field = (label: string, value: string) => (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-xs truncate" title={value}>{value}</div>
    </div>
  );

  return (
    <>
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
      <div className="space-y-8">
        {/* Credenciales */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Credenciales</h3>
            <Button size="sm" onClick={() => setFormOpen(true)}><Plus className="w-4 h-4 mr-1" />Nueva credencial</Button>
          </div>
          {creds.length === 0 ? (
            <p className="text-sm text-muted-foreground border rounded-xl px-4 py-6 text-center">Este cliente no tiene credenciales registradas.</p>
          ) : (
            <div className="space-y-3">
              {credPages.pageRows.map((c) => (
                <div key={c.credential_id} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate" title={c.credential_name}>{c.credential_name}</div>
                      <div className="text-[11px] text-muted-foreground">ID {c.credential_id}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {chip(c.is_active ? OK : NEUTRAL, c.is_active ? "Activa" : "Inactiva")}
                      {chip(c.last_validation_status === "success" ? OK : c.last_validation_status ? BAD : NEUTRAL, c.last_validation_status ?? "sin validar")}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {field("Tenant ID", c.tenant_id)}
                    {field("App Client ID", c.app_client_id)}
                  </div>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => testCred(c)}>Probar conexión</Button>
                      <Button size="sm" variant="outline" onClick={() => setRotate(c)}>Rotar secreto</Button>
                      <Button size="sm" variant="outline" onClick={() => toggleCred(c)}>{c.is_active ? "Desactivar" : "Activar"}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAudit(c)}>Historial</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {creds.length > 0 && <DataTablePagination table={credPages.table} />}
          <p className="text-xs text-muted-foreground border-l-2 border-border pl-3">El secreto (client secret) se guarda cifrado en Key Vault y nunca se muestra. Toda alta o rotación se valida contra Azure.</p>
        </section>

        {/* Suscripciones */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Suscripciones</h3>
            <Button size="sm" variant="outline" disabled={busy === "sync"} onClick={sync}>
              <RefreshCw className={`w-4 h-4 mr-1 ${busy === "sync" ? "animate-spin" : ""}`} />Sincronizar
            </Button>
          </div>
          {subs.length === 0 ? (
            <p className="text-sm text-muted-foreground border rounded-xl px-4 py-6 text-center">Sin suscripciones. Usa Sincronizar para importarlas desde Azure.</p>
          ) : (
            <div className="rounded-xl border divide-y">
              {subPages.pageRows.map((s) => (
                <div key={s.client_subscription_id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate" title={s.subscription_name ?? undefined}>{s.subscription_name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground truncate" title={s.subscription_id}>{s.subscription_id}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {[
                        s.credential_name || (s.credential_id ? `#${s.credential_id}` : ""),
                        s.last_synced_at ? `sync ${fmtDateISO(s.last_synced_at)}` : "",
                      ].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {chip(s.is_active ? OK : NEUTRAL, s.is_active ? "Activa" : "Inactiva")}
                    {chip(s.is_managed ? OK : NEUTRAL, s.is_managed ? "Administrada" : "No adm.")}
                  </div>
                  {isAdmin && (
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => toggleSub(s)}>
                      {s.is_managed ? "Excluir" : "Administrar"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {subs.length > 0 && <DataTablePagination table={subPages.table} />}
          <p className="text-xs text-muted-foreground border-l-2 border-border pl-3">Las suscripciones no administradas se excluyen de importaciones de inventario, costos e informes.</p>
        </section>
      </div>
      <CredentialFormDialog clientId={clientId} open={formOpen} onOpenChange={setFormOpen} onSaved={reload} />
      <RotateSecretDialog credential={rotate} open={rotate != null} onOpenChange={(o) => !o && setRotate(null)} onSaved={reload} />
      <CredentialAuditSheet credential={audit} open={audit != null} onOpenChange={(o) => !o && setAudit(null)} />
    </>
  );
}
