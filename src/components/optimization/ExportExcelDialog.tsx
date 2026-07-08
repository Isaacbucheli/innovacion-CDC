import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { STATE_META } from "@/components/optimization/FindingBits";
import { STATE_ORDER } from "@/lib/optimization";
import type { FindingState, OptFinding } from "@/types";

const DEFAULT_STATES: FindingState[] = ["abierto", "en_progreso"];

/** Diálogo de exportación a Excel: elegir qué estados de hallazgo incluir (calca el ExcelExportDialog de costos). */
export default function ExportExcelDialog({
  open,
  onOpenChange,
  findings,
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  findings: OptFinding[];
  busy?: boolean;
  onConfirm: (states: FindingState[]) => void;
}) {
  const [states, setStates] = useState<FindingState[]>(DEFAULT_STATES);

  useEffect(() => {
    if (open) setStates(DEFAULT_STATES);
  }, [open]);

  const included = findings.filter((f) => states.includes(f.state)).length;

  const toggle = (s: FindingState) =>
    setStates((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : STATE_ORDER.filter((x) => prev.includes(x) || x === s)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" busy={busy}>
        <DialogHeader>
          <DialogTitle>Exportar Excel</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Estados de hallazgo a incluir en el archivo.</p>
        <div className="space-y-2">
          {STATE_ORDER.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary h-4 w-4"
                checked={states.includes(s)}
                onChange={() => toggle(s)}
                disabled={busy}
              />
              {STATE_META[s].label}
              <span className="ml-auto text-muted-foreground tabular-nums">
                {findings.filter((f) => f.state === s).length}
              </span>
            </label>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{included} hallazgos incluidos.</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => onConfirm(states)} disabled={busy || states.length === 0 || included === 0}>
            {busy ? "Exportando…" : "Exportar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
