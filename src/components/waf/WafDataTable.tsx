import { useMemo, useState } from "react";
import {
  createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable, type SortingState,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DataTablePagination from "@/components/DataTablePagination";
import { impactMeta, filterRecommendations } from "@/lib/waf";
import type { WafRecommendation } from "@/types";

const col = createColumnHelper<WafRecommendation>();

export default function WafDataTable({ recommendations, pillarNames, minPct, maxPct, onOpen }: {
  recommendations: WafRecommendation[];
  pillarNames: Record<number, string>;
  minPct: number;
  maxPct: number;
  onOpen: (canonicalId: number) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const data = useMemo(() => filterRecommendations(recommendations, { minPct, maxPct }), [recommendations, minPct, maxPct]);

  const columns = useMemo(() => [
    col.accessor("matrix_code", { header: "Código", cell: (c) => <span className="font-medium">{c.getValue()}</span> }),
    col.accessor("pillar_number", { header: "Pilar", cell: (c) => pillarNames[c.getValue()] ?? c.getValue() }),
    col.accessor("review_scope_es", { header: "Ámbito", cell: (c) => <span className="truncate block max-w-[280px]">{c.getValue() ?? "—"}</span> }),
    col.accessor("business_impact", {
      header: "Impacto",
      cell: (c) => { const m = impactMeta(c.getValue()); return <span className={`text-xs px-2.5 py-0.5 rounded-full ${m.chip}`}>{m.label}</span>; },
    }),
    col.accessor("resource_count", { header: "Recursos", sortingFn: "basic", cell: (c) => <span className="tabular-nums">{c.getValue()}</span> }),
    col.accessor("completion_pct", {
      header: "Avance", sortingFn: "basic",
      cell: (c) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-[70px] rounded-full bg-secondary overflow-hidden">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${c.getValue()}%` }} />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{c.getValue()}%</span>
        </div>
      ),
    }),
  ], [pillarNames]);

  const table = useReactTable({
    data, columns, state: { sorting }, onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} onClick={h.column.getToggleSortingHandler()} className="cursor-pointer select-none">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin recomendaciones.</TableCell></TableRow>
            ) : table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} onClick={() => onOpen(row.original.canonical_id)} className="cursor-pointer">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
