import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function AdvisorScoreDialog({ open, busy, allClients, onOpenChange, onConfirm }: {
  open: boolean; busy?: boolean; allClients?: boolean; onOpenChange: (o: boolean) => void; onConfirm: (includeInReports: boolean) => void;
}) {
  const [include, setInclude] = useState(false);
  useEffect(() => { if (open) setInclude(false); }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-md" busy={busy}>
        <DialogHeader><DialogTitle>Actualizar Advisor Score{allClients ? " · todos los clientes" : ""}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          {allClients
            ? "Recalcula el Advisor Score de TODOS los clientes activos consultando Azure. Puede tardar varios minutos."
            : "Recalcula el Advisor Score del cliente consultando Azure. Puede tardar según el número de suscripciones."}
        </p>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={include} onChange={(e) => setInclude(e.target.checked)} />
          Incluir en informes
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={busy} onClick={() => onConfirm(include)}>{busy ? "Actualizando…" : "Actualizar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
