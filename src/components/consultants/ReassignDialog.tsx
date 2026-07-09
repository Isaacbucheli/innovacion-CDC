import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Person, ReassignScope } from "@/types";
import { reassignPerson } from "@/lib/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Select nativo con el estilo del app (patrón de ColumnFilterPopover).
const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SCOPES: { value: ReassignScope; label: string }[] = [
  { value: "principal", label: "Principal" },
  { value: "backup", label: "Backup" },
  { value: "coordinador", label: "Coordinador" },
  { value: "comercial", label: "Comercial" },
];

const ALL_SCOPES: ReassignScope[] = SCOPES.map((s) => s.value);

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

/**
 * Reasignación masiva: reemplaza a la persona origen por la destino en todas sus
 * asignaciones activas según el alcance elegido (default: todos los roles).
 */
export default function ReassignDialog({ open, people, onOpenChange, onDone }: {
  open: boolean;
  people: Person[];
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [scopes, setScopes] = useState<Set<ReassignScope>>(new Set(ALL_SCOPES));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFromId(""); setToId(""); setScopes(new Set(ALL_SCOPES));
  }, [open]);

  const from = useMemo(() => people.find((p) => String(p.person_id) === fromId) ?? null, [people, fromId]);
  // Destino: mismo tipo que la persona origen, activa y distinta de la origen.
  const targets = useMemo(
    () => (from
      ? people.filter((p) => p.person_type === from.person_type && p.is_active && p.person_id !== from.person_id)
      : []),
    [people, from],
  );

  function toggleScope(s: ReassignScope) {
    setScopes((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  async function confirm() {
    if (!from || !toId) { toast.error("Selecciona la persona origen y la destino."); return; }
    if (scopes.size === 0) { toast.error("Selecciona al menos un alcance."); return; }
    setSaving(true);
    try {
      const r = await reassignPerson(from.person_id, {
        to_person_id: Number(toId),
        scopes: ALL_SCOPES.filter((s) => scopes.has(s)),
      });
      toast.success(`${r.message} (${r.changed_assignments} asignación(es) actualizada(s)).`);
      onOpenChange(false);
      onDone();
    } catch (e) { toast.error(msg(e)); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-md" busy={saving}>
        <DialogHeader><DialogTitle>Reasignar persona</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="reassign-from">Persona origen</Label>
            <select
              id="reassign-from"
              className={selectClass}
              value={fromId}
              onChange={(e) => { setFromId(e.target.value); setToId(""); }}
            >
              <option value="">Seleccionar…</option>
              {people.map((p) => (
                <option key={p.person_id} value={p.person_id}>
                  {p.name} ({p.person_type}{p.is_active ? "" : ", inactiva"})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reassign-to">Persona destino</Label>
            <select
              id="reassign-to"
              className={selectClass}
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              disabled={!from}
            >
              <option value="">{from ? "Seleccionar…" : "Elige primero la persona origen"}</option>
              {targets.map((p) => <option key={p.person_id} value={p.person_id}>{p.name}</option>)}
            </select>
            {from && targets.length === 0 && (
              <p className="text-xs text-muted-foreground">No hay personas activas del mismo tipo para recibir la carga.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Alcance</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {SCOPES.map((s) => (
                <label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={scopes.has(s.value)}
                    onChange={() => toggleScope(s.value)}
                    className="accent-primary h-4 w-4"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Se reemplaza a la persona origen por la destino en sus asignaciones activas según el alcance. Si la destino ya está en la misma asignación y rol, se hace merge sin duplicar.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={confirm} disabled={saving || !fromId || !toId}>{saving ? "Reasignando…" : "Reasignar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
