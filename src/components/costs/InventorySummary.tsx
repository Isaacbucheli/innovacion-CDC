import type { InventoryRow } from "@/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function InventorySummary({ rows }: { rows: InventoryRow[] }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">
        Importe el inventario de Azure para ver los recursos detectados del cliente.
      </p>
    );
  }
  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <Table>
        <TableHeader className="bg-secondary">
          <TableRow>
            <TableHead>Categoría</TableHead>
            <TableHead>Tipo de recurso</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.service_category}-${r.resource_type}-${i}`}>
              <TableCell>{r.service_category ?? ""}</TableCell>
              <TableCell>{r.resource_type ?? ""}</TableCell>
              <TableCell className="text-right tabular-nums">{r.count ?? 0}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
