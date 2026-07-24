import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable, type SortingState, type Table as RTTable,
} from "@tanstack/react-table";
import {
  Crown, ShieldOff, UserX, Clock3, UserCog, Layers, MoreHorizontal, RefreshCw, Download, History, Loader2,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import ClientHeader from "@/components/ClientHeader";
import DataTablePagination from "@/components/DataTablePagination";
import DataTableColumnHeader from "@/components/DataTableColumnHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import SearchInput from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listClientsAdmin, getAccessReview, syncAccessReview, listAccessReviewRuns, downloadFromApi,
} from "@/lib/api";
import { mfaChip, scopeLabel, graphStatusLabel, assignmentAlert } from "@/lib/accessReview";
import { resolveInitialClient, writeActiveClient } from "@/lib/clientSelection";
import { canEditModule } from "@/lib/auth";
import type {
  ClientAdmin, AccessAssignment, AccessGlobalAdmin, AccessGuest, AccessReviewResponse, AccessReviewRun,
} from "@/types";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

// Chip genérico (mismo idiom ad-hoc que ReservationsPage: span + clases Tailwind, sin componente nuevo).
const chip = (cls: string, text: React.ReactNode) => <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{text}</span>;

function dateOrDash(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString("es-EC") : "—";
}

function principalTypeLabel(t: AccessAssignment["principal_type"]): string {
  switch (t) {
    case "User": return "Usuario";
    case "Group": return "Grupo";
    case "ServicePrincipal": return "Service principal";
    default: return t;
  }
}

function enabledChip(v: boolean | null | undefined) {
  if (v === null || v === undefined) return chip("bg-muted text-muted-foreground", "—");
  return v
    ? chip("bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", "Sí")
    : chip("bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", "No");
}

function runStatusChip(s: AccessReviewRun["status"]) {
  switch (s) {
    case "ok": return { cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", label: "OK" };
    case "partial": return { cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", label: "Parcial" };
    case "error": return { cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", label: "Error" };
    case "running": return { cls: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300", label: "En curso" };
    default: return { cls: "bg-muted text-muted-foreground", label: "En cola" };
  }
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

// Bloque de tabla reutilizado por las 4 pestañas (mismo esqueleto que ReservationsPage: Table + DataTableColumnHeader
// + DataTablePagination). `rowClassName` es opcional: solo Asignaciones lo usa para resaltar filas con alerta.
function DataTableBlock<T>({ table, emptyText, rowClassName }: {
  table: RTTable<T>; emptyText: string; rowClassName?: (row: T) => string;
}) {
  return (
    <div className="space-y-3">
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
              <TableRow>
                <TableCell colSpan={table.getAllColumns().length} className="text-center text-muted-foreground py-8">
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className={rowClassName?.(row.original) ?? ""}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
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

const colAssign = createColumnHelper<AccessAssignment>();
const colAdmin = createColumnHelper<AccessGlobalAdmin>();
const colGuest = createColumnHelper<AccessGuest>();

const mfaCell = (m: AccessAssignment["mfa_status"] | AccessGuest["mfa_status"] | AccessGlobalAdmin["mfa_status"]) => {
  const c = mfaChip(m);
  return chip(c.cls, c.text);
};

const nameCell = (displayName: string | null, fallbackId: string) =>
  displayName ? <span className="font-medium">{displayName}</span> : <span className="font-mono text-xs">{fallbackId}</span>;

export default function AccessReviewPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const editable = canEditModule("access-review");

  const [clients, setClients] = useState<ClientAdmin[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [resp, setResp] = useState<AccessReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [dias, setDias] = useState(90);

  const runId = useRef(0);
  const mounted = useRef(true);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const firstDias = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const clearPoll = useCallback(() => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  }, []);

  // Carga (o recarga silenciosa) del snapshot. Si el estado devuelto es queued/running arranca
  // el polling cada 5s (anti-race con runId, igual que ReservationsPage) hasta llegar a un estado final.
  const load = useCallback((cid: number, days: number, opts?: { silent?: boolean }) => {
    const myRun = ++runId.current;
    clearPoll();
    if (opts?.silent) setRefreshing(true); else setLoading(true);
    setMessage("");
    getAccessReview(cid, days)
      .then((data) => {
        if (!mounted.current || myRun !== runId.current) return;
        setResp(data);
        if (data.status === "queued" || data.status === "running") {
          pollTimer.current = setInterval(() => {
            if (!mounted.current || myRun !== runId.current) { clearPoll(); return; }
            getAccessReview(cid, days)
              .then((next) => {
                if (!mounted.current || myRun !== runId.current) return;
                setResp(next);
                if (next.status !== "queued" && next.status !== "running") clearPoll();
              })
              .catch((e) => {
                if (mounted.current && myRun === runId.current) setMessage(`No se pudo actualizar el estado de la sincronización: ${msg(e)}`);
              });
          }, 5000);
        }
      })
      .catch((e) => {
        if (mounted.current && myRun === runId.current) {
          setMessage(`No se pudo cargar la revisión de accesos: ${msg(e)}`);
          toast.error(`No se pudo cargar la revisión de accesos: ${msg(e)}`);
        }
      })
      .finally(() => {
        if (mounted.current && myRun === runId.current) { setLoading(false); setRefreshing(false); }
      });
  }, [clearPoll]);

  useEffect(() => {
    listClientsAdmin().then((cs) => {
      setClients(cs);
      setClientId(resolveInitialClient(cs));
    }).catch((e) => toast.error(msg(e))).finally(() => setLoading(false));
  }, []);

  // Recarga completa al cambiar de cliente (limpia el polling anterior al desmontar/cambiar).
  useEffect(() => {
    if (clientId == null) return;
    load(clientId, dias);
    return () => clearPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, load]);

  // Umbral de inactividad: recalcula sin re-sincronizar (debounce 500ms), no afecta a la carga inicial.
  useEffect(() => {
    if (firstDias.current) { firstDias.current = false; return; }
    if (clientId == null) return;
    const t = setTimeout(() => load(clientId, dias, { silent: true }), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias]);

  function selectClient(id: number) { writeActiveClient(id); setClientId(id); }

  async function doSync() {
    if (clientId == null) return;
    setSyncing(true);
    try {
      await syncAccessReview(clientId);
      toast.success("Sincronización de accesos iniciada.");
      load(clientId, dias, { silent: true });
    } catch (e) {
      toast.error(`No se pudo iniciar la sincronización: ${msg(e)}`);
    } finally {
      if (mounted.current) setSyncing(false);
    }
  }

  async function doExport() {
    if (clientId == null) return;
    try {
      await downloadFromApi(`/cdc/clients/${clientId}/access-review/export?inactivity_days=${dias}`, "revision-accesos.xlsx");
      toast.success("Excel de revisión de accesos descargado.");
    } catch (e) {
      toast.error(`Error exportando Excel: ${msg(e)}`);
    }
  }

  // ---- Historial de corridas (diálogo) ----
  const [historyOpen, setHistoryOpen] = useState(false);
  const [runs, setRuns] = useState<AccessReviewRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  useEffect(() => {
    if (!historyOpen || clientId == null) return;
    setRunsLoading(true);
    listAccessReviewRuns(clientId)
      .then(setRuns)
      .catch((e) => toast.error(`No se pudo cargar el historial: ${msg(e)}`))
      .finally(() => setRunsLoading(false));
  }, [historyOpen, clientId]);

  const status = resp?.status ?? "none";
  const isRunning = status === "queued" || status === "running";
  const hasSnapshot = !!resp?.kpis;

  const assignments = useMemo(() => resp?.assignments ?? [], [resp]);
  const globalAdmins = useMemo(() => resp?.global_admins ?? [], [resp]);
  const guests = useMemo(() => resp?.guests ?? [], [resp]);
  const servicePrincipals = useMemo(() => assignments.filter((a) => a.principal_type === "ServicePrincipal"), [assignments]);

  // ---- KPIs (point 4) ----
  const gaCount = resp?.kpis?.global_admins ?? 0;
  const gaSinMfa = resp?.kpis?.global_admins_sin_mfa ?? 0;
  const gaAccent = gaSinMfa > 0 ? "#a53b35" : gaCount > 5 ? "#d9a82a" : "#70b043";
  const sinMfa = resp?.kpis?.internos_sin_mfa ?? 0;
  const deshabilitadas = resp?.kpis?.cuentas_deshabilitadas ?? 0;
  const inactivas = resp?.kpis?.cuentas_inactivas ?? 0;
  const guestsAlert = resp?.kpis?.guests_inactivos_con_permisos ?? 0;
  const totalAsign = resp?.kpis?.total_asignaciones ?? 0;

  // ---- Filtros de negocio sobre Asignaciones (point 7) ----
  const [q, setQ] = useState("");
  const [fScope, setFScope] = useState("all");
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  const scopeLevels = useMemo(
    () => [...new Set(assignments.map((a) => a.scope_level))].sort((a, b) => a.localeCompare(b)),
    [assignments],
  );

  const filteredAssignments = useMemo(() => {
    const term = q.trim().toLowerCase();
    return assignments.filter((a) => {
      if (term) {
        const hay = `${a.display_name ?? a.principal_object_id} ${a.login ?? ""} ${a.role_name} ${a.scope}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (fScope !== "all" && a.scope_level !== fScope) return false;
      if (onlyAlerts && !assignmentAlert(a, dias)) return false;
      return true;
    });
  }, [assignments, q, fScope, onlyAlerts, dias]);

  // ---- Columnas (memoizadas, sin dependencias de estado externo) ----
  const assignColumns = useMemo(() => [
    colAssign.accessor((a) => a.subscription_name || a.subscription_id, { id: "subscription", header: "Suscripción" }),
    colAssign.accessor("role_name", { header: "Rol" }),
    colAssign.accessor((a) => scopeLabel(a.scope_level), { id: "scope_level", header: "Nivel de scope" }),
    colAssign.accessor((a) => principalTypeLabel(a.principal_type), { id: "principal_type", header: "Tipo" }),
    colAssign.accessor((a) => a.display_name || a.principal_object_id, {
      id: "display_name", header: "Nombre",
      cell: (c) => nameCell(c.row.original.display_name, c.row.original.principal_object_id),
    }),
    colAssign.accessor((a) => a.login ?? "", { id: "login", header: "Correo/Login", cell: (c) => c.getValue() || "—" }),
    colAssign.accessor((a) => a.via_group_name || a.via_group_id || "", {
      id: "via_group", header: "Vía grupo",
      cell: (c) => {
        const { via_group_name, via_group_id } = c.row.original;
        if (via_group_name) return via_group_name;
        if (via_group_id) return <span className="font-mono text-xs">{via_group_id}</span>;
        return "—";
      },
    }),
    colAssign.accessor((a) => a.last_sign_in ?? "", { id: "last_sign_in", header: "Último login", cell: (c) => dateOrDash(c.row.original.last_sign_in) }),
    colAssign.accessor((a) => a.mfa_status ?? "", { id: "mfa", header: "MFA", cell: (c) => mfaCell(c.row.original.mfa_status) }),
  ], []);

  const spColumns = useMemo(() => [
    colAssign.accessor((a) => a.subscription_name || a.subscription_id, { id: "subscription", header: "Suscripción" }),
    colAssign.accessor("role_name", { header: "Rol" }),
    colAssign.accessor((a) => scopeLabel(a.scope_level), { id: "scope_level", header: "Nivel de scope" }),
    colAssign.accessor((a) => a.display_name || a.principal_object_id, {
      id: "display_name", header: "Nombre",
      cell: (c) => nameCell(c.row.original.display_name, c.row.original.principal_object_id),
    }),
    colAssign.accessor((a) => a.via_group_name || a.via_group_id || "", {
      id: "via_group", header: "Vía grupo",
      cell: (c) => {
        const { via_group_name, via_group_id } = c.row.original;
        if (via_group_name) return via_group_name;
        if (via_group_id) return <span className="font-mono text-xs">{via_group_id}</span>;
        return "—";
      },
    }),
  ], []);

  const adminColumns = useMemo(() => [
    colAdmin.accessor((a) => a.display_name || a.object_id, {
      id: "display_name", header: "Nombre",
      cell: (c) => nameCell(c.row.original.display_name, c.row.original.object_id),
    }),
    colAdmin.accessor((a) => a.upn ?? "", { id: "upn", header: "UPN", cell: (c) => c.getValue() || "—" }),
    colAdmin.accessor((a) => a.user_type ?? "", { id: "user_type", header: "Tipo", cell: (c) => c.getValue() || "—" }),
    colAdmin.accessor("account_enabled", { header: "Habilitada", cell: (c) => enabledChip(c.getValue()) }),
    colAdmin.accessor((a) => a.last_sign_in ?? "", { id: "last_sign_in", header: "Último login", cell: (c) => dateOrDash(c.row.original.last_sign_in) }),
    colAdmin.accessor((a) => a.mfa_status ?? "", { id: "mfa", header: "MFA", cell: (c) => mfaCell(c.row.original.mfa_status) }),
  ], []);

  const guestColumns = useMemo(() => [
    colGuest.accessor((g) => g.display_name || g.object_id, {
      id: "display_name", header: "Nombre",
      cell: (c) => nameCell(c.row.original.display_name, c.row.original.object_id),
    }),
    colGuest.accessor((g) => g.email ?? "", { id: "email", header: "Correo", cell: (c) => c.getValue() || "—" }),
    colGuest.accessor((g) => g.external_domain ?? "", { id: "external_domain", header: "Dominio externo", cell: (c) => c.getValue() || "—" }),
    colGuest.accessor("account_enabled", { header: "Habilitada", cell: (c) => enabledChip(c.getValue()) }),
    colGuest.accessor((g) => g.external_state ?? "", { id: "external_state", header: "Estado externo", cell: (c) => c.getValue() || "—" }),
    colGuest.accessor((g) => g.created_at_azure ?? "", { id: "created_at", header: "Creado", cell: (c) => dateOrDash(c.row.original.created_at_azure) }),
    colGuest.accessor((g) => g.last_sign_in ?? "", { id: "last_sign_in", header: "Último login", cell: (c) => dateOrDash(c.row.original.last_sign_in) }),
    colGuest.accessor((g) => g.roles_in_subs ?? "", { id: "roles", header: "Roles/Subs", cell: (c) => (c.getValue() ? <span className="text-xs">{c.getValue()}</span> : "—") }),
    colGuest.accessor((g) => g.mfa_status ?? "", { id: "mfa", header: "MFA", cell: (c) => mfaCell(c.row.original.mfa_status) }),
  ], []);

  const [assignSorting, setAssignSorting] = useState<SortingState>([]);
  const assignTable = useReactTable({
    data: filteredAssignments, columns: assignColumns,
    state: { sorting: assignSorting }, onSortingChange: setAssignSorting,
    enableColumnFilters: false,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const [spSorting, setSpSorting] = useState<SortingState>([]);
  const spTable = useReactTable({
    data: servicePrincipals, columns: spColumns,
    state: { sorting: spSorting }, onSortingChange: setSpSorting,
    enableColumnFilters: false,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const [adminSorting, setAdminSorting] = useState<SortingState>([]);
  const adminTable = useReactTable({
    data: globalAdmins, columns: adminColumns,
    state: { sorting: adminSorting }, onSortingChange: setAdminSorting,
    enableColumnFilters: false,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const [guestSorting, setGuestSorting] = useState<SortingState>([]);
  const guestTable = useReactTable({
    data: guests, columns: guestColumns,
    state: { sorting: guestSorting }, onSortingChange: setGuestSorting,
    enableColumnFilters: false,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const badCredentials = (resp?.credentials ?? []).filter((c) => c.arm_status !== "ok" || c.graph_status !== "ok");

  return (
    <AppShell title="Revisión de accesos" subtitle="Accesos y permisos RBAC del tenant del cliente"
      active="access-review" onNavigate={onNavigate}
      headerRight={<ClientHeader clients={clients} clientId={clientId} onSelect={selectClient} disabled={loading} />}>
      <BusyOverlay show={loading} title="Cargando revisión de accesos" />
      <div className="space-y-5">
        {message && <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">{message}</p>}

        {!loading && clientId == null && (
          <p className="text-muted-foreground">No hay clientes disponibles.</p>
        )}

        {!loading && clientId != null && status === "none" && (
          <div className="rounded-xl border bg-card p-10 text-center space-y-3">
            <p className="text-muted-foreground">Este cliente todavía no tiene una revisión de accesos generada.</p>
            {editable && (
              <Button onClick={doSync} disabled={syncing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />Sincronizar ahora
              </Button>
            )}
          </div>
        )}

        {!loading && clientId != null && isRunning && (
          <div className="rounded-xl border bg-card p-6 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <div>
              <p className="font-medium">Sincronización en curso…</p>
              <p className="text-sm text-muted-foreground">Puede tardar unos minutos según el tamaño del tenant; esta vista se actualiza sola.</p>
            </div>
          </div>
        )}

        {!loading && clientId != null && !isRunning && status !== "none" && !hasSnapshot && (
          <p className="text-muted-foreground">No hay datos de revisión de accesos disponibles para este cliente.</p>
        )}

        {!loading && clientId != null && !isRunning && hasSnapshot && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <Kpi icon={<Crown className="w-4 h-4" />} label="Global Admins" value={String(gaCount)} accent={gaAccent} />
              <Kpi icon={<ShieldOff className="w-4 h-4" />} label="Sin MFA" value={String(sinMfa)} accent={sinMfa > 0 ? "#a53b35" : "#70b043"} />
              <Kpi icon={<UserX className="w-4 h-4" />} label="Deshabilitadas con RBAC" value={String(deshabilitadas)} accent={deshabilitadas > 0 ? "#a53b35" : "#70b043"} />
              <Kpi icon={<Clock3 className="w-4 h-4" />} label="Inactivas con RBAC" value={String(inactivas)} accent={inactivas > 0 ? "#a53b35" : "#70b043"} />
              <Kpi icon={<UserCog className="w-4 h-4" />} label="Guests inactivos c/permisos" value={String(guestsAlert)} accent={guestsAlert > 0 ? "#a53b35" : "#70b043"} />
              <Kpi icon={<Layers className="w-4 h-4" />} label="Asignaciones" value={String(totalAsign)} accent="#a3c243" />
            </div>

            {badCredentials.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {badCredentials.map((c) => {
                  const parts: string[] = [];
                  if (c.arm_status !== "ok") parts.push("ARM: error");
                  if (c.graph_status !== "ok") parts.push(graphStatusLabel(c.graph_status));
                  const hard = c.arm_status !== "ok" || c.graph_status === "error";
                  return (
                    <span key={c.credential_id} title={c.detail ?? undefined}
                      className={`text-xs px-2 py-0.5 rounded-full ${hard ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>
                      {(c.credential_name ?? `Credencial ${c.credential_id}`)}: {parts.join(" · ")}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <label className="flex items-center gap-2">
                Umbral de inactividad (días):
                <Input type="number" min={1} max={3650} value={dias}
                  onChange={(e) => setDias(Math.min(3650, Math.max(1, Number(e.target.value) || 90)))}
                  className="h-8 w-20 text-foreground" aria-label="Umbral de inactividad en días" />
              </label>
              {refreshing && <span className="text-primary">Recalculando…</span>}
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9"><MoreHorizontal className="w-4 h-4 mr-1" />Opciones</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled={!editable || syncing} onClick={doSync}>
                      <RefreshCw className="w-4 h-4 mr-2" />Sincronizar ahora
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={doExport}>
                      <Download className="w-4 h-4 mr-2" />Exportar Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
                      <History className="w-4 h-4 mr-2" />Historial de corridas
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <Tabs defaultValue="assignments">
              <TabsList>
                <TabsTrigger value="assignments">Asignaciones</TabsTrigger>
                <TabsTrigger value="admins">Global Admins</TabsTrigger>
                <TabsTrigger value="guests">Guests</TabsTrigger>
                <TabsTrigger value="sp">Service principals</TabsTrigger>
              </TabsList>

              <TabsContent value="assignments" className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SearchInput placeholder="Buscar nombre, login, rol o scope…" value={q} onChange={setQ} className="w-[260px] max-w-full" inputClassName="h-9" aria-label="Buscar asignaciones" />
                  <Select value={fScope} onValueChange={setFScope}>
                    <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Nivel de scope: todos</SelectItem>
                      {scopeLevels.map((lvl) => <SelectItem key={lvl} value={lvl}>{scopeLabel(lvl)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" checked={onlyAlerts} onChange={(e) => setOnlyAlerts(e.target.checked)} className="accent-primary h-4 w-4" />
                    Solo con alertas
                  </label>
                  <div className="text-xs text-muted-foreground ml-auto">
                    {assignments.length ? `${filteredAssignments.length} de ${assignments.length} asignaciones` : ""}
                  </div>
                </div>
                <DataTableBlock
                  table={assignTable}
                  emptyText={assignments.length ? "Sin asignaciones que coincidan con los filtros." : "Este cliente no tiene asignaciones RBAC activas registradas."}
                  rowClassName={(a) => (assignmentAlert(a, dias) ? "bg-red-50 dark:bg-red-950/30" : "")}
                />
              </TabsContent>

              <TabsContent value="admins">
                <DataTableBlock table={adminTable} emptyText="No se encontraron Global Administrators." />
              </TabsContent>

              <TabsContent value="guests">
                <DataTableBlock table={guestTable} emptyText="No se encontraron cuentas guest." />
              </TabsContent>

              <TabsContent value="sp">
                <DataTableBlock table={spTable} emptyText="No se encontraron service principals con asignaciones RBAC." />
              </TabsContent>
            </Tabs>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground border-t pt-3">
              <span>{resp?.finished_at ? `Última sincronización: ${dateOrDash(resp.finished_at)}` : "Sin sincronizaciones registradas."}</span>
              <span>Solo asignaciones activas: los roles elegibles vía PIM y los Classic administrators no se incluyen.</span>
            </div>
          </>
        )}
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de corridas</DialogTitle>
          </DialogHeader>
          {runsLoading ? (
            <p className="text-sm text-muted-foreground py-6">Cargando…</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">Sin corridas registradas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => {
                  const s = runStatusChip(r.status);
                  return (
                    <TableRow key={r.run_id}>
                      <TableCell className="tabular-nums">{r.run_id}</TableCell>
                      <TableCell>{chip(s.cls, s.label)}</TableCell>
                      <TableCell>{dateOrDash(r.started_at)}</TableCell>
                      <TableCell>{dateOrDash(r.finished_at)}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={r.error ?? undefined}>{r.error ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
