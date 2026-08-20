import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { getFinOpsStatus, refreshFinOpsData } from "@/lib/api";
import { fmtDateTime } from "@/lib/dates";
import type { FinOpsRefreshStatus } from "@/types";

function fmtDate(d: string | null): string {
  return fmtDateTime(d);
}

const msg = (e: unknown) => (e instanceof Error ? e.message : "Error inesperado");

export default function FinOpsRefreshDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<FinOpsRefreshStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getFinOpsStatus()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [open]);

  async function doRefresh() {
    setBusy(true);
    try {
      const r = await refreshFinOpsData();
      const errors = r.results.filter((d) => (d.status ?? "").startsWith("error:"));
      if (errors.length > 0) {
        toast.error(
          `Actualización con errores: ${errors.map((d) => `${d.dataset} (${d.status})`).join(", ")}.`,
        );
      } else {
        toast.success(`${r.results.length} dataset(s) actualizados correctamente.`);
      }
      onDone();
      onOpenChange(false);
    } catch (e) {
      toast.error(`Error actualizando datos FinOps: ${msg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" busy={busy}>
        <DialogHeader>
          <DialogTitle>Actualizar datos FinOps</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Datos abiertos de FinOps Toolkit (elegibilidad de reservas, regiones, tipos de recurso). Se
          descargan desde el origen público y se guardan en caché local.
        </p>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Sin datos previos: aún no se ha ejecutado una actualización.</p>
        ) : (
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary">
                <TableRow>
                  <TableHead>Dataset</TableHead>
                  <TableHead>Última actualización</TableHead>
                  <TableHead className="text-right">Filas</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.dataset}>
                    <TableCell>{r.dataset}</TableCell>
                    <TableCell>{fmtDate(r.refreshed_at)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.row_count != null ? r.row_count.toLocaleString("en-US") : ""}
                    </TableCell>
                    <TableCell>{r.status ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cerrar
          </Button>
          <Button type="button" disabled={busy} onClick={doRefresh}>
            {busy ? "Actualizando…" : "Actualizar ahora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
