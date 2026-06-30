import { useMemo, useState } from "react";
import {
  createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable, type SortingState, type ColumnFiltersState, type FilterFn,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import DataTablePagination from "@/components/DataTablePagination";
import ColumnFilterPopover from "@/components/waf/ColumnFilterPopover";
import { impactMeta, filterRecommendations } from "@/lib/waf";
import { evalColumnFilter, type ColumnFilterValue } from "@/lib/columnFilter";
import type { WafRecommendation } from "@/types";

const col = createColumnHelper<WafRecommendation>();

// Filtro avanzado por columna (operadores + Y/O) sobre el valor crudo (tolera null).
const textFilter: FilterFn<WafRecommendation> = (row, columnId, value: ColumnFilterValue) =>
  evalColumnFilter(String(row.getValue(columnId) ?? ""), value);

// Impacto se filtra contra la etiqueta en español (Alta/Media/Baja), no contra "high/medium/low".
const impactFilter: FilterFn<WafRecommendation> = (row, columnId, value: ColumnFilterValue) =>
  evalColumnFilter(impactMeta(row.getValue(columnId)).label, value);

// Búsqueda global sobre código + ámbito (aplica a la fila completa, ignora el columnId).
const globalSearch: FilterFn<WafRecommendation> = (row, _columnId, value: string) => {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return true;
  const r = row.original;
  return r.matrix_code.toLowerCase().includes(s) || (r.review_scope_es ?? "").toLowerCase().includes(s);
};

export default function WafDataTable({ recommendations, pillarNames, minPct, maxPct, onOpen }: {
  recommendations: WafRecommendation[];
  pillarNames: Record<number, string>;
  minPct: number;
  maxPct: number;
  onOpen: (canonicalId: number) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const data = useMemo(() => filterRecommendations(recommendations, { minPct, maxPct }), [recommendations, minPct, maxPct]);

  const columns = useMemo(() => {
    // Pilar se filtra contra el NOMBRE del pilar (lo que ve el usuario), no el número.
    const pillarFilter: FilterFn<WafRecommendation> = (row, columnId, value: ColumnFilterValue) =>
      evalColumnFilter(pillarNames[row.getValue(columnId) as number] ?? String(row.getValue(columnId) ?? ""), value);
    return [
    col.accessor("matrix_code", { header: "Código", filterFn: textFilter, cell: (c) => <span className="font-medium">{c.getValue()}</span> }),
    col.accessor("pillar_number", { header: "Pilar", filterFn: pillarFilter, cell: (c) => pillarNames[c.getValue()] ?? c.getValue() }),
    col.accessor("review_scope_es", { header: "Ámbito", filterFn: textFilter, cell: (c) => <span className="truncate block max-w-[280px]">{c.getValue() ?? "—"}</span> }),
    col.accessor("business_impact", {
      header: "Impacto", filterFn: impactFilter,
      cell: (c) => { const m = impactMeta(c.getValue()); return <span className={`text-xs px-2.5 py-0.5 rounded-full ${m.chip}`}>{m.label}</span>; },
    }),
    col.accessor("resource_count", { header: "Recursos", filterFn: textFilter, sortingFn: "basic", cell: (c) => <span className="tabular-nums">{c.getValue()}</span> }),
    col.accessor("completion_pct", {
      header: "Avance", filterFn: textFilter, sortingFn: "basic",
      cell: (c) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-[70px] rounded-full bg-secondary overflow-hidden">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${c.getValue()}%` }} />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{c.getValue()}%</span>
        </div>
      ),
    }),
    ];
  }, [pillarNames]);

  const table = useReactTable({
    data, columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: globalSearch,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div className="space-y-3">
      <Input
        placeholder="Buscar ámbito o código…"
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="h-9 w-[260px] max-w-full"
        aria-label="Buscar recomendaciones"
      />
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="select-none">
                    <span className="inline-flex items-center">
                      <span onClick={h.column.getToggleSortingHandler()} className="cursor-pointer">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
                      </span>
                      {h.column.getCanFilter() && (
                        <ColumnFilterPopover column={h.column} label={String(h.column.columnDef.header)} />
                      )}
                    </span>
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
