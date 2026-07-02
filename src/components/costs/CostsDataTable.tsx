import { useEffect, useMemo, useState } from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingFn,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Columns3, Pencil, Rows3, Rows4 } from "lucide-react";
import type { CostResult, FinOpsLookups } from "@/types";
import {
  PRICING_META,
  formatMoney,
  formatPct,
  powerHoursLabel,
  powerUptimeLabel,
  pricingKind,
  riConfirmed,
  riTooltip,
  serviceIcon,
  serviceName,
  statusMeta,
  translateNote,
  visibleServiceKey,
} from "@/lib/costs";
import { categoryOf, showNotEligibleBadge } from "@/lib/finops";
import { textColumnFilter, labelColumnFilter } from "@/lib/columnFilter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DataTableColumnHeader from "@/components/DataTableColumnHeader";
import DataTablePagination from "@/components/DataTablePagination";

const COL_LABELS: Record<string, string> = {
  service: "Servicio",
  categoria: "Categoría",
  resource_name: "Recurso",
  resource_group: "Grupo",
  location: "Región",
  reserved: "Reservado",
  payg_monthly: "PAYG mes",
  ri_1y_monthly: "RI 1A",
  ri_3y_monthly: "RI 3A",
  savings_1y_pct: "Ahorro 1A",
  savings_3y_pct: "Ahorro 3A",
  power_running_hours: "Horas ON",
  power_uptime_pct: "% Uptime",
  calculation_status: "Estado",
  pricing: "Precio",
  note: "Nota",
};

function Pill({ className, title, children }: { className: string; title?: string; children: React.ReactNode }) {
  return (
    <span title={title} className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-md ${className}`}>
      {children}
    </span>
  );
}

const money = (v: number | null) => <span className="tabular-nums">{formatMoney(v)}</span>;
const pct = (v: number | null) => <span className="tabular-nums">{formatPct(v)}</span>;

// Orden numérico para columnas con valores nullables: null va al fondo (−∞).
const numSort: SortingFn<CostResult> = (rowA, rowB, columnId) => {
  const a = rowA.getValue<number | null>(columnId) ?? Number.NEGATIVE_INFINITY;
  const b = rowB.getValue<number | null>(columnId) ?? Number.NEGATIVE_INFINITY;
  return a - b;
};

const textFilter = textColumnFilter<CostResult>;
// Estado filtra contra la etiqueta en español (Calculado/Precio variable/...), no el código interno.
const statusFilter = labelColumnFilter<CostResult>((raw) => statusMeta(raw as string).label);

export default function CostsDataTable({
  rows,
  canEdit,
  onEditManual,
  onVisibleCountChange,
  lookups = null,
}: {
  rows: CostResult[];
  canEdit?: boolean;
  onEditManual?: (row: CostResult) => void;
  /** Notifica cuántas filas quedan visibles tras el filtro por columna (además de `rows.length`, que es antes de ese filtro). */
  onVisibleCountChange?: (n: number) => void;
  /** Catálogos FinOps (categorías/regiones/tipos) para columnas derivadas; opcional. */
  lookups?: FinOpsLookups | null;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [dense, setDense] = useState(false);

  const riCell = (v: number | null, row: CostResult) => {
    if (v != null) return money(v);
    return showNotEligibleBadge(row) ? (
      <Pill
        className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        title="Este SKU no tiene precio de reserva publicado por Azure"
      >
        No elegible
      </Pill>
    ) : (
      <span className="text-muted-foreground">-</span>
    );
  };

  const columns: ColumnDef<CostResult>[] = useMemo(() => [
    {
      id: "service",
      accessorFn: (r) => serviceName(visibleServiceKey(r.service_key)),
      header: "Servicio",
      filterFn: textFilter,
      cell: ({ row }) => {
        const key = visibleServiceKey(row.original.service_key);
        return (
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <img src={serviceIcon(key)} alt="" aria-hidden className="w-4 h-4" />
            {serviceName(key)}
          </span>
        );
      },
    },
    {
      id: "categoria",
      accessorFn: (r) => categoryOf(r.service_key, lookups),
      header: "Categoría",
      filterFn: textFilter,
      cell: ({ getValue }) => <span className="text-muted-foreground">{String(getValue())}</span>,
    },
    {
      accessorKey: "resource_name",
      header: "Recurso",
      filterFn: textFilter,
      cell: (c) => <span className="font-medium">{c.getValue<string>() ?? "-"}</span>,
    },
    { accessorKey: "resource_group", header: "Grupo", filterFn: textFilter, cell: (c) => c.getValue<string>() ?? "-" },
    { accessorKey: "location", header: "Región", filterFn: textFilter, cell: (c) => c.getValue<string>() ?? "-" },
    {
      id: "reserved",
      accessorFn: (r) => (riConfirmed(r) ? "Reservado" : ""),
      header: "Reservado",
      enableSorting: false,
      filterFn: textFilter,
      cell: ({ row }) =>
        riConfirmed(row.original) ? (
          <Pill className="bg-[#A3C243]/15 text-[#5a7016] dark:text-[#a9c46a]" title={riTooltip(row.original)}>
            Reservado
          </Pill>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    { accessorKey: "payg_monthly", header: "PAYG mes", sortingFn: numSort, filterFn: textFilter, cell: (c) => money(c.getValue<number | null>()) },
    {
      accessorKey: "ri_1y_monthly",
      header: "RI 1A",
      sortingFn: numSort,
      filterFn: textFilter,
      cell: ({ row }) => riCell(row.original.ri_1y_monthly, row.original),
    },
    {
      accessorKey: "ri_3y_monthly",
      header: "RI 3A",
      sortingFn: numSort,
      filterFn: textFilter,
      cell: ({ row }) => riCell(row.original.ri_3y_monthly, row.original),
    },
    { accessorKey: "savings_1y_pct", header: "Ahorro 1A", sortingFn: numSort, filterFn: textFilter, cell: (c) => pct(c.getValue<number | null>()) },
    { accessorKey: "savings_3y_pct", header: "Ahorro 3A", sortingFn: numSort, filterFn: textFilter, cell: (c) => pct(c.getValue<number | null>()) },
    {
      id: "power_running_hours",
      accessorFn: (r) => r.power_running_hours ?? -1,
      header: "Horas ON",
      enableColumnFilter: false,
      cell: ({ row }) => <span className="tabular-nums">{powerHoursLabel(row.original)}</span>,
    },
    {
      id: "power_uptime_pct",
      accessorFn: (r) => r.power_uptime_pct ?? -1,
      header: "% Uptime",
      enableColumnFilter: false,
      cell: ({ row }) => <span className="tabular-nums">{powerUptimeLabel(row.original)}</span>,
    },
    {
      accessorKey: "calculation_status",
      header: "Estado",
      filterFn: statusFilter,
      cell: (c) => {
        const m = statusMeta(c.getValue<string>());
        return <Pill className={m.badge}>{m.label}</Pill>;
      },
    },
    {
      id: "pricing",
      accessorFn: (r) => PRICING_META[pricingKind(r)].label,
      header: "Precio",
      enableSorting: false,
      filterFn: textFilter,
      cell: ({ row }) => {
        const m = PRICING_META[pricingKind(row.original)];
        return (
          <Pill className={m.badge} title={m.title}>
            {m.label}
          </Pill>
        );
      },
    },
    {
      id: "note",
      accessorFn: (r) => translateNote(r),
      header: "Nota",
      enableSorting: false,
      filterFn: textFilter,
      cell: ({ row }) => {
        const t = translateNote(row.original);
        return (
          <span className="block max-w-[280px] truncate text-muted-foreground" title={t}>
            {t}
          </span>
        );
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [lookups]);

  const tableColumns: ColumnDef<CostResult>[] = useMemo(() => {
    if (!(canEdit && onEditManual)) return columns;
    return [
      ...columns,
      {
        id: "actions",
        enableHiding: false,
        enableSorting: false,
        enableColumnFilter: false,
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Editar costo manual"
              onClick={() => onEditManual(row.original)}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          </div>
        ),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, canEdit, onEditManual]);

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
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
  const visibleCount = table.getFilteredRowModel().rows.length;
  useEffect(() => { onVisibleCountChange?.(visibleCount); }, [visibleCount, onVisibleCountChange]);

  return (
    <div>
      <div className="flex gap-2 items-center mb-3">
        <Button
          variant="outline"
          size="sm"
          aria-label="Cambiar densidad de la tabla"
          onClick={() => setDense((d) => !d)}
        >
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
          <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
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
                    {h.isPlaceholder ? null : (
                      <DataTableColumnHeader column={h.column} title={String(h.column.columnDef.header)} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="text-center text-muted-foreground py-8">
                  Sin recursos que coincidan.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={pad}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
