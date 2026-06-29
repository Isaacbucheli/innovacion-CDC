import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function AdvisorScoreDialog({ open, busy, onOpenChange, onConfirm }: {
  open: boolean; busy?: boolean; onOpenChange: (o: boolean) => void; onConfirm: (includeInReports: boolean) => void;
}) {
  const [include, setInclude] = useState(false);
  useEffect(() => { if (open) setInclude(false); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Actualizar Advisor Score</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Recalcula el Advisor Score del cliente consultando Azure. Puede tardar según el número de suscripciones.</p>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={include} onChange={(e) => setInclude(e.target.checked)} />
          Incluir en informes
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={busy} onClick={() => onConfirm(include)}>Actualizar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
