import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/** Sanitiza el input de margen: vacío/no numérico → undefined; clamp a [0, 100]. */
function clampMarginPct(raw: string): number | undefined {
  const n = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(n)) return undefined;
  return Math.min(100, Math.max(0, n));
}

export default function ExcelExportDialog({
  open,
  onOpenChange,
  defaultMarginPct,
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultMarginPct: number;
  busy?: boolean;
  onConfirm: (marginPct?: number) => void;
}) {
  const [marginPct, setMarginPct] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (open) setMarginPct(defaultMarginPct > 0 ? defaultMarginPct : undefined);
  }, [open, defaultMarginPct]);

  function confirm() {
    onConfirm(marginPct && marginPct > 0 ? marginPct : undefined);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" busy={busy}>
        <DialogHeader>
          <DialogTitle>Exportar Excel</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Exportar Excel del análisis completo.</p>
        <div className="space-y-1.5">
          <Label htmlFor="excelMarginPct">Margen % (opcional)</Label>
          <Input
            id="excelMarginPct"
            type="number"
            min={0}
            max={100}
            step={1}
            placeholder="Sin margen"
            value={marginPct ?? ""}
            disabled={busy}
            onChange={(e) => setMarginPct(clampMarginPct(e.target.value))}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirm} disabled={busy}>
            {busy ? "Exportando…" : "Exportar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
