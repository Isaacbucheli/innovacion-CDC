import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getWafSecurityManagement, setWafSecurityManagement } from "@/lib/api";

// Toggle por cliente: si la seguridad se gestiona con el servicio de Gestión de Vulnerabilidades,
// se oculta el conteo de recomendaciones de Seguridad (el score se mantiene) y se excluyen de
// tabla, KPIs, Excel e informe mensual. La nota es editable.
export default function SecurityManagementDialog({ clientId, open, onOpenChange, onChanged }: {
  clientId: number; open: boolean; onOpenChange: (o: boolean) => void; onChanged: () => void;
}) {
  const [managed, setManaged] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getWafSecurityManagement(clientId)
      .then((r) => { setManaged(r.managed_externally); setNote(r.note ?? ""); })
      .catch(() => toast.error("No se pudo leer la configuración."))
      .finally(() => setLoading(false));
  }, [open, clientId]);

  async function save() {
    setSaving(true);
    try {
      await setWafSecurityManagement(clientId, managed, note);
      toast.success("Configuración de seguridad guardada.");
      onChanged();
      onOpenChange(false);
    } catch (e) {
      toast.error(`Error al guardar: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gestión de Vulnerabilidades</DialogTitle>
          <DialogDescription>
            Si la seguridad de este cliente se atiende con el servicio de Gestión de Vulnerabilidades,
            actívalo para ocultar el conteo de recomendaciones de Seguridad (el score se mantiene) y
            excluirlas de la tabla, las KPIs, el Excel y el informe mensual.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={managed} disabled={loading}
              onChange={(e) => setManaged(e.target.checked)} />
            Seguridad gestionada externamente
          </label>
          <div className="space-y-1">
            <Label htmlFor="sec-note">Nota mostrada en la tarjeta</Label>
            <Textarea id="sec-note" rows={3} value={note} disabled={loading || !managed}
              placeholder="Controles de seguridad revisados por el servicio de Gestión de Vulnerabilidades."
              onChange={(e) => setNote(e.target.value)} maxLength={1000} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving || loading}>{saving ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
