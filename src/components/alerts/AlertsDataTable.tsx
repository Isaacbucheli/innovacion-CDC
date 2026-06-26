import { useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Columns3, Pencil, Rows3, Rows4, Trash2 } from "lucide-react";
import type { Alert } from "@/types";
import { SEVERITY_META, severityKey } from "@/lib/severity";
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

const COL_LABELS: Record<string, string> = {
  alert_number: "N°",
  name: "Alerta",
  resource: "Recurso",
  alert_type: "Tipo",
  severity: "Severidad",
  origin: "Origen",
};

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function SevBadge({ sev }: { sev: string | null }) {
  const m = SEVERITY_META[severityKey(sev)];
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-md ${m.badge}`}>
      {m.label}
    </span>
  );
}

export default function AlertsDataTable({
  alerts,
  canEdit,
  onOpen,
  onEdit,
  onDelete,
}: {
  alerts: Alert[];
  canEdit: boolean;
  onOpen: (a: Alert) => void;
  onEdit: (a: Alert) => void;
  onDelete: (a: Alert) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [dense, setDense] = useState(false);

  const columns: ColumnDef<Alert>[] = [
    {
      accessorKey: "alert_number",
      header: "N°",
      cell: (c) => <span className="text-muted-foreground tabular-nums">{c.getValue<number>() ?? ""}</span>,
    },
    {
      accessorKey: "name",
      header: "Alerta",
      cell: (c) => <span className="font-medium">{c.getValue<string>()}</span>,
    },
    { accessorKey: "resource", header: "Recurso" },
    { accessorKey: "alert_type", header: "Tipo" },
    {
      accessorKey: "severity",
      header: "Severidad",
      cell: (c) => <SevBadge sev={c.getValue<string | null>()} />,
      sortingFn: (a, b) =>
        SEVERITY_RANK[severityKey(a.original.severity)] - SEVERITY_RANK[severityKey(b.original.severity)],
    },
    { accessorKey: "origin", header: "Origen" },
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
    data: alerts,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
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
                    {h.isPlaceholder ? null : h.column.getCanSort() ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                  Sin alertas que coincidan.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const accent = SEVERITY_META[severityKey(row.original.severity)].accent;
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
