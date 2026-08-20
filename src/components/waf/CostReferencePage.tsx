import { useEffect, useMemo, useState } from "react";
import {
  createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable, type SortingState, type ColumnFiltersState, type VisibilityState,
} from "@tanstack/react-table";
import { CalendarClock, CalendarRange, Columns3, Layers, Rows3, Rows4, Wallet } from "lucide-react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import DataTablePagination from "@/components/DataTablePagination";
import DataTableColumnHeader from "@/components/DataTableColumnHeader";
import ClientHeader from "@/components/ClientHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SearchInput from "@/components/SearchInput";
import { listClientsAdmin, getWafCostReference } from "@/lib/api";
import { formatMoney } from "@/lib/costs";
import { impactMeta } from "@/lib/waf";
import { textColumnFilter, labelColumnFilter, globalTextFilter } from "@/lib/columnFilter";
import { resolveInitialClient, writeActiveClient } from "@/lib/clientSelection";
import { useCountUp } from "@/lib/useCountUp";
import type { ClientAdmin, WafCostReference, WafCostItem } from "@/types";

const textFilter = textColumnFilter<WafCostItem>;
const impactFilter = labelColumnFilter<WafCostItem>((raw) => impactMeta(raw as string | null).label);
const globalSearch = globalTextFilter<WafCostItem>((r) => `${r.matrix_code} ${r.review_scope_es ?? ""}`);
type ColMeta = { align?: "right" };

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-9 h-9 rounded-lg grid place-items-center mb-2 bg-secondary text-muted-foreground">
      {children}
    </div>
  );
}

function MoneyCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  const n = useCountUp(value);
  return (
    <div className="rounded-xl border bg-background p-5 transition-shadow hover:shadow-md">
      <Chip>{icon}</Chip>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums tracking-tight mt-1">{formatMoney(n)}</div>
    </div>
  );
}

function TextCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-5 transition-shadow hover:shadow-md">
      <Chip>{icon}</Chip>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums tracking-tight mt-1">{value}</div>
    </div>
  );
}

const col = createColumnHelper<WafCostItem>();

export default function CostReferencePage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const [clients, setClients] = useState<ClientAdmin[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [data, setData] = useState<WafCostReference | null>(null);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [dense, setDense] = useState(false);
  const [globalFilter, setGlobalFilter] = useState("");

  useEffect(() => {
    listClientsAdmin().then((cs) => {
      setClients(cs);
      setClientId(resolveInitialClient(cs));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (clientId == null) return;
    setLoading(true);
    getWafCostReference(clientId).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [clientId]);

  function selectClient(id: number) { writeActiveClient(id); setClientId(id); }

  const items = useMemo(() => data?.items ?? [], [data]);

  const columns = useMemo(() => [
    col.accessor("matrix_code", { header: "Código", filterFn: textFilter, cell: (c) => <span className="font-medium tabular-nums">{c.getValue()}</span> }),
    col.accessor("review_scope_es", {
      header: "Ámbito", filterFn: textFilter,
      cell: (c) => <span className="truncate block max-w-[260px]">{c.getValue() ?? ""}</span>,
    }),
    col.accessor("business_impact", {
      header: "Impacto", filterFn: impactFilter,
      cell: (c) => { const m = impactMeta(c.getValue()); return <span className={`text-xs px-2.5 py-0.5 rounded-full ${m.chip}`}>{m.label}</span>; },
    }),
    col.accessor((r) => `${r.resources_priced}/${r.resources_total}`, {
      id: "resources", header: "Recursos", filterFn: textFilter,
      cell: (c) => <span className="tabular-nums">{c.getValue()}</span>,
    }),
    col.accessor("payg_monthly", { header: "PAYG/mes", filterFn: textFilter, meta: { align: "right" } as ColMeta, cell: (c) => <span className="block text-right tabular-nums">{formatMoney(c.getValue())}</span> }),
    col.accessor("ri_1y_monthly", { header: "RI 1a/mes", filterFn: textFilter, meta: { align: "right" } as ColMeta, cell: (c) => <span className="block text-right tabular-nums">{formatMoney(c.getValue())}</span> }),
    col.accessor("ri_3y_monthly", { header: "RI 3a/mes", filterFn: textFilter, meta: { align: "right" } as ColMeta, cell: (c) => <span className="block text-right tabular-nums">{formatMoney(c.getValue())}</span> }),
  ], []);

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting, columnFilters, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: globalSearch,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });
  const pad = dense ? "py-1.5" : "py-3";

  const t = data?.totals;
  return (
    <AppShell title="Costo referencial Azure" subtitle="Matriz mejoras Azure · estimación con tarifas públicas"
      active="waf-cost" onNavigate={onNavigate}
      headerRight={<ClientHeader clients={clients} clientId={clientId} onSelect={selectClient} />}>
      <BusyOverlay show={loading} title="Cargando costo referencial" />
      {data && !data.has_cost_data ? (
        <p className="text-sm text-muted-foreground">{data.message ?? "Este cliente aún no tiene costos calculados."}</p>
      ) : (
        <div className="space-y-5">
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MoneyCard icon={<Wallet className="w-5 h-5" />} label="PAYG / mes" value={t?.payg_monthly ?? 0} />
            <MoneyCard icon={<CalendarClock className="w-5 h-5" />} label="Reserva 1 año / mes" value={t?.ri_1y_monthly ?? 0} />
            <MoneyCard icon={<CalendarRange className="w-5 h-5" />} label="Reserva 3 años / mes" value={t?.ri_3y_monthly ?? 0} />
            <TextCard icon={<Layers className="w-5 h-5" />} label="Cobertura recursos" value={`${t?.resources_priced ?? 0}/${t?.resources_total ?? 0}`} />
          </div>

          {data?.disclaimer && <p className="text-xs text-muted-foreground border-l-2 border-border pl-3">{data.disclaimer}</p>}

          {/* TanStack table + pagination */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <SearchInput
                placeholder="Buscar ámbito o código…"
                value={globalFilter}
                onChange={setGlobalFilter}
                className="w-[260px] max-w-full"
                inputClassName="h-9"
                aria-label="Buscar costo referencial"
              />
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" aria-label="Cambiar densidad de la tabla" onClick={() => setDense((d) => !d)}>
                  {dense ? <Rows4 className="w-4 h-4 mr-1" /> : <Rows3 className="w-4 h-4 mr-1" />}
                  {dense ? "Cómoda" : "Compacta"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm"><Columns3 className="w-4 h-4 mr-1" />Columnas</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                    <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
                    {table.getAllColumns().filter((c) => c.getCanHide()).map((c) => (
                      <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)}>
                        {String(c.columnDef.header)}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="rounded-xl border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {hg.headers.map((h) => (
                        <TableHead key={h.id}>
                          {h.isPlaceholder ? null : (
                            <DataTableColumnHeader column={h.column} title={String(h.column.columnDef.header)} align={(h.column.columnDef.meta as ColMeta | undefined)?.align} />
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length === 0 ? (
                    <TableRow><TableCell colSpan={table.getAllColumns().length} className="text-center text-muted-foreground py-8">Sin recomendaciones de costo.</TableCell></TableRow>
                  ) : table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={pad}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination table={table} />
          </div>
        </div>
      )}
    </AppShell>
  );
}
