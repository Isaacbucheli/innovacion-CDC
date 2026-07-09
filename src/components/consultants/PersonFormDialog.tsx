import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Person, PersonType } from "@/types";
import { createPerson, updatePerson } from "@/lib/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Select nativo con el estilo del app (patrón de ColumnFilterPopover).
const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const PERSON_TYPES: { value: PersonType; label: string }[] = [
  { value: "consultor", label: "Consultor" },
  { value: "coordinador", label: "Coordinador" },
  { value: "comercial", label: "Comercial" },
];
export function personTypeLabel(t: string) { return PERSON_TYPES.find((x) => x.value === t)?.label ?? t; }
function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

// Alta/edición de personas del directorio BIT (mismo patrón que UserFormDialog).
export default function PersonFormDialog({ person, open, onOpenChange, onSaved }: {
  person: Person | null; // null = crear
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const editing = person != null;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [personType, setPersonType] = useState<PersonType>("consultor");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (person) {
      setName(person.name); setEmail(person.email ?? "");
      setPersonType(person.person_type); setIsActive(person.is_active);
    } else {
      setName(""); setEmail(""); setPersonType("consultor"); setIsActive(true);
    }
  }, [open, person]);

  async function save() {
    if (!name.trim()) { toast.error("El nombre es obligatorio."); return; }
    if (name.trim().length > 200) { toast.error("El nombre no puede exceder 200 caracteres."); return; }
    setSaving(true);
    const body = {
      name: name.trim(),
      email: email.trim() ? email.trim() : null,
      person_type: personType,
      ...(editing ? { is_active: isActive } : {}),
    };
    try {
      if (editing) {
        await updatePerson(person!.person_id, body);
        toast.success("Persona actualizada.");
      } else {
        await createPerson(body);
        toast.success("Persona creada.");
      }
      onOpenChange(false); onSaved();
    } catch (e) { toast.error(msg(e)); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" busy={saving}>
        <DialogHeader><DialogTitle>{editing ? "Editar persona" : "Nueva persona"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pn">Nombre</Label>
            <Input id="pn" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pe">Correo</Label>
            <Input id="pe" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@grupobusiness.it" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pt">Tipo</Label>
            <select id="pt" className={selectClass} value={personType} onChange={(e) => setPersonType(e.target.value as PersonType)}>
              {PERSON_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-primary h-4 w-4" />
              Persona activa
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : editing ? "Guardar" : "Crear persona"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
