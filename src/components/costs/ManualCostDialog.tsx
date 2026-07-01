import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { setManualCost } from "@/lib/api";
import type { CostResult } from "@/types";

export default function ManualCostDialog({
  row,
  open,
  onOpenChange,
  onSaved,
}: {
  row: CostResult | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && row) {
      setError("");
      setCost(row.manual_monthly_cost != null ? String(row.manual_monthly_cost) : "");
      setNote(row.manual_cost_note ?? "");
    }
  }, [open, row]);

  async function save() {
    if (!row) return;
    setBusy(true);
    setError("");
    try {
      const value = cost.trim() === "" ? null : Number(cost);
      if (value !== null && !Number.isFinite(value)) throw new Error("El costo debe ser un número válido.");
      await setManualCost(row.cost_result_id, { manual_monthly_cost: value, manual_cost_note: note.trim() || null });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" busy={busy}>
        <DialogHeader>
          <DialogTitle>Costo manual</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{row?.resource_name ?? ""}</p>
        <div className="space-y-1.5">
          <Label htmlFor="manualCost">Costo mensual (USD)</Label>
          <Input
            id="manualCost"
            type="number"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="Vacío = quitar el costo manual"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manualNote">Nota</Label>
          <Textarea id="manualNote" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
