import { useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Columns3, Pencil, Rows3, Rows4, Trash2 } from "lucide-react";
import type { Policy } from "@/types";
import { EFFECT_META, normalizeEffect } from "@/lib/effect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DataTablePagination from "@/components/DataTablePagination";
import DataTableColumnHeader from "@/components/DataTableColumnHeader";
import { textColumnFilter, labelColumnFilter } from "@/lib/columnFilter";

const textFilter = textColumnFilter<Policy>;
// Filtra el efecto por su texto original (es lo que muestra el badge).
const effectFilterFn = labelColumnFilter<Policy>((raw) => String(raw ?? ""));

const COL_LABELS: Record<string, string> = {
  policy_number: "N°",
  name: "Política",
  category: "Categoría",
  recommended_effect: "Efecto",
  mode: "Modo",
  recommended_scope: "Scope",
};

const EFFECT_RANK: Record<string, number> = {
  deny: 0,
  modify: 1,
  audit: 2,
  other: 3,
};

function EffBadge({ effect }: { effect: string | null }) {
  const m = EFFECT_META[normalizeEffect(effect)];
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-md ${m.badge}`}>
      {effect || m.label}
    </span>
  );
}

export default function PoliciesDataTable({
  policies,
  canEdit,
  onOpen,
  onEdit,
  onDelete,
}: {
  policies: Policy[];
  canEdit: boolean;
  onOpen: (p: Policy) => void;
  onEdit: (p: Policy) => void;
  onDelete: (p: Policy) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [dense, setDense] = useState(false);

  const columns: ColumnDef<Policy>[] = [
    {
      accessorKey: "policy_number",
      header: "N°", filterFn: textFilter,
      cell: (c) => <span className="text-muted-foreground tabular-nums">{c.getValue<number>() ?? ""}</span>,
    },
    {
      accessorKey: "name",
      header: "Política", filterFn: textFilter,
      cell: (c) => <span className="font-medium">{c.getValue<string>()}</span>,
    },
    { accessorKey: "category", header: "Categoría", filterFn: textFilter },
    {
      accessorKey: "recommended_effect",
      header: "Efecto", filterFn: effectFilterFn,
      cell: (c) => <EffBadge effect={c.getValue<string | null>()} />,
      sortingFn: (a, b) =>
        EFFECT_RANK[normalizeEffect(a.original.recommended_effect)] - EFFECT_RANK[normalizeEffect(b.original.recommended_effect)],
    },
    { accessorKey: "mode", header: "Modo", filterFn: textFilter },
    { accessorKey: "recommended_scope", header: "Scope", filterFn: textFilter },
  ];
  if (canEdit) {
    columns.push({
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Editar" onClick={() => onEdit(row.original)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Eliminar" onClick={() => onDelete(row.original)}>
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      ),
    });
  }

  const table = useReactTable({
    data: policies,
    columns,
    state: { sorting, columnVisibility, columnFilters },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const pad = dense ? "py-1.5" : "py-3";

  return (
    <div>
      <div className="flex gap-2 items-center mb-3">
        <Button variant="outline" size="sm" onClick={() => setDense((d) => !d)}>
          {dense ? <Rows4 className="w-4 h-4 mr-1" /> : <Rows3 className="w-4 h-4 mr-1" />}
          {dense ? "Cómoda" : "Compacta"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 className="w-4 h-4 mr-1" />
              Columnas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
            {table
              .getAllColumns()
              .filter((c) => c.getCanHide())
              .map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={c.getIsVisible()}
                  onCheckedChange={(v) => c.toggleVisibility(!!v)}
                >
                  {COL_LABELS[c.id] ?? c.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader className="bg-secondary">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="whitespace-nowrap">
                    {h.isPlaceholder ? null : <DataTableColumnHeader column={h.column} title={String(h.column.columnDef.header)} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                  Sin políticas que coincidan.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const accent = EFFECT_META[normalizeEffect(row.original.recommended_effect)].accent;
                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => onOpen(row.original)}
                  >
                    {row.getVisibleCells().map((cell, i) => (
                      <TableCell
                        key={cell.id}
                        className={pad}
                        style={i === 0 ? { boxShadow: `inset 3px 0 0 ${accent}` } : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
