import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { listClientSubscriptions } from "@/lib/api";
import type { ClientSubscription } from "@/types";

export default function AdvisorSyncDialog({ open, clientId, busy, onOpenChange, onConfirm }: {
  open: boolean; clientId: number; busy?: boolean;
  onOpenChange: (o: boolean) => void; onConfirm: (subscriptionIds: string[]) => void;
}) {
  const [subs, setSubs] = useState<ClientSubscription[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listClientSubscriptions(clientId)
      .then((all) => {
        const usable = all.filter((s) => s.is_active && s.is_managed);
        setSubs(usable);
        setSelected(usable.map((s) => s.subscription_id));
      })
      .catch(() => { setSubs([]); setSelected([]); })
      .finally(() => setLoading(false));
  }, [open, clientId]);

  const toggle = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Consultar Advisor</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Elige las suscripciones a sincronizar con Azure Advisor.</p>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Cargando suscripciones…</p>
        ) : subs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No hay suscripciones administradas para este cliente.</p>
        ) : (
          <div className="grid gap-1.5 my-1 max-h-64 overflow-y-auto">
            {subs.map((s) => (
              <label key={s.client_subscription_id} className="flex items-center gap-2 text-sm cursor-pointer rounded-md border p-2 hover:bg-secondary">
                <input type="checkbox" checked={selected.includes(s.subscription_id)} onChange={() => toggle(s.subscription_id)} />
                <span className="truncate flex-1">{s.subscription_name ?? s.subscription_id}</span>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={selected.length === 0 || busy} onClick={() => onConfirm(selected)}>Consultar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
