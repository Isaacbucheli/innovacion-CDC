import { useEffect, useMemo, useState } from "react";
import {
  createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable, type SortingState, type ColumnFiltersState,
} from "@tanstack/react-table";
import { CalendarClock, CalendarRange, Layers, Wallet } from "lucide-react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import DataTablePagination from "@/components/DataTablePagination";
import DataTableColumnHeader from "@/components/DataTableColumnHeader";
import WafClientHeader from "@/components/waf/WafClientHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { listClientsAdmin, getWafCostReference } from "@/lib/api";
import { formatMoney } from "@/lib/costs";
import { impactMeta } from "@/lib/waf";
import { textColumnFilter, labelColumnFilter, globalTextFilter } from "@/lib/columnFilter";
import { useCountUp } from "@/lib/useCountUp";
import type { ClientAdmin, WafCostReference, WafCostItem } from "@/types";

const textFilter = textColumnFilter<WafCostItem>;
const impactFilter = labelColumnFilter<WafCostItem>((raw) => impactMeta(raw as string | null).label);
const globalSearch = globalTextFilter<WafCostItem>((r) => `${r.matrix_code} ${r.review_scope_es ?? ""}`);
type ColMeta = { align?: "right" };

const KEY = "innovacion_cdc_waf_client";

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
  const [globalFilter, setGlobalFilter] = useState("");

  useEffect(() => {
    listClientsAdmin().then((cs) => {
      setClients(cs);
      const stored = Number(localStorage.getItem(KEY));
      setClientId(cs.some((c) => c.client_id === stored) ? stored : cs[0]?.client_id ?? null);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (clientId == null) return;
    setLoading(true);
    getWafCostReference(clientId).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [clientId]);

  function selectClient(id: number) { localStorage.setItem(KEY, String(id)); setClientId(id); }

  const items = useMemo(() => data?.items ?? [], [data]);

  const columns = useMemo(() => [
    col.accessor("matrix_code", { header: "Código", filterFn: textFilter, cell: (c) => <span className="font-medium tabular-nums">{c.getValue()}</span> }),
    col.accessor("review_scope_es", {
      header: "Ámbito", filterFn: textFilter,
      cell: (c) => <span className="truncate block max-w-[260px]">{c.getValue() ?? "—"}</span>,
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
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: globalSearch,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const t = data?.totals;
  return (
    <AppShell title="Costo referencial Azure" subtitle="Matriz mejoras Azure · estimación con tarifas públicas"
      active="waf-cost" onNavigate={onNavigate}
      headerRight={<WafClientHeader clients={clients} clientId={clientId} onSelect={selectClient} />}>
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
            <Input
              placeholder="Buscar ámbito o código…"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-9 w-[260px] max-w-full"
              aria-label="Buscar costo referencial"
            />
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
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin recomendaciones de costo.</TableCell></TableRow>
                  ) : table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
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
        </div>
      )}
    </AppShell>
  );
}
