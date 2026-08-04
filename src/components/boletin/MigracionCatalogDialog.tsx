import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ConfirmDelete from "@/components/ConfirmDelete";
import { createMigracionEntry, deleteMigracionEntry, getMigracionCatalogo, updateMigracionEntry } from "@/lib/api";
import type { MigracionEntry } from "@/types";
import { toast } from "sonner";

/** Gestión del catálogo global de rutas de migración (solo Edit del módulo boletin).
 *  Calca de LifecycleCatalogDialog.tsx, incluido el fix de arrastre de estado.
 *  Convención de estado: undefined = form cerrado, null = crear, objeto = editar. */
export default function MigracionCatalogDialog({ open, onOpenChange, onChanged, draft }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** El caller re-sincroniza/recarga cuando el catálogo cambió. */
  onChanged?: () => void;
  /** Prefill para crear una ruta a partir de una sugerencia de IA ("Revisar y guardar" en
   *  MigracionTab): al abrir con un draft, entra directo al form de creación con estos valores. */
  draft?: Partial<MigracionEntry>;
}) {
  const [entries, setEntries] = useState<MigracionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<MigracionEntry | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<MigracionEntry | undefined>(undefined);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setEntries(await getMigracionCatalogo()); }
    catch { toast.error("No se pudo cargar el catálogo de rutas."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!open) return;
    void reload();
    // Si se abre con una sugerencia para revisar, entra directo al form de creación prefilled;
    // si no, muestra la lista (comportamiento por defecto del catálogo).
    setForm(draft ? null : undefined);
  }, [open, reload, draft]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Catálogo de rutas de migración</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Global para todos los clientes. El patrón se compara (en minúsculas, por contiene) contra el
          título del anuncio (Advisor/Service Health); entre patrones que coincidan gana el más largo.
        </p>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setForm(null)}><Plus className="mr-1.5 h-3.5 w-3.5" />Nueva ruta</Button>
        </div>
        <div className="max-h-96 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60">
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Desde → Hacia</th>
                <th className="px-3 py-2 font-semibold">Patrón</th>
                <th className="px-3 py-2 font-semibold">Notas</th>
                <th className="px-3 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Cargando…</td></tr>
              ) : entries.map((e) => (
                <tr key={e.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span>{e.desde}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{e.hacia}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{e.match_pattern}</td>
                  <td className="max-w-64 truncate px-3 py-2 text-xs text-muted-foreground" title={e.notas}>{e.notas}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" aria-label={`Editar ${e.clave}`} onClick={() => setForm(e)}>
                      <Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" aria-label={`Eliminar ${e.clave}`} onClick={() => setToDelete(e)}>
                      <Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {form !== undefined ? (
          // key obligatorio: MigracionForm siembra su estado con useState(entry ?? draft) SOLO al
          // montar. Sin key, al pasar de Editar A -> Editar B (sin cerrar el form) React reutiliza
          // la misma instancia y el estado se queda con los valores de A; "Guardar" mandaría
          // updateMigracionEntry(B.id, valores de A) y corrompería el catálogo GLOBAL en silencio.
          // El key (id de la entrada, o "new" al crear) fuerza a React a desmontar/remontar el
          // form cada vez que cambia el objetivo de edición. Mismo bug/fix que LifecycleCatalogDialog.
          <MigracionForm
            key={form === null ? "new" : form.id}
            entry={form}
            draft={form === null ? draft : undefined}
            onClose={() => setForm(undefined)}
            onSaved={() => { setForm(undefined); void reload(); onChanged?.(); }}
          />
        ) : null}
        <ConfirmDelete
          open={toDelete !== undefined}
          label={toDelete ? `${toDelete.desde} → ${toDelete.hacia}` : ""}
          onOpenChange={(o) => { if (!o) setToDelete(undefined); }}
          title={toDelete ? `Desactivar "${toDelete.desde} → ${toDelete.hacia}"` : undefined}
          description="La ruta se desactiva (no se borra); crear la misma clave de nuevo la reactiva."
          onConfirm={async () => {
            if (!toDelete) return;
            try { await deleteMigracionEntry(toDelete.id); toast.success("Ruta desactivada."); void reload(); onChanged?.(); }
            catch { toast.error("No se pudo desactivar."); }
            finally { setToDelete(undefined); }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function MigracionForm({ entry, draft, onClose, onSaved }: {
  entry: MigracionEntry | null;
  draft?: Partial<MigracionEntry>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState<Partial<MigracionEntry>>(entry ?? draft ?? {});
  const set = (k: keyof MigracionEntry) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    if (!v.clave || !v.desde || !v.hacia || !v.match_pattern || !v.notas) {
      toast.error("Completa clave, desde, hacia, patrón y notas.");
      return;
    }
    setBusy(true);
    // Solo los campos editables del form: v puede traer "id"/"is_active" sembrados desde
    // `entry` (ver useState de arriba) y el backend no debe recibir campos de sistema en el PUT/POST.
    const payload = {
      clave: v.clave,
      desde: v.desde,
      hacia: v.hacia,
      notas: v.notas,
      match_pattern: v.match_pattern,
      learn_more_url: v.learn_more_url,
    };
    try {
      if (entry) await updateMigracionEntry(entry.id, payload);
      else await createMigracionEntry(payload);
      toast.success(entry ? "Ruta actualizada." : "Ruta creada.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="mc-clave">Clave</Label>
          <Input id="mc-clave" value={v.clave ?? ""} onChange={set("clave")} disabled={!!entry} placeholder="basic-ip-a-standard-ip" /></div>
        <div><Label htmlFor="mc-pat">Patrón (minúsculas, contiene, sobre el título del anuncio)</Label>
          <Input id="mc-pat" value={v.match_pattern ?? ""} onChange={set("match_pattern")} placeholder="basic sku public ip" /></div>
        <div><Label htmlFor="mc-desde">Desde</Label>
          <Input id="mc-desde" value={v.desde ?? ""} onChange={set("desde")} placeholder="IP pública Basic SKU" /></div>
        <div><Label htmlFor="mc-hacia">Hacia</Label>
          <Input id="mc-hacia" value={v.hacia ?? ""} onChange={set("hacia")} placeholder="IP pública Standard SKU" /></div>
      </div>
      <div><Label htmlFor="mc-notas">Notas</Label>
        <Textarea id="mc-notas" rows={3} value={v.notas ?? ""} onChange={set("notas")} /></div>
      <div><Label htmlFor="mc-url">Enlace (opcional)</Label>
        <Input id="mc-url" value={v.learn_more_url ?? ""} onChange={set("learn_more_url")} placeholder="https://learn.microsoft.com/..." /></div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button onClick={() => void submit()} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
      </DialogFooter>
    </div>
  );
}
