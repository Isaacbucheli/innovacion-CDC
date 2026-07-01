import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listClientsAdmin, getUserClients, setUserClients } from "@/lib/api";
import type { PublicUser, ClientAdmin } from "@/types";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

// Asigna a qué clientes tiene acceso un usuario consultor/lector.
export default function UserClientsDialog({ user, open, onOpenChange }: {
  user: PublicUser | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [clients, setClients] = useState<ClientAdmin[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true); setQ("");
    Promise.all([listClientsAdmin(), getUserClients(user.user_id)])
      .then(([cs, a]) => { setClients(cs); setSelected(new Set(a.client_ids ?? [])); })
      .catch((e) => toast.error(msg(e)))
      .finally(() => setLoading(false));
  }, [open, user]);

  function toggle(id: number) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      await setUserClients(user.user_id, [...selected]);
      toast.success("Acceso a clientes actualizado.");
      onOpenChange(false);
    } catch (e) { toast.error(msg(e)); }
    finally { setSaving(false); }
  }

  const filtered = clients.filter((c) => c.client_name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Acceso a clientes{user ? ` · ${user.full_name}` : ""}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Buscar cliente…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9" />
          <div className="max-h-72 overflow-y-auto rounded-lg border divide-y">
            {loading ? (
              <p className="text-sm text-muted-foreground p-3">Cargando…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3">Sin clientes.</p>
            ) : filtered.map((c) => (
              <label key={c.client_id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent">
                <input type="checkbox" checked={selected.has(c.client_id)} onChange={() => toggle(c.client_id)} className="accent-primary h-4 w-4" />
                {c.client_name}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{selected.size} cliente(s) seleccionado(s).</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving || loading}>{saving ? "Guardando…" : "Guardar acceso"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
