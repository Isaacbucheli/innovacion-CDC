import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ConfirmDelete from "@/components/ConfirmDelete";
import { createLifecycle, deleteLifecycle, listLifecycle, updateLifecycle } from "@/lib/api";
import { fmtDate } from "@/components/boletin/boletinMeta";
import type { LifecycleEntry } from "@/types";
import { toast } from "sonner";

/** Gestión del catálogo global de fin de soporte (solo Edit del módulo boletin).
 *  Convención de estado: undefined = form cerrado, null = crear, objeto = editar. */
export default function LifecycleCatalogDialog({ open, onOpenChange, onChanged }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** El caller re-sincroniza/recarga cuando el catálogo cambió. */
  onChanged?: () => void;
}) {
  const [entries, setEntries] = useState<LifecycleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<LifecycleEntry | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<LifecycleEntry | undefined>(undefined);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setEntries(await listLifecycle()); }
    catch { toast.error("No se pudo cargar el catálogo."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) void reload(); }, [open, reload]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Catálogo de fin de soporte</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Global para todos los clientes. El patrón se compara (en minúsculas, por contiene) contra el SO
          reportado por la VM o la imagen SQL; entre patrones que coincidan gana el más largo.
        </p>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setForm(null)}><Plus className="mr-1.5 h-3.5 w-3.5" />Nueva entrada</Button>
        </div>
        <div className="max-h-96 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60">
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Producto</th>
                <th className="px-3 py-2 font-semibold">Patrón</th>
                <th className="px-3 py-2 font-semibold">Fin de soporte</th>
                <th className="px-3 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Cargando…</td></tr>
              ) : entries.map((e) => (
                <tr key={e.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2 font-medium">{e.producto}
                    <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">{e.categoria}</span></td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{e.match_pattern}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtDate(e.end_of_support)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" aria-label={`Editar ${e.producto}`} onClick={() => setForm(e)}>
                      <Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" aria-label={`Eliminar ${e.producto}`} onClick={() => setToDelete(e)}>
                      <Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {form !== undefined ? (
          <LifecycleForm
            entry={form}
            onClose={() => setForm(undefined)}
            onSaved={() => { setForm(undefined); void reload(); onChanged?.(); }}
          />
        ) : null}
        <ConfirmDelete
          open={toDelete !== undefined}
          label={toDelete?.producto ?? ""}
          onOpenChange={(o) => { if (!o) setToDelete(undefined); }}
          title={toDelete ? `Desactivar "${toDelete.producto}"` : undefined}
          description="La entrada se desactiva (no se borra); sus hallazgos se resolverán en la próxima sincronización."
          onConfirm={async () => {
            if (!toDelete) return;
            try { await deleteLifecycle(toDelete.id); toast.success("Entrada desactivada."); void reload(); onChanged?.(); }
            catch { toast.error("No se pudo desactivar."); }
            finally { setToDelete(undefined); }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function LifecycleForm({ entry, onClose, onSaved }: {
  entry: LifecycleEntry | null; onClose: () => void; onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState<Partial<LifecycleEntry>>(entry ?? {
    categoria: "so", match_field: "os_name", is_active: true,
  });
  const set = (k: keyof LifecycleEntry) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    if (!v.clave || !v.producto || !v.match_pattern || !v.end_of_support || !v.recomendacion) {
      toast.error("Completa clave, producto, patrón, fecha y recomendación.");
      return;
    }
    setBusy(true);
    try {
      if (entry) await updateLifecycle(entry.id, v);
      else await createLifecycle(v);
      toast.success(entry ? "Entrada actualizada." : "Entrada creada.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="lc-clave">Clave</Label>
          <Input id="lc-clave" value={v.clave ?? ""} onChange={set("clave")} disabled={!!entry} placeholder="windows-server-2016" /></div>
        <div><Label htmlFor="lc-prod">Producto</Label>
          <Input id="lc-prod" value={v.producto ?? ""} onChange={set("producto")} placeholder="Windows Server 2016" /></div>
        <div><Label htmlFor="lc-cat">Categoría</Label>
          <select id="lc-cat" className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={v.categoria ?? "so"} onChange={set("categoria")}>
            <option value="so">Sistema operativo</option><option value="bd">Base de datos</option>
          </select></div>
        <div><Label htmlFor="lc-field">Campo de match</Label>
          <select id="lc-field" className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={v.match_field ?? "os_name"} onChange={set("match_field")}>
            <option value="os_name">SO de la VM</option><option value="sql_image_offer">Imagen SQL</option>
          </select></div>
        <div><Label htmlFor="lc-pat">Patrón (minúsculas, contiene)</Label>
          <Input id="lc-pat" value={v.match_pattern ?? ""} onChange={set("match_pattern")} placeholder="windows server 2016" /></div>
        <div><Label htmlFor="lc-eos">Fin de soporte</Label>
          <Input id="lc-eos" type="date" value={v.end_of_support ?? ""} onChange={set("end_of_support")} /></div>
      </div>
      <div><Label htmlFor="lc-reco">Recomendación</Label>
        <Textarea id="lc-reco" rows={3} value={v.recomendacion ?? ""} onChange={set("recomendacion")} /></div>
      <div><Label htmlFor="lc-url">Enlace (opcional)</Label>
        <Input id="lc-url" value={v.learn_more_url ?? ""} onChange={set("learn_more_url")} placeholder="https://learn.microsoft.com/lifecycle/..." /></div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button onClick={() => void submit()} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
      </DialogFooter>
    </div>
  );
}
