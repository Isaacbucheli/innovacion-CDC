import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchInput from "@/components/SearchInput";
import { getLighthouseClients, linkLighthouseSelection, listClientsAdmin } from "@/lib/api";
import { filterGroups, selectedCount, toggleGroup, toggleSubscription } from "@/lib/lighthouse";
import type { ClientAdmin, LighthouseClientGroup } from "@/types";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

/**
 * Selector de clientes delegados (Lighthouse), agrupados por tenant/cliente, con
 * checkboxes por suscripción y vinculación a un cliente de la plataforma (nuevo o existente).
 * La selección solo puede abarcar UN tenant porque el link (credencial) es por tenant.
 */
export default function LighthouseClientPicker({ open, onOpenChange, onLinked, onSessionLost }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Recibe el client_id vinculado: quien lo use decide si le corresponde recargar
   * (ver Finding 2 — el link puede apuntar a un cliente distinto al que se está viendo). */
  onLinked: (linkedClientId: number) => void;
  /** Se dispara cuando la carga de clientes delegados falla (típicamente sesión
   * expirada, 409) para que el llamador pueda re-probar el estado de la tarjeta
   * de conexión y dejar de mostrar "Conectado como…" con acciones muertas. */
  onSessionLost?: () => void;
}) {
  const [groups, setGroups] = useState<LighthouseClientGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [term, setTerm] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [destMode, setDestMode] = useState<"new" | "existing">("new");
  const [newName, setNewName] = useState("");
  const [platformClients, setPlatformClients] = useState<ClientAdmin[]>([]);
  const [existingClientId, setExistingClientId] = useState<string>("");
  const [linking, setLinking] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  function load(refresh: boolean) {
    (refresh ? setRefreshing : setLoading)(true);
    getLighthouseClients(refresh)
      .then((gs) => { if (mounted.current) setGroups(gs); })
      .catch((e) => {
        // El único fallo esperado al abrir es la sesión Azure expirada (409): el
        // backend no distingue el código en el cuerpo, así que ante cualquier error
        // de carga tratamos igual — avisamos y cerramos (no hay nada más que mostrar).
        toast.error(msg(e) || "Sesión expirada, vuelve a conectar");
        if (mounted.current) { onOpenChange(false); onSessionLost?.(); }
      })
      .finally(() => { if (mounted.current) { setLoading(false); setRefreshing(false); } });
  }

  useEffect(() => {
    if (!open) return;
    setTerm(""); setSel(new Set()); setDestMode("new"); setNewName(""); setExistingClientId("");
    load(false);
    listClientsAdmin().then((cs) => { if (mounted.current) setPlatformClients(cs); }).catch(() => { /* select queda vacío */ });
  }, [open]);

  const filtered = filterGroups(groups, term);
  const count = selectedCount(sel);

  // Tenants presentes en la selección actual (derivado de sel + groups).
  const selectedTenants = [...new Set(
    groups.filter((g) => g.subscriptions.some((s) => sel.has(s.subscription_id))).map((g) => g.tenant_id),
  )];
  const multiTenant = selectedTenants.length > 1;
  const tenantId = selectedTenants.length === 1 ? selectedTenants[0] : null;
  const selectedGroup = tenantId ? groups.find((g) => g.tenant_id === tenantId) ?? null : null;

  useEffect(() => {
    if (destMode === "new" && selectedGroup && !newName) setNewName(selectedGroup.client_name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup?.tenant_id]);

  function onToggleGroup(g: LighthouseClientGroup) { setSel((prev) => toggleGroup(prev, g)); }
  function onToggleSub(id: string) { setSel((prev) => toggleSubscription(prev, id)); }

  const destOk = destMode === "new" ? newName.trim().length > 0 : existingClientId !== "";
  const canConfirm = count > 0 && !multiTenant && tenantId != null && destOk;

  async function confirm() {
    if (!canConfirm || !tenantId) return;
    const subscriptions = groups
      .flatMap((g) => g.subscriptions)
      .filter((s) => sel.has(s.subscription_id))
      .map((s) => ({ subscription_id: s.subscription_id, display_name: s.display_name ?? null }));
    setLinking(true);
    try {
      const result = await linkLighthouseSelection({
        tenant_id: tenantId,
        subscriptions,
        ...(destMode === "new" ? { new_client_name: newName.trim() } : { client_id: Number(existingClientId) }),
      });
      toast.success("Cliente vinculado — ya puedes importar inventario y calcular");
      onOpenChange(false);
      onLinked(result.client_id);
    } catch (e) { toast.error(msg(e)); }
    finally { if (mounted.current) setLinking(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!linking) onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" busy={linking}>
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle>Elegir clientes delegados</DialogTitle>
            <Button size="sm" variant="outline" disabled={loading || refreshing} onClick={() => load(true)}>
              <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />Actualizar
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <SearchInput placeholder="Buscar cliente o suscripción…" value={term} onChange={setTerm} />

          {loading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-10">
              <Loader2 className="w-4 h-4 animate-spin" />Cargando clientes delegados…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground border rounded-xl px-4 py-6 text-center">
              {groups.length === 0 ? "No hay clientes delegados disponibles para esta cuenta." : "Sin coincidencias con el filtro."}
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-xl border divide-y">
              {filtered.map((g) => {
                const ids = g.subscriptions.map((s) => s.subscription_id);
                const allChecked = ids.length > 0 && ids.every((id) => sel.has(id));
                return (
                  <div key={g.tenant_id} className="p-3 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-primary h-4 w-4 shrink-0"
                        checked={allChecked}
                        ref={(el) => { if (el) el.indeterminate = !allChecked && ids.some((id) => sel.has(id)); }}
                        onChange={() => onToggleGroup(g)}
                      />
                      <span className="font-medium truncate">{g.client_name}</span>
                      <Badge variant="secondary" className="shrink-0">{g.subscriptions.length} subs</Badge>
                      <span className="text-xs text-muted-foreground font-mono shrink-0" title={g.tenant_id}>
                        {g.tenant_id.slice(0, 8)}
                      </span>
                    </label>
                    <div className="pl-6 space-y-1">
                      {g.subscriptions.map((s) => (
                        <label key={s.subscription_id} className="flex items-center gap-2 px-1 py-1 text-sm cursor-pointer hover:bg-accent rounded">
                          <input
                            type="checkbox"
                            className="accent-primary h-4 w-4 shrink-0"
                            checked={sel.has(s.subscription_id)}
                            onChange={() => onToggleSub(s.subscription_id)}
                          />
                          <span className="truncate">{s.display_name || s.subscription_id}</span>
                          <span className="text-xs text-muted-foreground font-mono truncate">{s.subscription_id}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {multiTenant && (
            <p className="text-sm text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 rounded-lg px-3 py-2">
              La selección abarca más de un tenant. El vínculo es por tenant: elige suscripciones de un solo cliente delegado.
            </p>
          )}

          <div className="space-y-3 border-t pt-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="dest-mode" className="accent-primary" checked={destMode === "new"} onChange={() => setDestMode("new")} />
                Cliente nuevo
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="dest-mode" className="accent-primary" checked={destMode === "existing"} onChange={() => setDestMode("existing")} />
                Cliente existente
              </label>
            </div>
            {destMode === "new" ? (
              <div className="space-y-1">
                <Label htmlFor="lh-new-name">Nombre del cliente</Label>
                <Input id="lh-new-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre del cliente" />
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="lh-existing">Cliente de la plataforma</Label>
                <Select value={existingClientId} onValueChange={setExistingClientId}>
                  <SelectTrigger id="lh-existing"><SelectValue placeholder="Selecciona un cliente…" /></SelectTrigger>
                  <SelectContent>
                    {platformClients.map((c) => (
                      <SelectItem key={c.client_id} value={String(c.client_id)}>{c.client_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={linking}>Cancelar</Button>
          <Button onClick={confirm} disabled={!canConfirm || linking}>
            {linking ? "Vinculando…" : `Vincular ${count} suscripciones`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
