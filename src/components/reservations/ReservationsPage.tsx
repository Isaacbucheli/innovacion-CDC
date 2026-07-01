import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable, type SortingState, type VisibilityState,
} from "@tanstack/react-table";
import { CalendarClock, CalendarX, Columns3, Layers, Gauge, Download, RefreshCw, MoreHorizontal, Rows3, Rows4 } from "lucide-react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import WafClientHeader from "@/components/waf/WafClientHeader";
import DataTablePagination from "@/components/DataTablePagination";
import DataTableColumnHeader from "@/components/DataTableColumnHeader";
import ReservationDetailDialog from "@/components/reservations/ReservationDetailDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import SearchInput from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listClientsAdmin, getReservations, getReservationUtilization } from "@/lib/api";
import {
  situacion, isInactive, RES_INACTIVE_STATES, utilChip, utilBucket, daysChip, daysLabel, stateChip, utilNum,
} from "@/lib/reservations";
import { resolveInitialClient, writeActiveClient } from "@/lib/clientSelection";
import type { ClientAdmin, Reservation } from "@/types";

type Util = { last?: string | null; d7?: string | null; pending?: boolean };
const col = createColumnHelper<Reservation>();

// Timeout por petición de utilización: si una llamada se cuelga (fetch sin AbortController),
// rechaza tras N ms para que el worker la marque "n/d" y utilPending siempre llegue a 0
// (si no, el selector de cliente y "Actualizar" quedarían deshabilitados para siempre).
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

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
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [detail, setDetail] = useState<Reservation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "days_remaining", desc: false }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [dense, setDense] = useState(false);
  // Filtros de negocio (client-side), espejo del módulo original.
  const [q, setQ] = useState("");
  const [fVigencia, setFVigencia] = useState("all");
  const [fEstado, setFEstado] = useState("all");
  const [fU1, setFU1] = useState("all");
  const [fU7, setFU7] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const runId = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function loadUtilization(cid: number, pending: Reservation[], myRun: number) {
    let i = 0;
    const worker = async () => {
      while (i < pending.length) {
        const r = pending[i++];
        if (myRun !== runId.current) return;
        try {
          const u = await withTimeout(getReservationUtilization(cid, r.credential_id, r.reservation_id), 45000);
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

  // Carga fase 1 (lista) + fase 2 (utilización). alert_days sólo se envía en la carga;
  // los filtros y KPIs se recalculan client-side sin volver a llamar la API.
  const reload = useCallback((cid: number, days: number) => {
    const myRun = ++runId.current;
    setLoading(true); setMessage(""); setRows([]); setUtil({}); setGeneratedAt(null);
    getReservations(cid, days, false).then((data) => {
      if (!mounted.current || myRun !== runId.current) return;
      const res = data.reservations ?? [];
      setRows(res);
      setGeneratedAt(data.generated_at ?? null);
      if (data.has_credentials === false) setMessage(data.message || "El cliente no tiene credenciales Azure activas.");
      else if (data.errors?.length) setMessage(`No se pudieron leer reservas de ${data.errors.length} credencial(es). Verifica el rol Reservations Reader del App Registration.`);
      else if (!res.length) setMessage("Este cliente no tiene reservas visibles en Azure.");
      const pending = res.filter((r) => !isInactive(r));
      setUtil(Object.fromEntries(pending.map((r) => [r.reservation_id, { pending: true } as Util])));
      void loadUtilization(cid, pending, myRun);
    }).catch((e) => {
      if (mounted.current && myRun === runId.current) setMessage(`No se pudieron cargar las reservas: ${e instanceof Error ? e.message : e}`);
    }).finally(() => { if (mounted.current && myRun === runId.current) setLoading(false); });
  }, []);

  useEffect(() => {
    listClientsAdmin().then((cs) => {
      setClients(cs);
      setClientId(resolveInitialClient(cs));
    }).catch((e) => toast.error(e instanceof Error ? e.message : String(e))).finally(() => setLoading(false));
  }, []);

  // Recarga sólo al cambiar de cliente (alertDays es client-side).
  useEffect(() => { if (clientId != null) reload(clientId, alertDays); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clientId, reload]);

  function selectClient(id: number) { writeActiveClient(id); setClientId(id); }
  function openDetail(r: Reservation) { setDetail(r); setDetailOpen(true); }

  // Estados de Azure presentes (para el filtro dinámico).
  const estados = useMemo(() => [...new Set(rows.map((r) => r.state).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [rows]);

  // Filtro de negocio (espejo de cdcFiltered).
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const estadoInactive = RES_INACTIVE_STATES.includes(fEstado.toLowerCase());
    return rows.filter((r) => {
      if (!showInactive && !estadoInactive && isInactive(r)) return false;
      if (term && !`${r.name} ${r.product} ${r.region}`.toLowerCase().includes(term)) return false;
      if (fVigencia !== "all" && situacion(r, alertDays) !== fVigencia) return false;
      if (fEstado !== "all" && (r.state || "") !== fEstado) return false;
      if (fU1 !== "all" && utilBucket(util[r.reservation_id]?.last) !== fU1) return false;
      if (fU7 !== "all" && utilBucket(util[r.reservation_id]?.d7) !== fU7) return false;
      return true;
    });
  }, [rows, util, q, fVigencia, fEstado, fU1, fU7, showInactive, alertDays]);

  const expiring = useMemo(() => rows.filter((r) => situacion(r, alertDays) === "por").length, [rows, alertDays]);
  const expired = useMemo(() => rows.filter((r) => r.expired || r.days_remaining < 0).length, [rows]);
  const utilTotal = Object.keys(util).length;
  const utilDone = Object.values(util).filter((u) => !u.pending).length;
  const utilPending = utilTotal - utilDone;
  const avgUse = useMemo(() => {
    if (utilPending > 0) return "…";
    const ns = Object.values(util).map((u) => utilNum(u.d7)).filter((n): n is number => n !== null);
    return ns.length ? `${Math.round(ns.reduce((s, n) => s + n, 0) / ns.length)}%` : "n/d";
  }, [util, utilPending]);

  const chip = (cls: string, text: React.ReactNode) => <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{text}</span>;
  const usoCell = (id: string, pick: (u: Util) => string | null | undefined) => {
    const u = util[id];
    if (u?.pending) return <span className="text-xs text-muted-foreground">…</span>;
    const v = u ? pick(u) : null;
    return chip(utilChip(v), v ?? "n/d");
  };

  const columns = useMemo(() => [
    col.accessor("name", { header: "Reserva", cell: (c) => <span className="font-medium">{c.getValue()}</span> }),
    col.accessor("product", { header: "Producto" }),
    col.accessor("region", { header: "Región" }),
    col.accessor("quantity", { header: "Cant.", cell: (c) => <span className="tabular-nums">{c.getValue()}</span> }),
    col.accessor((r) => r.term_label || r.term, { id: "term", header: "Término" }),
    col.accessor("expires_on", { header: "Caduca" }),
    col.accessor("days_remaining", { header: "Días", sortingFn: "basic", cell: (c) => chip(daysChip(c.row.original), daysLabel(c.row.original)) }),
    col.accessor((r) => utilNum(util[r.reservation_id]?.last) ?? -1, { id: "u1", header: "Uso 1d", sortingFn: "basic", cell: (c) => usoCell(c.row.original.reservation_id, (u) => u.last) }),
    col.accessor((r) => utilNum(util[r.reservation_id]?.d7) ?? -1, { id: "u7", header: "Uso 7d", sortingFn: "basic", cell: (c) => usoCell(c.row.original.reservation_id, (u) => u.d7) }),
    col.accessor("state", { header: "Estado", cell: (c) => chip(stateChip(c.getValue()), c.getValue()) }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [util]);

  const table = useReactTable({
    data: filtered, columns,
    state: { sorting, columnVisibility }, onSortingChange: setSorting, onColumnVisibilityChange: setColumnVisibility,
    enableColumnFilters: false, // el filtrado va en la barra de negocio, no por columna
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });
  const pad = dense ? "py-1.5" : "py-3";

  function exportCsv() {
    const out = table.getSortedRowModel().rows.map((r) => r.original);
    if (!out.length) return;
    const head = ["Reserva", "Producto", "Región", "Cantidad", "Término", "Caduca", "Días para caducar", "Uso 1 día", "Uso 7 días", "Estado"];
    const cell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const lines = out.map((r) => [
      r.name, r.product, r.region, r.quantity, r.term_label || r.term, r.expires_on, r.days_remaining,
      util[r.reservation_id]?.last ?? "", util[r.reservation_id]?.d7 ?? "", r.state,
    ].map(cell).join(","));
    const csv = [head.map(cell).join(","), ...lines].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "reservas-por-vencer.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  const hasFilters = q || fVigencia !== "all" || fEstado !== "all" || fU1 !== "all" || fU7 !== "all";
  const usoOpts = [["all", "Uso: todos"], ["nd", "Sin dato"], ["low", "Bajo (<30%)"], ["mid", "Medio (30-69%)"], ["high", "Alto (≥70%)"]];

  return (
    <AppShell title="Reservas por vencer" subtitle="Gestión CDC · reservas de capacidad Azure"
      active="reservations" onNavigate={onNavigate}
      headerRight={<WafClientHeader clients={clients} clientId={clientId} onSelect={selectClient} disabled={loading || utilPending > 0} />}>
      <BusyOverlay show={loading} title="Cargando reservas" />
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={<Layers className="w-4 h-4" />} label="Reservas" value={String(rows.length)} accent="#a3c243" />
          <Kpi icon={<CalendarClock className="w-4 h-4" />} label={`Por vencer (≤${alertDays}d)`} value={String(expiring)} accent="#d9a82a" />
          <Kpi icon={<CalendarX className="w-4 h-4" />} label="Vencidas" value={String(expired)} accent="#a53b35" />
          <Kpi icon={<Gauge className="w-4 h-4" />} label="Uso prom. 7 días" value={avgUse} accent="#70b043" />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {generatedAt && !Number.isNaN(new Date(generatedAt).getTime()) && <span>Actualizado: {new Date(generatedAt).toLocaleString("es-EC")}</span>}
          {utilPending > 0 && <span className="text-primary">Calculando utilización {utilDone}/{utilTotal}…</span>}
        </div>

        {message && <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">{message}</p>}

        <div className="space-y-3">
          {/* Barra de filtros de negocio (espejo del módulo original) */}
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput placeholder="Buscar reserva, producto o región…" value={q} onChange={setQ} className="w-[240px] max-w-full" inputClassName="h-9" aria-label="Buscar reservas" />
            <Select value={fVigencia} onValueChange={setFVigencia}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vigencia: todas</SelectItem>
                <SelectItem value="por">Por vencer</SelectItem>
                <SelectItem value="vig">Vigentes</SelectItem>
                <SelectItem value="venc">Vencidas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fEstado} onValueChange={setFEstado}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Estado: todos</SelectItem>
                {estados.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fU1} onValueChange={setFU1}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>{usoOpts.map(([v, l]) => <SelectItem key={v} value={v}>{l.replace("Uso:", "Uso 1d:")}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={fU7} onValueChange={setFU7}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>{usoOpts.map(([v, l]) => <SelectItem key={v} value={v}>{l.replace("Uso:", "Uso 7d:")}</SelectItem>)}</SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-primary h-4 w-4" />
              Mostrar vencidas/canceladas
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Aviso (días):
              <Input type="number" min={1} max={365} value={alertDays}
                onChange={(e) => setAlertDays(Math.min(365, Math.max(1, Number(e.target.value) || 30)))}
                className="h-9 w-20" aria-label="Días de aviso" />
            </label>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-9" onClick={() => { setQ(""); setFVigencia("all"); setFEstado("all"); setFU1("all"); setFU7("all"); }}>Limpiar</Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-9" aria-label="Cambiar densidad de la tabla" onClick={() => setDense((d) => !d)}>
                {dense ? <Rows4 className="w-4 h-4 mr-1" /> : <Rows3 className="w-4 h-4 mr-1" />}
                {dense ? "Cómoda" : "Compacta"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9"><Columns3 className="w-4 h-4 mr-1" />Columnas</Button>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9"><MoreHorizontal className="w-4 h-4 mr-1" />Acciones</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportCsv} disabled={!filtered.length}><Download className="w-4 h-4 mr-2" />Exportar CSV</DropdownMenuItem>
                  <DropdownMenuItem disabled={loading || utilPending > 0} onClick={() => clientId != null && reload(clientId, alertDays)}><RefreshCw className="w-4 h-4 mr-2" />Actualizar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            {rows.length ? `${filtered.length} de ${rows.length} reservas` : ""}
          </div>

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
                  <TableRow><TableCell colSpan={table.getAllColumns().length} className="text-center text-muted-foreground py-8">
                    {rows.length ? "Sin reservas que coincidan con los filtros." : "Este cliente no tiene reservas registradas en Azure."}
                  </TableCell></TableRow>
                ) : table.getRowModel().rows.map((row) => {
                  const porVencer = situacion(row.original, alertDays) === "por";
                  return (
                    <TableRow key={row.id} onClick={() => openDetail(row.original)}
                      className={`cursor-pointer ${porVencer ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={pad}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  );
                })}
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
