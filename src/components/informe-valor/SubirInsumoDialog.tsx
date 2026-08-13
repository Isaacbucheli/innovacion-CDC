import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { InsumoKind } from "@/types";

// Partial a propósito: tolerancia de deploy ante un kind que la API ya anuncia y este
// front todavía no conoce (el dialogo debe mostrar genérico, no empty).
const TITULO: Partial<Record<InsumoKind, string>> = {
  facturacion: "Subir el export de BITCOST",
  evolucion: "Subir evolución por recurso (BITCOST)",
  casos: "Subir el Excel de la mesa de servicio",
  rbac: "Subir el reporte de RBAC",
};

/** Diálogo de un solo paso, modelado sobre src/components/waf/ImportCsvDialog.tsx. */
export default function SubirInsumoDialog({
  kind, open, busy, onOpenChange, onConfirm,
}: {
  kind: InsumoKind | null;
  open: boolean;
  busy: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (file: File) => void;
}) {
  const [file, setFile] = useState<File | null>(null);

  // Igual que ImportCsvDialog: limpiar la seleccion al abrir (o al cambiar de insumo), sin
  // importar como se cerro la ultima vez -- Cancelar, Escape, clic afuera o una subida exitosa
  // toman todos el mismo camino de vuelta a "open".
  useEffect(() => { if (open) setFile(null); }, [open, kind]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent busy={busy}>
        <DialogHeader><DialogTitle>{(kind && TITULO[kind]) || "Subir insumo"}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="insumo-file">Archivo Excel (.xlsx)</Label>
          <input id="insumo-file" type="file" accept=".xlsx" className="w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <p className="text-xs text-muted-foreground">
            Reemplaza por completo lo que haya cargado para este cliente.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!file || busy} onClick={() => file && onConfirm(file)}>Subir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
