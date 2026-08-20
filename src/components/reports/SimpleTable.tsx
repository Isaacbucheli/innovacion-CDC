import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface SimpleCol<T> {
  key: string;
  label: string;
  align?: "right";
  render?: (row: T) => React.ReactNode;
}

// Tabla estática y legible para las secciones del informe (sin orden/filtro).
export default function SimpleTable<T>({ cols, rows, onRowClick, empty = "Sin datos." }: {
  cols: SimpleCol<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  empty?: string;
}) {
  return (
    <div className="rounded-xl border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {cols.map((c) => (
              <TableHead key={c.key} className={c.align === "right" ? "text-right" : undefined}>{c.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={cols.length} className="text-center text-muted-foreground py-8">{empty}</TableCell></TableRow>
          ) : rows.map((row, i) => (
            <TableRow key={i} onClick={onRowClick ? () => onRowClick(row) : undefined} className={onRowClick ? "cursor-pointer" : undefined}>
              {cols.map((c) => (
                <TableCell key={c.key} className={c.align === "right" ? "text-right tabular-nums" : undefined}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
