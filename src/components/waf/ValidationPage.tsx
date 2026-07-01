import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable, type SortingState, type ColumnFiltersState,
} from "@tanstack/react-table";
import { Ban, CircleCheck, Clock, Library } from "lucide-react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import DataTablePagination from "@/components/DataTablePagination";
import DataTableColumnHeader from "@/components/DataTableColumnHeader";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/SearchInput";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CanonicalEditDialog from "@/components/waf/CanonicalEditDialog";
import { getWafAiConfig, getWafCatalog, analyzeWafCanonical, applyWafSuggestion } from "@/lib/api";
import { reviewStatusMeta } from "@/lib/waf";
import { textColumnFilter, labelColumnFilter, globalTextFilter } from "@/lib/columnFilter";
import { useCountUp } from "@/lib/useCountUp";
import { getRole } from "@/lib/auth";
import type { WafAiConfig, WafCanonical } from "@/types";

const textFilter = textColumnFilter<WafCanonical>;
const statusFilterFn = labelColumnFilter<WafCanonical>((raw) => reviewStatusMeta(raw as string | null).label);
const costFilterFn = labelColumnFilter<WafCanonical>((raw) => (raw ? "posible" : ""));
const globalSearch = globalTextFilter<WafCanonical>((r) => `${r.advisor_name ?? ""} ${r.advisor_category ?? ""}`);

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-9 h-9 rounded-lg grid place-items-center mb-2 bg-secondary text-muted-foreground">
      {children}
    </div>
  );
}

function CountCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  const n = useCountUp(value);
  return (
    <div className="rounded-xl border bg-background p-5 transition-shadow hover:shadow-md">
      <Chip>{icon}</Chip>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums tracking-tight mt-1">{n}</div>
    </div>
  );
}

const col = createColumnHelper<WafCanonical>();

export default function ValidationPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const isAdmin = getRole() === "admin";
  const [config, setConfig] = useState<WafAiConfig | null>(null);
  const [rows, setRows] = useState<WafCanonical[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyMsg, setBusyMsg] = useState("");
  const [editing, setEditing] = useState<WafCanonical | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  function load() {
    setLoading(true);
    getWafCatalog().then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }
  useEffect(() => { if (isAdmin) getWafAiConfig().then(setConfig).catch(() => setConfig(null)); }, [isAdmin]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  async function runBatch() {
    setBusyMsg("Buscando pendientes…");
    let applied = 0, failed = 0;
    try {
      const pend = await getWafCatalog({ review_status: "pending" });
      for (let i = 0; i < pend.length; i++) {
        setBusyMsg(`Analizando y aplicando pendientes… (${i + 1}/${pend.length})`);
        try {
          const { suggestion } = await analyzeWafCanonical(pend[i].canonical_id);
          await applyWafSuggestion(pend[i].canonical_id, suggestion);
          applied++;
        } catch { failed++; }
      }
      toast.success(`Curación IA: ${applied} aplicada${applied === 1 ? "" : "s"}${failed ? ` · ${failed} con error` : ""}`);
      load();
    } catch (e) { toast.error(`Error en la curación: ${msg(e)}`); }
    finally { setBusyMsg(""); }
  }

  function openEditor(c: WafCanonical) { setEditing(c); setDialogOpen(true); }

  // KPI counts from full rows (unfiltered)
  const totalCanonical = rows.length;
  const totalPending = rows.filter((r) => r.ai_review_status === "pending").length;
  const totalApplied = rows.filter((r) => r.ai_review_status === "applied").length;
  const totalExcluded = rows.filter((r) => r.is_excluded === true).length;

  const columns = useMemo(() => [
    col.accessor("canonical_id", { header: "ID", filterFn: textFilter, cell: (c) => <span className="tabular-nums">{c.getValue()}</span> }),
    col.accessor("advisor_name", {
      header: "Nombre Advisor", filterFn: textFilter,
      cell: (c) => {
        const row = c.row.original;
        return (
          <span className="truncate block max-w-[260px]">
            {c.getValue()}
            {row.is_excluded && (
              <span className="ml-2 text-[11px] text-red-600 dark:text-red-400">excluida</span>
            )}
          </span>
        );
      },
    }),
    col.accessor("advisor_category", { header: "Categoría", filterFn: textFilter, cell: (c) => <span className="text-muted-foreground">{c.getValue()}</span> }),
    col.accessor("pillar_number", { header: "Pilar", filterFn: textFilter, cell: (c) => <span className="tabular-nums">{c.getValue()}</span> }),
    col.accessor("ai_review_status", {
      header: "Estado", filterFn: statusFilterFn,
      cell: (c) => { const m = reviewStatusMeta(c.getValue()); return <span className={`text-xs px-2.5 py-0.5 rounded-full ${m.chip}`}>{m.label}</span>; },
    }),
    col.accessor("ai_possible_additional_cost", {
      header: "Costo", filterFn: costFilterFn,
      cell: (c) => c.getValue()
        ? <span className="text-[11px] text-amber-600 dark:text-amber-400">posible</span>
        : <span className="text-muted-foreground">—</span>,
    }),
    col.display({
      id: "actions",
      header: "",
      cell: (c) => (
        <div className="text-right">
          <Button variant="outline" size="sm" onClick={() => openEditor(c.row.original)}>Revisar</Button>
        </div>
      ),
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  const table = useReactTable({
    data: rows,
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

  if (!isAdmin) {
    return (
      <AppShell title="Validación inteligente" subtitle="Matriz mejoras Azure" active="waf-validation" onNavigate={onNavigate}>
        <p className="text-sm text-muted-foreground">Esta sección es solo para administradores.</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Validación inteligente"
      subtitle="Matriz mejoras Azure · curación IA del catálogo"
      active="waf-validation"
      onNavigate={onNavigate}
      headerRight={<Button size="sm" disabled={!!busyMsg} onClick={runBatch}>Analizar y aplicar pendientes</Button>}
    >
      <BusyOverlay show={loading || !!busyMsg} title={busyMsg || "Cargando catálogo"} />
      <div className="space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <CountCard icon={<Library className="w-5 h-5" />} label="Canónicas" value={totalCanonical} />
          <CountCard icon={<Clock className="w-5 h-5" />} label="Pendientes" value={totalPending} />
          <CountCard icon={<CircleCheck className="w-5 h-5" />} label="Aplicadas" value={totalApplied} />
          <CountCard icon={<Ban className="w-5 h-5" />} label="Excluidas" value={totalExcluded} />
        </div>

        {/* AI config caption */}
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          <span>Azure OpenAI: <span className={config?.configured ? "text-[#5a7016] dark:text-[#a9c46a]" : "text-destructive"}>{config?.configured ? "configurado" : "no configurado"}</span></span>
          {config?.deployment && <span>Deployment: <span className="text-foreground">{config.deployment}</span></span>}
          {config?.api_version && <span>API: <span className="text-foreground">{config.api_version}</span></span>}
        </div>

        {/* TanStack table + pagination */}
        <div className="space-y-3">
          <SearchInput
            placeholder="Buscar nombre o categoría…"
            value={globalFilter}
            onChange={setGlobalFilter}
            className="w-[260px] max-w-full"
            inputClassName="h-9"
            aria-label="Buscar canónicas"
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
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin canónicas.</TableCell></TableRow>
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
      <CanonicalEditDialog open={dialogOpen} canonical={editing} onOpenChange={setDialogOpen} onSaved={load} />
    </AppShell>
  );
}
