import { useMemo, useState } from "react";
import {
  createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable, type SortingState, type ColumnFiltersState,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SearchInput from "@/components/SearchInput";
import DataTablePagination from "@/components/DataTablePagination";
import DataTableColumnHeader from "@/components/DataTableColumnHeader";
import { impactMeta, filterRecommendations } from "@/lib/waf";
import { textColumnFilter, labelColumnFilter, globalTextFilter } from "@/lib/columnFilter";
import type { WafRecommendation } from "@/types";

const col = createColumnHelper<WafRecommendation>();

const textFilter = textColumnFilter<WafRecommendation>;
// Impacto se filtra contra la etiqueta en español (Alta/Media/Baja), no contra "high/medium/low".
const impactFilter = labelColumnFilter<WafRecommendation>((raw) => impactMeta(raw as string | null).label);
// Búsqueda global sobre código + ámbito.
const globalSearch = globalTextFilter<WafRecommendation>((r) => `${r.matrix_code} ${r.review_scope_es ?? ""}`);

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
    const pillarFilter = labelColumnFilter<WafRecommendation>((raw) => pillarNames[raw as number] ?? String(raw ?? ""));
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
      <SearchInput
        placeholder="Buscar ámbito o código…"
        value={globalFilter}
        onChange={setGlobalFilter}
        className="w-[260px] max-w-full"
        inputClassName="h-9"
        aria-label="Buscar recomendaciones"
      />
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : <DataTableColumnHeader column={h.column} title={String(h.column.columnDef.header)} />}
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
