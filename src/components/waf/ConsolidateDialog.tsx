import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function ConsolidateDialog({ open, busy, onOpenChange, onConfirm }: {
  open: boolean; busy?: boolean; onOpenChange: (o: boolean) => void; onConfirm: (useAi: boolean) => void;
}) {
  const [useAi, setUseAi] = useState(true);
  useEffect(() => { if (open) setUseAi(true); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Consolidar duplicados</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Detecta y fusiona recomendaciones equivalentes de este cliente. La acción no se puede deshacer fácilmente.</p>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
          Usar IA para agrupar (Azure OpenAI)
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={busy} onClick={() => onConfirm(useAi)}>Consolidar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
