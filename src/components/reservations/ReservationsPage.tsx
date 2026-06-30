import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable, type SortingState, type ColumnFiltersState,
} from "@tanstack/react-table";
import { CalendarClock, CalendarX, Layers, Gauge } from "lucide-react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import WafClientHeader from "@/components/waf/WafClientHeader";
import DataTablePagination from "@/components/DataTablePagination";
import DataTableColumnHeader from "@/components/DataTableColumnHeader";
import ReservationDetailDialog from "@/components/reservations/ReservationDetailDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { listClientsAdmin, getReservations, getReservationUtilization } from "@/lib/api";
import { textColumnFilter, globalTextFilter } from "@/lib/columnFilter";
import { situacion, isInactive, utilChip, daysChip, daysLabel, stateChip, utilNum } from "@/lib/reservations";
import type { ClientAdmin, Reservation } from "@/types";

const KEY = "innovacion_cdc_waf_client";
type Util = { last?: string | null; d7?: string | null; pending?: boolean };
const col = createColumnHelper<Reservation>();
const textFilter = textColumnFilter<Reservation>;
const globalSearch = globalTextFilter<Reservation>((r) => `${r.name} ${r.product} ${r.region}`);

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="w-8 h-8 rounded-lg grid place-items-center mb-2" style={{ background: `${accent}22`, color: accent }}>{icon}</div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums tracking-tight mt-0.5">{value}</div>
    </div>
  );
}

export default function ReservationsPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const [clients, setClients] = useState<ClientAdmin[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [alertDays, setAlertDays] = useState(30);
  const [rows, setRows] = useState<Reservation[]>([]);
  const [util, setUtil] = useState<Record<string, Util>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState<Reservation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "days_remaining", desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const runId = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    listClientsAdmin().then((cs) => {
      setClients(cs);
      const stored = Number(localStorage.getItem(KEY));
      setClientId(cs.some((c) => c.client_id === stored) ? stored : cs[0]?.client_id ?? null);
    }).catch((e) => toast.error(e instanceof Error ? e.message : String(e))).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (clientId == null) return;
    const myRun = ++runId.current;
    setLoading(true); setMessage(""); setRows([]); setUtil({});
    getReservations(clientId, alertDays, false).then((data) => {
      if (!mounted.current || myRun !== runId.current) return;
      const res = data.reservations ?? [];
      setRows(res);
      if (data.has_credentials === false) setMessage(data.message || "El cliente no tiene credenciales Azure activas.");
      else if (data.errors?.length) setMessage(`No se pudieron leer reservas de ${data.errors.length} credencial(es). Verifica el rol Reservations Reader del App Registration.`);
      else if (!res.length) setMessage("Este cliente no tiene reservas visibles en Azure.");
      // Fase 2: utilización por reserva activa, en lotes concurrentes.
      const pending = res.filter((r) => !isInactive(r));
      setUtil(Object.fromEntries(pending.map((r) => [r.reservation_id, { pending: true } as Util])));
      void loadUtilization(clientId, pending, myRun);
    }).catch((e) => {
      if (mounted.current && myRun === runId.current) { setMessage(`No se pudieron cargar las reservas: ${e instanceof Error ? e.message : e}`); }
    }).finally(() => { if (mounted.current && myRun === runId.current) setLoading(false); });
  }, [clientId, alertDays]);

  async function loadUtilization(cid: number, pending: Reservation[], myRun: number) {
    let i = 0;
    const worker = async () => {
      while (i < pending.length) {
        const r = pending[i++];
        if (myRun !== runId.current) return;
        try {
          const u = await getReservationUtilization(cid, r.credential_id, r.reservation_id);
          if (myRun !== runId.current) return;
          setUtil((prev) => ({ ...prev, [r.reservation_id]: { last: u.utilization_last, d7: u.utilization_7d ?? u.utilization7d, pending: false } }));
        } catch {
          if (myRun !== runId.current) return;
          setUtil((prev) => ({ ...prev, [r.reservation_id]: { last: "n/d", d7: "n/d", pending: false } }));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, pending.length) }, worker));
  }

  function selectClient(id: number) { localStorage.setItem(KEY, String(id)); setClientId(id); }
  function openDetail(r: Reservation) { setDetail(r); setDetailOpen(true); }

  const total = rows.length;
  const expiring = useMemo(() => rows.filter((r) => situacion(r, alertDays) === "por").length, [rows, alertDays]);
  const expired = useMemo(() => rows.filter((r) => r.expired || r.days_remaining < 0).length, [rows]);
  const avgUse = useMemo(() => {
    const anyPending = Object.values(util).some((u) => u.pending);
    if (anyPending) return "…";
    const ns = Object.values(util).map((u) => utilNum(u.d7)).filter((n): n is number => n !== null);
    return ns.length ? `${Math.round(ns.reduce((s, n) => s + n, 0) / ns.length)}%` : "n/d";
  }, [util]);

  const chip = (cls: string, text: React.ReactNode) => <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{text}</span>;
  const usoCell = (id: string, pick: (u: Util) => string | null | undefined) => {
    const u = util[id];
    if (u?.pending) return <span className="text-xs text-muted-foreground">…</span>;
    const v = u ? pick(u) : null;
    return chip(utilChip(v), v ?? "n/d");
  };

  const columns = useMemo(() => [
    col.accessor("name", { header: "Reserva", filterFn: textFilter, cell: (c) => <span className="font-medium">{c.getValue()}</span> }),
    col.accessor("product", { header: "Producto", filterFn: textFilter }),
    col.accessor("region", { header: "Región", filterFn: textFilter }),
    col.accessor("quantity", { header: "Cant.", enableColumnFilter: false, cell: (c) => <span className="tabular-nums">{c.getValue()}</span> }),
    col.accessor((r) => r.term_label || r.term, { id: "term", header: "Término", filterFn: textFilter }),
    col.accessor("expires_on", { header: "Caduca", filterFn: textFilter }),
    col.accessor("days_remaining", {
      header: "Días", sortingFn: "basic", filterFn: textFilter,
      cell: (c) => chip(daysChip(c.row.original), daysLabel(c.row.original)),
    }),
    col.display({ id: "u1", header: "Uso 1d", cell: (c) => usoCell(c.row.original.reservation_id, (u) => u.last) }),
    col.display({ id: "u7", header: "Uso 7d", cell: (c) => usoCell(c.row.original.reservation_id, (u) => u.d7) }),
    col.accessor("state", { header: "Estado", filterFn: textFilter, cell: (c) => chip(stateChip(c.getValue()), c.getValue()) }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [util]);

  const table = useReactTable({
    data: rows, columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting, onColumnFiltersChange: setColumnFilters, onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: globalSearch,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <AppShell title="Reservas por vencer" subtitle="Gestión CDC · reservas de capacidad Azure"
      active="reservations" onNavigate={onNavigate}
      headerRight={<WafClientHeader clients={clients} clientId={clientId} onSelect={selectClient} />}>
      <BusyOverlay show={loading} title="Cargando reservas" />
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={<Layers className="w-4 h-4" />} label="Reservas" value={String(total)} accent="#a3c243" />
          <Kpi icon={<CalendarClock className="w-4 h-4" />} label={`Por vencer (≤${alertDays}d)`} value={String(expiring)} accent="#d9a82a" />
          <Kpi icon={<CalendarX className="w-4 h-4" />} label="Vencidas" value={String(expired)} accent="#a53b35" />
          <Kpi icon={<Gauge className="w-4 h-4" />} label="Uso prom. 7 días" value={avgUse} accent="#70b043" />
        </div>

        {message && <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">{message}</p>}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Buscar reserva, producto o región…" value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)} className="h-9 w-[260px] max-w-full" aria-label="Buscar reservas" />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Aviso (días):
              <Input type="number" min={1} max={365} value={alertDays}
                onChange={(e) => setAlertDays(Math.min(365, Math.max(1, Number(e.target.value) || 30)))}
                className="h-9 w-20" aria-label="Días de aviso" />
            </label>
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((h) => (
                      <TableHead key={h.id}>
                        {h.isPlaceholder ? null : h.column.getCanFilter() || h.column.getCanSort()
                          ? <DataTableColumnHeader column={h.column} title={String(h.column.columnDef.header)} />
                          : flexRender(h.column.columnDef.header, h.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow><TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">Sin reservas que coincidan.</TableCell></TableRow>
                ) : table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} onClick={() => openDetail(row.original)} className="cursor-pointer">
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
      <ReservationDetailDialog
        reservation={detail} clientId={clientId ?? 0}
        util={detail ? { last: util[detail.reservation_id]?.last, d7: util[detail.reservation_id]?.d7 } : {}}
        open={detailOpen} onOpenChange={setDetailOpen}
      />
    </AppShell>
  );
}
