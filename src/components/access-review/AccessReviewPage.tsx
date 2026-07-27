import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createColumnHelper, flexRender, getCoreRowModel, getExpandedRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable, type ExpandedState, type RowSelectionState, type SortingState,
  type Table as RTTable,
} from "@tanstack/react-table";
import {
  Crown, ShieldOff, UserX, Clock3, UserCog, Layers, MoreHorizontal, RefreshCw, Download, History, Loader2, X,
  Users, ShieldAlert, KeyRound, Globe, Wrench, ChevronRight, ChevronDown, Filter, ClipboardCheck,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import FindingsPanel from "@/components/access-review/FindingsPanel";
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
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  listClientsAdmin, getAccessReview, syncAccessReview, listAccessReviewRuns, downloadFromApi,
  saveAccessDecisions, acceptAccessFinding,
} from "@/lib/api";
import {
  mfaChip, scopeLabel, graphStatusLabel, assignmentAlert, daysSince, principalTypeLabel,
  roleClassLabel, roleClassChip, externalLabel, externalChip, viaLabel, livesInTenant, distinctRoles,
  decisionChip, decisionLabel, decisionSummary, decisionTitle,
} from "@/lib/accessReview";
import { resolveInitialClient, writeActiveClient } from "@/lib/clientSelection";
import { canEditModule } from "@/lib/auth";
import type {
  ClientAdmin, AccessAccount, AccessAssignment, AccessDecisionValue, AccessFinding, AccessGlobalAdmin,
  AccessGuest, AccessReviewResponse, AccessReviewRun, AccessRoleClass,
} from "@/types";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

// Chip genérico (mismo idiom ad-hoc que ReservationsPage: span + clases Tailwind, sin componente nuevo).
const chip = (cls: string, text: React.ReactNode) => <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{text}</span>;

function dateOrDash(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString("es-EC") : "—";
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

// Contador compacto: uso interno, así que la primera pantalla es para trabajar (la tabla), no para
// lucir indicadores. `muted` lo degrada a "no medido" cuando la corrida no tiene el dato completo
// (ver graphIncomplete/inactivityIncomplete más abajo): nada de verde/rojo sobre un 0 que en
// realidad nunca se llegó a medir. `hint` es un title nativo, sin componente nuevo. Con `onClick`
// se vuelve botón (filtra la tabla correspondiente); en estado muted no hay clic porque filtrar
// por un dato no medido no significa nada.
function Counter({ icon, label, value, accent, muted, hint, onClick, active }: {
  icon: React.ReactNode; label: string; value: string; accent?: string; muted?: boolean; hint?: string;
  onClick?: () => void; active?: boolean;
}) {
  const inner = (
    <>
      <span className={muted ? "text-muted-foreground" : ""} style={muted ? undefined : { color: accent }}>
        {icon}
      </span>
      <span className={`text-lg font-bold tabular-nums leading-none ${muted ? "text-muted-foreground" : ""}`}>
        {value}
      </span>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">
        {label}
      </span>
    </>
  );
  const base = "flex items-center gap-2 rounded-lg border bg-background px-3 py-2";
  if (!onClick || muted) return <div className={base} title={hint}>{inner}</div>;
  return (
    <button type="button" onClick={onClick} title={hint} aria-pressed={active}
      className={`${base} text-left transition-colors cursor-pointer hover:border-primary/60 ${active ? "border-primary ring-1 ring-primary" : ""}`}>
      {inner}
    </button>
  );
}

// Bloque de tabla reutilizado por las 5 pestañas (mismo esqueleto que ReservationsPage: Table + DataTableColumnHeader
// + DataTablePagination). `rowClassName` es opcional: Asignaciones y Cuentas lo usan para resaltar filas con
// alerta. `subRow` lo usa solo Cuentas: al expandir, lista las asignaciones de esa cuenta sin sacar al
// consultor de la tabla (un diálogo le haría perder el contexto de la lista).
function DataTableBlock<T>({ table, emptyText, rowClassName, subRow }: {
  table: RTTable<T>; emptyText: string; rowClassName?: (row: T) => string;
  subRow?: (row: T) => React.ReactNode;
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
                    {/* Cabeceras con nodo (la de selección múltiple) se renderizan tal cual:
                        DataTableColumnHeader espera un título de texto. */}
                    {h.isPlaceholder ? null
                      : typeof h.column.columnDef.header === "string"
                        ? <DataTableColumnHeader column={h.column} title={h.column.columnDef.header} />
                        : flexRender(h.column.columnDef.header, h.getContext())}
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
              <React.Fragment key={row.id}>
                <TableRow className={rowClassName?.(row.original) ?? ""}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
                {subRow && row.getIsExpanded() && (
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={row.getVisibleCells().length} className="py-3">
                      {subRow(row.original)}
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}

const colAssign = createColumnHelper<AccessAssignment>();
const colAccount = createColumnHelper<AccessAccount>();
const colAdmin = createColumnHelper<AccessGlobalAdmin>();
const colGuest = createColumnHelper<AccessGuest>();

const ROLE_CLASSES: Exclude<AccessRoleClass, null>[] =
  ["owner", "otorga_accesos", "escritura_total", "escritura_servicio", "lectura"];

const mfaCell = (m: AccessAssignment["mfa_status"] | AccessGuest["mfa_status"] | AccessGlobalAdmin["mfa_status"]) => {
  const c = mfaChip(m);
  return chip(c.cls, c.text);
};

const nameCell = (displayName: string | null, fallbackId: string, orphan = false) =>
  displayName ? <span className="font-medium">{displayName}</span> : (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <span className="font-mono text-xs">{fallbackId}</span>
      {orphan && (
        <span
          title="Asignación RBAC a un principal que ya no existe en Entra ID (en el portal aparece como 'Identity not found'). Acceso residual: conviene eliminarla."
          className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
          Eliminado de Entra ID
        </span>
      )}
    </span>
  );

// Filtros que aplican los contadores sobre la tabla de Asignaciones. Los tres primeros replican el
// criterio de AccessReviewKpiCalculator (API): solo usuarios, y el contador cuenta cuentas únicas,
// así que la tabla puede mostrar más filas que el número del contador (una cuenta con N roles = N
// asignaciones). Los tres últimos son por asignación, sin filtrar por tipo de principal.
type KpiAssignFilter = "sin_mfa" | "deshabilitadas" | "inactivas" | "elevadas" | "owner" | "personalizados";

const KPI_FILTER_LABEL: Record<KpiAssignFilter, string> = {
  sin_mfa: "Sin MFA (internos)",
  deshabilitadas: "Deshabilitadas con RBAC",
  inactivas: "Inactivas con RBAC",
  elevadas: "Privilegio elevado",
  owner: "Asignaciones Owner",
  personalizados: "Roles personalizados",
};

/** Filtros que los contadores aplican sobre la tabla de Cuentas. */
type KpiAccountFilter = "externas" | "owners_externos";

const ACCOUNT_FILTER_LABEL: Record<KpiAccountFilter, string> = {
  externas: "Cuentas externas",
  owners_externos: "Externas con Owner",
};

/** Filtro por decisión sobre Asignaciones. "pendiente" (sin decisión registrada) es la cola de
 *  trabajo real del módulo, y es a donde apunta el contador "Pendientes". */
type DecisionFilter = "all" | "pendiente" | AccessDecisionValue;

const DECISION_FILTER_LABEL: Record<Exclude<DecisionFilter, "all">, string> = {
  pendiente: "Pendientes",
  mantener: "Mantener",
  revocar: "Revocar",
  justificado: "Justificado",
};

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
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstDias = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const clearPoll = useCallback(() => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  }, []);

  const clearDebounce = useCallback(() => {
    if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null; }
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

  // Recarga completa al cambiar de cliente (limpia el polling anterior y cualquier debounce
  // de umbral pendiente del cliente previo al desmontar/cambiar — evita el race de cliente obsoleto).
  useEffect(() => {
    if (clientId == null) return;
    load(clientId, dias);
    return () => { clearPoll(); clearDebounce(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, load]);

  // Umbral de inactividad: recalcula sin re-sincronizar (debounce 500ms), no afecta a la carga inicial.
  useEffect(() => {
    if (firstDias.current) { firstDias.current = false; return; }
    if (clientId == null) return;
    clearDebounce();
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      load(clientId, dias, { silent: true });
    }, 500);
    return clearDebounce;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias]);

  // Al cambiar de cliente se descarta el drill-down de tarjetas (es estado del snapshot anterior).
  function selectClient(id: number) {
    writeActiveClient(id); setClientId(id);
    setKpiFilter(null); setGuestsOnlyAlert(false); setAccountFilter(null); setFindingFilter(null);
    setFDecision("all");
  }

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

  const [exporting, setExporting] = useState(false);
  async function doExport() {
    if (clientId == null) return;
    setExporting(true);
    try {
      await downloadFromApi(`/cdc/clients/${clientId}/access-review/export?inactivity_days=${dias}`, "revision-accesos.xlsx");
      toast.success("Excel de revisión de accesos descargado.");
    } catch (e) {
      toast.error(`Error exportando Excel: ${msg(e)}`);
    } finally {
      if (mounted.current) setExporting(false);
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
      .then((data) => { if (mounted.current) setRuns(data); })
      .catch((e) => toast.error(`No se pudo cargar el historial: ${msg(e)}`))
      .finally(() => { if (mounted.current) setRunsLoading(false); });
  }, [historyOpen, clientId]);

  const status = resp?.status ?? "none";
  const isRunning = status === "queued" || status === "running";
  const hasSnapshot = !!resp?.kpis;

  const assignments = useMemo(() => resp?.assignments ?? [], [resp]);
  const accounts = useMemo(() => resp?.accounts ?? [], [resp]);
  const findings = useMemo(() => resp?.findings ?? [], [resp]);
  const globalAdmins = useMemo(() => resp?.global_admins ?? [], [resp]);
  const guests = useMemo(() => resp?.guests ?? [], [resp]);
  const servicePrincipals = useMemo(() => assignments.filter((a) => a.principal_type === "ServicePrincipal"), [assignments]);
  const credentials = useMemo(() => resp?.credentials ?? [], [resp]);

  // Corrida anterior a la clasificación de privilegio: sin re-sincronizar no hay clase que mostrar.
  const sinClasificar = useMemo(
    () => assignments.length > 0 && assignments.every((a) => a.role_class == null),
    [assignments],
  );

  // Zonas de la corrida no medidas: si el Graph no se pudo leer del todo (sin consent, Lighthouse
  // sin permisos ARM-only, error) o la corrida completa terminó en "error", los indicadores que
  // vienen de Entra ID (MFA, cuentas habilitadas/deshabilitadas, Global Admins, guests) no reflejan
  // datos reales — deben mostrarse como "no medido", nunca como un 0 verde.
  // Lo decide el backend (`graph_complete`), que es la misma regla que usa el AccountBuilder para el
  // eje interna/externa y el marcado de huérfanas. El cálculo local queda solo como respaldo para
  // corridas servidas por una API anterior a este campo (ventana de deploy).
  const graphIncomplete = useMemo(
    () => resp?.graph_complete !== undefined
      ? !resp.graph_complete
      : status === "error" || credentials.some((c) => c.graph_status === "sin_consent" || c.graph_status === "no_aplica" || c.graph_status === "error"),
    [resp?.graph_complete, status, credentials],
  );
  // La inactividad además depende del "último inicio de sesión", que requiere licencia Entra ID P1;
  // sin ella (aunque el resto de Graph haya funcionado) esa cifra puntual tampoco está medida.
  const inactivityIncomplete = useMemo(
    () => graphIncomplete || credentials.some((c) => c.graph_status === "sin_licencia_p1"),
    [graphIncomplete, credentials],
  );

  // Asignación huérfana: el principal ya no existe en Entra ID ("Identity not found" en el portal).
  // Solo se afirma con la fase Graph completa: si Graph falló, un nombre vacío significa "no
  // resuelto", no "eliminado". Las filas derivadas (vía grupo) vienen de miembros vivos.
  // `livesInTenant` es clave: un ForeignGroup (grupo de otro tenant), un Device o un principal sin
  // tipo NO viven en el directorio del cliente, así que su nombre vacío es lo esperado y marcarlos
  // "Eliminado de Entra ID" sería un falso positivo.
  const isOrphanAssignment = useCallback(
    (a: AccessAssignment) =>
      !graphIncomplete && livesInTenant(a.principal_type) && !a.display_name && !a.via_group_id,
    [graphIncomplete],
  );

  // ---- KPIs (point 4) ----
  const gaCount = resp?.kpis?.global_admins ?? 0;
  const gaSinMfa = resp?.kpis?.global_admins_sin_mfa ?? 0;
  const gaAccent = gaSinMfa > 0 ? "#a53b35" : gaCount > 5 ? "#d9a82a" : "#70b043";
  const sinMfa = resp?.kpis?.internos_sin_mfa ?? 0;
  const deshabilitadas = resp?.kpis?.cuentas_deshabilitadas ?? 0;
  const inactivas = resp?.kpis?.cuentas_inactivas ?? 0;
  const guestsAlert = resp?.kpis?.guests_inactivos_con_permisos ?? 0;
  const totalAsign = resp?.kpis?.total_asignaciones ?? 0;
  const cuentasUnicas = resp?.kpis?.cuentas_unicas ?? 0;
  const pctElevadas = resp?.kpis?.pct_elevadas ?? 0;
  const owners = resp?.kpis?.owners ?? 0;
  const externas = resp?.kpis?.cuentas_externas ?? 0;
  const ownersExternos = resp?.kpis?.owners_externos ?? 0;
  const rolesCustom = resp?.kpis?.roles_personalizados ?? 0;
  const pendientes = resp?.kpis?.pendientes_de_revisar ?? 0;

  // ---- Filtros de negocio sobre Asignaciones (point 7) ----
  const [q, setQ] = useState("");
  const [fScope, setFScope] = useState("all");
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [onlyElevated, setOnlyElevated] = useState(false);
  const [fRole, setFRole] = useState("all");
  const [fSub, setFSub] = useState("all");
  const [fType, setFType] = useState("all");
  const [fClass, setFClass] = useState("all");
  const [fExternal, setFExternal] = useState("all");
  const [fDecision, setFDecision] = useState<DecisionFilter>("all");

  // ---- Drill-down desde los contadores ----
  const [tab, setTab] = useState("accounts");
  const [kpiFilter, setKpiFilter] = useState<KpiAssignFilter | null>(null);
  const [guestsOnlyAlert, setGuestsOnlyAlert] = useState(false);
  const [accountFilter, setAccountFilter] = useState<KpiAccountFilter | null>(null);
  const [qAccount, setQAccount] = useState("");
  // Drill-down de un hallazgo: se guarda la lista de principals en un Set para no recorrer un array
  // de cientos de ids por cada fila de la tabla.
  const [findingFilter, setFindingFilter] = useState<{ key: string; title: string; principals: Set<string> } | null>(null);

  // Clic en contador: lleva a la pestaña correspondiente y aplica su filtro
  // (clic de nuevo sobre el contador activo lo quita).
  function toggleKpiFilter(f: KpiAssignFilter) {
    setTab("assignments");
    setKpiFilter((prev) => (prev === f ? null : f));
  }
  function toggleGuestsAlert() {
    setTab("guests");
    setGuestsOnlyAlert((prev) => !prev);
  }
  function toggleAccountFilter(f: KpiAccountFilter) {
    setTab("accounts");
    setAccountFilter((prev) => (prev === f ? null : f));
  }
  // Contador "Asignaciones": muestra la tabla completa (limpia todos los filtros).
  function showAllAssignments() {
    setTab("assignments");
    clearAssignFilters();
  }
  function clearAssignFilters() {
    setKpiFilter(null); setQ(""); setFScope("all"); setOnlyAlerts(false); setOnlyElevated(false);
    setFRole("all"); setFSub("all"); setFType("all"); setFClass("all"); setFExternal("all");
    setFDecision("all");
  }
  // Contador "Pendientes": la cola de trabajo. Lleva a Asignaciones con el filtro de decisión en
  // "Pendientes" y limpia el filtro de otros contadores (cruzar dos criterios daría una tabla vacía
  // sin explicación).
  function togglePendientes() {
    setTab("assignments");
    setKpiFilter(null);
    setFDecision((prev) => (prev === "pendiente" ? "all" : "pendiente"));
  }
  // Contador "Cuentas": tabla completa de cuentas.
  function showAllAccounts() {
    setTab("accounts");
    setAccountFilter(null); setQAccount(""); setFindingFilter(null);
  }
  // Clic en "Ver cuentas" de un hallazgo. Se limpia el filtro de contadores: combinar dos criterios
  // sin avisar daría una tabla vacía sin explicación.
  function drillDownFinding(f: AccessFinding) {
    setTab("accounts");
    setAccountFilter(null);
    setFindingFilter({ key: f.key, title: f.title, principals: new Set(f.affected_principals) });
  }

  const scopeLevels = useMemo(
    () => [...new Set(assignments.map((a) => a.scope_level))].sort((a, b) => a.localeCompare(b)),
    [assignments],
  );
  const roles = useMemo(() => distinctRoles(assignments), [assignments]);
  const subs = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assignments) map.set(a.subscription_id, a.subscription_name || a.subscription_id);
    return [...map].sort((x, y) => x[1].localeCompare(y[1], "es"));
  }, [assignments]);
  const principalTypes = useMemo(
    () => [...new Set(assignments.map((a) => a.principal_type))].sort((a, b) => a.localeCompare(b)),
    [assignments],
  );

  // Filtros secundarios activos: alimenta el contador del botón "Filtros".
  const secondaryFilters = [fRole, fSub, fType, fClass, fExternal, fScope, fDecision].filter((v) => v !== "all").length;

  const filteredAssignments = useMemo(() => {
    const term = q.trim().toLowerCase();
    return assignments.filter((a) => {
      if (kpiFilter === "sin_mfa" || kpiFilter === "deshabilitadas" || kpiFilter === "inactivas") {
        if (a.principal_type !== "User") return false;
        if (kpiFilter === "sin_mfa" && !(a.user_type !== "Guest" && a.mfa_status === "disabled")) return false;
        if (kpiFilter === "deshabilitadas" && a.account_enabled !== false) return false;
        if (kpiFilter === "inactivas") {
          const d = daysSince(a.last_sign_in);
          if (d === null || d <= dias) return false;
        }
      } else if (kpiFilter === "elevadas" && !a.is_elevated) return false;
      else if (kpiFilter === "owner" && a.role_class !== "owner") return false;
      else if (kpiFilter === "personalizados" && !a.is_custom_role) return false;

      if (term) {
        const hay = `${a.display_name ?? a.principal_object_id} ${a.login ?? ""} ${a.role_name} ${a.scope}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (fScope !== "all" && a.scope_level !== fScope) return false;
      if (fRole !== "all" && a.role_name !== fRole) return false;
      if (fSub !== "all" && a.subscription_id !== fSub) return false;
      if (fType !== "all" && a.principal_type !== fType) return false;
      if (fClass !== "all" && (a.role_class ?? "sin_clasificar") !== fClass) return false;
      if (fExternal !== "all") {
        const wanted = fExternal === "externa" ? true : fExternal === "interna" ? false : null;
        if (a.is_external !== wanted) return false;
      }
      if (fDecision !== "all") {
        if (fDecision === "pendiente" ? a.decision !== null : a.decision !== fDecision) return false;
      }
      if (onlyElevated && !a.is_elevated) return false;
      if (onlyAlerts && !assignmentAlert(a, dias) && !isOrphanAssignment(a)) return false;
      return true;
    });
  }, [assignments, q, fScope, fRole, fSub, fType, fClass, fExternal, fDecision, onlyAlerts, onlyElevated,
      dias, kpiFilter, isOrphanAssignment]);

  const filteredAccounts = useMemo(() => {
    const term = qAccount.trim().toLowerCase();
    return accounts.filter((a) => {
      if (findingFilter && !findingFilter.principals.has(a.principal_object_id)) return false;
      if (accountFilter === "externas" && a.is_external !== true) return false;
      if (accountFilter === "owners_externos" && !(a.is_external === true && a.owner > 0)) return false;
      if (term) {
        const hay = `${a.display_name ?? a.principal_object_id} ${a.login ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [accounts, accountFilter, qAccount, findingFilter]);

  // Mismo criterio que el KPI "guests_inactivos_con_permisos": inactivo sobre el umbral Y con roles RBAC.
  const filteredGuests = useMemo(() => {
    if (!guestsOnlyAlert) return guests;
    return guests.filter((g) => {
      const d = daysSince(g.last_sign_in);
      return d !== null && d > dias && !!g.roles_in_subs;
    });
  }, [guests, guestsOnlyAlert, dias]);

  // ---- Columnas (memoizadas, sin dependencias de estado externo) ----
  const accountColumns = useMemo(() => [
    colAccount.display({
      id: "expander",
      header: "",
      cell: (c) => (
        <button type="button" onClick={c.row.getToggleExpandedHandler()}
          aria-label={c.row.getIsExpanded() ? "Ocultar asignaciones" : "Ver asignaciones"}
          aria-expanded={c.row.getIsExpanded()}
          className="text-muted-foreground hover:text-foreground cursor-pointer">
          {c.row.getIsExpanded() ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      ),
    }),
    colAccount.accessor((a) => a.display_name || a.login || a.principal_object_id, {
      id: "cuenta", header: "Cuenta",
      cell: (c) => {
        const a = c.row.original;
        return (
          <span className="inline-flex items-center gap-2 flex-wrap">
            {a.display_name
              ? <span className="font-medium">{a.display_name}</span>
              : <span className="font-mono text-xs">{a.login || a.principal_object_id}</span>}
            {a.orphan && (
              <span title="El principal ya no existe en Entra ID (en el portal aparece como 'Identity not found'). Acceso residual: conviene eliminar la asignación."
                className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                Eliminado de Entra ID
              </span>
            )}
          </span>
        );
      },
    }),
    colAccount.accessor((a) => a.login ?? "", { id: "login", header: "Correo/Login", cell: (c) => c.getValue() || "—" }),
    colAccount.accessor((a) => principalTypeLabel(a.principal_type), { id: "tipo", header: "Tipo" }),
    colAccount.accessor((a) => a.is_external === null ? 2 : a.is_external ? 1 : 0, {
      id: "externa", header: "Origen",
      cell: (c) => chip(externalChip(c.row.original.is_external), externalLabel(c.row.original.is_external)),
    }),
    colAccount.accessor("total_assignments", { header: "Accesos", cell: (c) => <span className="tabular-nums">{c.getValue()}</span> }),
    // Resumen de decisiones de la cuenta: el detalle por acceso está en Asignaciones.
    colAccount.accessor((a) => a.decision_pendientes, {
      id: "decision", header: "Decisión",
      cell: (c) => <span className="text-xs">{decisionSummary(c.row.original)}</span>,
    }),
    colAccount.accessor("owner", { header: "Owner", cell: (c) => <span className="tabular-nums">{c.getValue() || "—"}</span> }),
    colAccount.accessor("otorga_accesos", { header: "Otorga", cell: (c) => <span className="tabular-nums">{c.getValue() || "—"}</span> }),
    colAccount.accessor("escritura_total", { header: "Escritura total", cell: (c) => <span className="tabular-nums">{c.getValue() || "—"}</span> }),
    colAccount.accessor("subscriptions", { header: "Subs", cell: (c) => <span className="tabular-nums">{c.getValue()}</span> }),
    colAccount.accessor((a) => scopeLabel(a.broadest_scope_level), { id: "scope", header: "Scope más amplio" }),
    colAccount.accessor((a) => viaLabel(a.via), { id: "via", header: "Vía" }),
    colAccount.accessor((a) => a.last_sign_in ?? "", { id: "last_sign_in", header: "Último login", cell: (c) => dateOrDash(c.row.original.last_sign_in) }),
    colAccount.accessor((a) => a.mfa_status ?? "", { id: "mfa", header: "MFA", cell: (c) => mfaCell(c.row.original.mfa_status) }),
  ], []);

  const assignColumns = useMemo(() => [
    // Selección múltiple para decidir por lote (6013 accesos en el cliente más grande: marcar de a
    // uno no escala). Solo con permiso de edición: sin él no hay nada que hacer con la selección.
    ...(editable ? [colAssign.display({
      id: "select",
      header: ({ table }) => (
        <input type="checkbox" className="accent-primary h-4 w-4 align-middle cursor-pointer"
          aria-label="Seleccionar las asignaciones de esta página"
          checked={table.getIsAllPageRowsSelected()}
          onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)} />
      ),
      cell: (c) => (
        <input type="checkbox" className="accent-primary h-4 w-4 align-middle cursor-pointer"
          aria-label={`Seleccionar la asignación de ${c.row.original.display_name || c.row.original.principal_object_id} (${c.row.original.role_name})`}
          checked={c.row.getIsSelected()} onChange={c.row.getToggleSelectedHandler()} />
      ),
    })] : []),
    // Decisión vigente: vive por cliente, así que sobrevive a la re-sincronización. El title agrega
    // responsable, fecha, nota y el arrastre de un "revocar" que sigue vivo desde corridas anteriores.
    colAssign.accessor((a) => a.decision ?? "", {
      id: "decision", header: "Decisión",
      cell: (c) => (
        <span title={decisionTitle(c.row.original)}
          className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${decisionChip(c.row.original.decision)}`}>
          {decisionLabel(c.row.original.decision)}
        </span>
      ),
    }),
    colAssign.accessor((a) => a.subscription_name || a.subscription_id, { id: "subscription", header: "Suscripción" }),
    colAssign.accessor("role_name", { header: "Rol" }),
    colAssign.accessor((a) => a.role_class ?? "", {
      id: "role_class", header: "Clase de rol",
      cell: (c) => (
        <span className="inline-flex items-center gap-1 flex-wrap">
          {chip(roleClassChip(c.row.original.role_class), roleClassLabel(c.row.original.role_class))}
          {c.row.original.is_custom_role && chip("bg-muted text-muted-foreground", "Personalizado")}
        </span>
      ),
    }),
    colAssign.accessor((a) => scopeLabel(a.scope_level), { id: "scope_level", header: "Nivel de scope" }),
    colAssign.accessor((a) => principalTypeLabel(a.principal_type), { id: "principal_type", header: "Tipo" }),
    colAssign.accessor((a) => a.is_external === null ? 2 : a.is_external ? 1 : 0, {
      id: "externa", header: "Origen",
      cell: (c) => chip(externalChip(c.row.original.is_external), externalLabel(c.row.original.is_external)),
    }),
    colAssign.accessor((a) => a.display_name || a.principal_object_id, {
      id: "display_name", header: "Nombre",
      cell: (c) => nameCell(c.row.original.display_name, c.row.original.principal_object_id, isOrphanAssignment(c.row.original)),
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
  ], [isOrphanAssignment, editable]);

  const spColumns = useMemo(() => [
    colAssign.accessor((a) => a.subscription_name || a.subscription_id, { id: "subscription", header: "Suscripción" }),
    colAssign.accessor("role_name", { header: "Rol" }),
    colAssign.accessor((a) => scopeLabel(a.scope_level), { id: "scope_level", header: "Nivel de scope" }),
    colAssign.accessor((a) => a.display_name || a.principal_object_id, {
      id: "display_name", header: "Nombre",
      cell: (c) => nameCell(c.row.original.display_name, c.row.original.principal_object_id, isOrphanAssignment(c.row.original)),
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
  ], [isOrphanAssignment]);

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

  const [accountSorting, setAccountSorting] = useState<SortingState>([]);
  const [accountExpanded, setAccountExpanded] = useState<ExpandedState>({});
  const accountTable = useReactTable({
    data: filteredAccounts, columns: accountColumns,
    state: { sorting: accountSorting, expanded: accountExpanded },
    onSortingChange: setAccountSorting, onExpandedChange: setAccountExpanded,
    getRowId: (a) => a.principal_object_id,
    getRowCanExpand: () => true,
    enableColumnFilters: false,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  // Asignaciones de una cuenta, listadas al expandir su fila.
  const accountSubRow = useCallback((a: AccessAccount) => {
    const rows = assignments.filter((x) => x.principal_object_id === a.principal_object_id);
    if (rows.length === 0) return <span className="text-xs text-muted-foreground">Sin asignaciones.</span>;
    return (
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Asignaciones de esta cuenta
        </div>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left font-medium py-1 pr-4">Rol</th>
              <th className="text-left font-medium py-1 pr-4">Clase</th>
              <th className="text-left font-medium py-1 pr-4">Nivel de scope</th>
              <th className="text-left font-medium py-1 pr-4">Suscripción</th>
              <th className="text-left font-medium py-1">Vía grupo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={`${x.role_definition_id}-${x.scope}-${x.via_group_id ?? "d"}-${i}`} className="border-t border-border/50">
                <td className="py-1 pr-4">{x.role_name}</td>
                <td className="py-1 pr-4">{roleClassLabel(x.role_class)}</td>
                <td className="py-1 pr-4">{scopeLabel(x.scope_level)}</td>
                <td className="py-1 pr-4">{x.subscription_name || x.subscription_id}</td>
                <td className="py-1">{x.via_group_name || (x.via_group_id ? x.via_group_id : "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [assignments]);

  const [assignSorting, setAssignSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const assignTable = useReactTable({
    data: filteredAssignments, columns: assignColumns,
    state: { sorting: assignSorting, rowSelection },
    onSortingChange: setAssignSorting, onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    // El índice va en el id porque una misma cuenta puede tener el mismo rol en el mismo scope por
    // dos vías (directa y por grupo): sin él habría ids repetidos.
    getRowId: (a, i) => `${i}|${a.principal_object_id}|${a.role_definition_id}|${a.scope}`,
    enableColumnFilters: false,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  // Los ids de fila dependen del índice dentro del conjunto filtrado: si el filtro (o el snapshot)
  // cambia, una selección vieja apuntaría a otras filas. Se descarta.
  useEffect(() => { setRowSelection({}); }, [filteredAssignments]);

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;

  // ---- Decisión por acceso (bloque 3) ----
  const [savingDecision, setSavingDecision] = useState(false);
  const [justifyOpen, setJustifyOpen] = useState(false);
  const [justifyNote, setJustifyNote] = useState("");

  // Guarda la decisión del lote seleccionado. La clave (principal + rol + scope) la calcula el
  // backend: acá solo se manda el trío crudo de cada fila.
  async function applyDecision(decision: AccessDecisionValue, note?: string) {
    if (clientId == null) return;
    const rows = assignTable.getSelectedRowModel().rows.map((r) => r.original);
    if (rows.length === 0) return;
    setSavingDecision(true);
    try {
      const res = await saveAccessDecisions(clientId, rows.map((a) => ({
        principal_object_id: a.principal_object_id,
        role_definition_id: a.role_definition_id,
        scope: a.scope,
        decision,
        note: note ?? null,
      })));
      const n = res?.saved ?? rows.length;
      toast.success(n === 1 ? "1 decisión guardada." : `${n} decisiones guardadas.`);
      setRowSelection({});
      setJustifyOpen(false);
      setJustifyNote("");
      load(clientId, dias, { silent: true });
    } catch (e) {
      toast.error(`No se pudieron guardar las decisiones: ${msg(e)}`);
    } finally {
      if (mounted.current) setSavingDecision(false);
    }
  }

  // Aceptación de un hallazgo de umbral. Se relanza el error para que el diálogo del panel quede
  // abierto con la nota escrita.
  const acceptFinding = useCallback(async (f: AccessFinding, note: string) => {
    if (clientId == null) return;
    try {
      await acceptAccessFinding(clientId, f.key, note);
    } catch (e) {
      toast.error(`No se pudo aceptar el hallazgo: ${msg(e)}`);
      throw e;
    }
    toast.success(`Hallazgo aceptado: ${f.title}`);
    load(clientId, dias, { silent: true });
  }, [clientId, dias, load]);

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
    data: filteredGuests, columns: guestColumns,
    state: { sorting: guestSorting }, onSortingChange: setGuestSorting,
    enableColumnFilters: false,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const badCredentials = credentials.filter((c) => c.arm_status !== "ok" || c.graph_status !== "ok");

  return (
    <AppShell title="Revisión de accesos" subtitle="Accesos y permisos RBAC del tenant del cliente"
      active="access-review" onNavigate={onNavigate}
      headerRight={<ClientHeader clients={clients} clientId={clientId} onSelect={selectClient} disabled={loading} />}>
      <BusyOverlay show={loading} title="Cargando revisión de accesos" />
      {/* Mismo patrón que "Generando informe" (ReportPage): la sincronización y el export son
          operaciones largas → overlay de marca que bloquea la interacción hasta terminar. */}
      <BusyOverlay show={!loading && (syncing || isRunning)} title="Sincronizando accesos"
        detail="Puede tardar unos minutos según el tamaño del tenant; esta vista se actualiza sola." />
      <BusyOverlay show={exporting} title="Generando Excel" detail="Preparando revision-accesos.xlsx…" />
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
            {status !== "ok" && (
              <p
                className={`text-sm rounded-lg border px-3 py-2 ${
                  status === "error"
                    ? "text-red-700 dark:text-red-400 border-red-300 dark:border-red-800"
                    : "text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800"
                }`}
              >
                Esta corrida está incompleta: los indicadores de Entra ID (MFA, cuentas, administradores e invitados) no reflejan datos completos. Revisa el estado por credencial más abajo.
              </p>
            )}

            {/* Los contadores de privilegio solo dependen de ARM: siguen midiéndose aunque la fase
                Graph haya fallado (es la ganancia concreta en corridas Lighthouse / sin consent). */}
            <div className="flex flex-wrap gap-2">
              <Counter icon={<Users className="w-4 h-4" />} label="Cuentas" value={String(cuentasUnicas)} accent="#606161"
                hint="Clic para ver todas las cuentas" onClick={showAllAccounts} active={tab === "accounts" && !accountFilter} />
              <Counter icon={<Layers className="w-4 h-4" />} label="Asignaciones" value={String(totalAsign)} accent="#606161"
                hint="Clic para ver todas las asignaciones (limpia los filtros)" onClick={showAllAssignments} />
              <Counter icon={<ShieldAlert className="w-4 h-4" />} label="% elevadas" value={`${pctElevadas}%`}
                accent={pctElevadas >= 25 ? "#a53b35" : "#d9a82a"}
                hint="Owner, Otorga accesos y Escritura total sobre el total de asignaciones. Clic para filtrarlas."
                onClick={() => toggleKpiFilter("elevadas")} active={kpiFilter === "elevadas"} />
              <Counter icon={<KeyRound className="w-4 h-4" />} label="Owners" value={String(owners)}
                accent={owners > 0 ? "#a53b35" : "#70b043"}
                hint="Asignaciones con rol que otorga accesos y escritura total. Clic para filtrarlas."
                onClick={() => toggleKpiFilter("owner")} active={kpiFilter === "owner"} />
              <Counter icon={<Globe className="w-4 h-4" />} label="Externas"
                value={graphIncomplete ? "n/d" : String(externas)} accent={externas > 0 ? "#d9a82a" : "#70b043"} muted={graphIncomplete}
                hint={graphIncomplete ? "No medido: el origen interna/externa sale del UPN, que requiere leer el directorio." : "Cuentas invitadas o de otro tenant. Clic para filtrarlas."}
                onClick={() => toggleAccountFilter("externas")} active={accountFilter === "externas"} />
              <Counter icon={<ShieldOff className="w-4 h-4" />} label="Externas con Owner"
                value={graphIncomplete ? "n/d" : String(ownersExternos)} accent={ownersExternos > 0 ? "#a53b35" : "#70b043"} muted={graphIncomplete}
                hint={graphIncomplete ? "No medido: el origen interna/externa sale del UPN, que requiere leer el directorio." : "Clic para ver las cuentas externas con rol Owner"}
                onClick={() => toggleAccountFilter("owners_externos")} active={accountFilter === "owners_externos"} />
              <Counter icon={<Wrench className="w-4 h-4" />} label="Roles propios" value={String(rolesCustom)}
                accent={rolesCustom > 0 ? "#d9a82a" : "#606161"}
                hint="Definiciones de rol personalizadas en uso. Clic para filtrar sus asignaciones."
                onClick={() => toggleKpiFilter("personalizados")} active={kpiFilter === "personalizados"} />
              {/* Pendientes solo depende de ARM + decisiones: nunca va en "no medido". */}
              <Counter icon={<ClipboardCheck className="w-4 h-4" />} label="Pendientes" value={String(pendientes)}
                accent={pendientes > 0 ? "#d9a82a" : "#70b043"}
                hint="Accesos con alerta y sin decisión registrada. Clic para revisarlos en Asignaciones."
                onClick={togglePendientes} active={tab === "assignments" && fDecision === "pendiente"} />
              <Counter icon={<Crown className="w-4 h-4" />} label="Global Admins"
                value={graphIncomplete ? "n/d" : String(gaCount)} accent={gaAccent} muted={graphIncomplete}
                hint={graphIncomplete ? "No medido: esta corrida no tiene datos completos de Entra ID." : "Clic para ver la pestaña Global Admins"}
                onClick={() => setTab("admins")} active={tab === "admins"} />
              <Counter icon={<ShieldOff className="w-4 h-4" />} label="Sin MFA"
                value={graphIncomplete ? "n/d" : String(sinMfa)} accent={sinMfa > 0 ? "#a53b35" : "#70b043"} muted={graphIncomplete}
                hint={graphIncomplete ? "No medido: esta corrida no tiene datos completos de Entra ID." : "Clic para filtrar las asignaciones de internos sin MFA"}
                onClick={() => toggleKpiFilter("sin_mfa")} active={kpiFilter === "sin_mfa"} />
              <Counter icon={<UserX className="w-4 h-4" />} label="Deshabilitadas"
                value={graphIncomplete ? "n/d" : String(deshabilitadas)} accent={deshabilitadas > 0 ? "#a53b35" : "#70b043"} muted={graphIncomplete}
                hint={graphIncomplete ? "No medido: esta corrida no tiene datos completos de Entra ID." : "Clic para filtrar las asignaciones de cuentas deshabilitadas"}
                onClick={() => toggleKpiFilter("deshabilitadas")} active={kpiFilter === "deshabilitadas"} />
              <Counter icon={<Clock3 className="w-4 h-4" />} label="Inactivas"
                value={inactivityIncomplete ? "n/d" : String(inactivas)} accent={inactivas > 0 ? "#a53b35" : "#70b043"} muted={inactivityIncomplete}
                hint={inactivityIncomplete ? "No medido: requiere licencia Entra ID P1 para el último inicio de sesión." : "Clic para filtrar las asignaciones de cuentas inactivas"}
                onClick={() => toggleKpiFilter("inactivas")} active={kpiFilter === "inactivas"} />
              <Counter icon={<UserCog className="w-4 h-4" />} label="Guests inactivos c/permisos"
                value={graphIncomplete ? "n/d" : String(guestsAlert)} accent={guestsAlert > 0 ? "#a53b35" : "#70b043"} muted={graphIncomplete}
                hint={graphIncomplete ? "No medido: esta corrida no tiene datos completos de Entra ID." : "Clic para filtrar los guests inactivos con permisos"}
                onClick={toggleGuestsAlert} active={guestsOnlyAlert} />
            </div>

            <FindingsPanel findings={findings} onDrillDown={drillDownFinding}
              onAccept={editable ? acceptFinding : undefined} />

            {sinClasificar && (
              <p className="text-sm rounded-lg border border-border px-3 py-2 text-muted-foreground">
                Esta corrida es anterior a la clasificación de privilegio: las columnas de clase de rol
                aparecen como "sin clasificar". Volvé a sincronizar para calcularla.
              </p>
            )}

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

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="accounts">Cuentas</TabsTrigger>
                <TabsTrigger value="assignments">Asignaciones</TabsTrigger>
                <TabsTrigger value="admins">Global Admins</TabsTrigger>
                <TabsTrigger value="guests">Guests</TabsTrigger>
                <TabsTrigger value="sp">Service principals</TabsTrigger>
              </TabsList>

              <TabsContent value="accounts" className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SearchInput placeholder="Buscar cuenta o login…" value={qAccount} onChange={setQAccount}
                    className="w-[260px] max-w-full" inputClassName="h-9" aria-label="Buscar cuentas" />
                  {accountFilter && (
                    <button type="button" onClick={() => setAccountFilter(null)}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                      aria-label={`Quitar filtro ${ACCOUNT_FILTER_LABEL[accountFilter]}`}>
                      {ACCOUNT_FILTER_LABEL[accountFilter]}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {findingFilter && (
                    <button type="button" onClick={() => setFindingFilter(null)}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                      aria-label={`Quitar filtro del hallazgo ${findingFilter.title}`}>
                      Hallazgo: {findingFilter.title}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <div className="text-xs text-muted-foreground ml-auto">
                    {accounts.length ? `${filteredAccounts.length} de ${accounts.length} cuentas` : ""}
                  </div>
                </div>
                <DataTableBlock
                  table={accountTable}
                  emptyText={accounts.length ? "Sin cuentas que coincidan con los filtros." : "Este cliente no tiene cuentas con asignaciones RBAC."}
                  rowClassName={(a) => (a.orphan || a.account_enabled === false ? "bg-red-50 dark:bg-red-950/30" : "")}
                  subRow={accountSubRow}
                />
              </TabsContent>

              <TabsContent value="assignments" className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SearchInput placeholder="Buscar nombre, login, rol o scope…" value={q} onChange={setQ} className="w-[260px] max-w-full" inputClassName="h-9" aria-label="Buscar asignaciones" />
                  {/* Seis selects en línea desbordan la fila: los secundarios van en un popover con
                      contador, y en línea quedan solo los dos interruptores de uso frecuente. */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9">
                        <Filter className="w-4 h-4 mr-1" />Filtros
                        {secondaryFilters > 0 && (
                          <span className="ml-1.5 text-xs px-1.5 rounded-full bg-primary/15 text-primary tabular-nums">
                            {secondaryFilters}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[280px] space-y-2">
                      <Select value={fClass} onValueChange={setFClass}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Clase de rol: todas</SelectItem>
                          {ROLE_CLASSES.map((c) => <SelectItem key={c} value={c}>{roleClassLabel(c)}</SelectItem>)}
                          <SelectItem value="sin_clasificar">Sin clasificar</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={fRole} onValueChange={setFRole}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Rol: todos</SelectItem>
                          {roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={fSub} onValueChange={setFSub}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Suscripción: todas</SelectItem>
                          {subs.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={fType} onValueChange={setFType}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tipo: todos</SelectItem>
                          {principalTypes.map((t) => <SelectItem key={t} value={t}>{principalTypeLabel(t)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={fExternal} onValueChange={setFExternal}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Origen: todos</SelectItem>
                          <SelectItem value="interna">Interna</SelectItem>
                          <SelectItem value="externa">Externa</SelectItem>
                          <SelectItem value="nd">Sin medir</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={fScope} onValueChange={setFScope}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Nivel de scope: todos</SelectItem>
                          {scopeLevels.map((lvl) => <SelectItem key={lvl} value={lvl}>{scopeLabel(lvl)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={fDecision} onValueChange={(v) => setFDecision(v as DecisionFilter)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Decisión: todas</SelectItem>
                          <SelectItem value="pendiente">Pendientes</SelectItem>
                          <SelectItem value="mantener">Mantener</SelectItem>
                          <SelectItem value="revocar">Revocar</SelectItem>
                          <SelectItem value="justificado">Justificado</SelectItem>
                        </SelectContent>
                      </Select>
                      {secondaryFilters > 0 && (
                        <Button variant="ghost" size="sm" className="w-full h-8"
                          onClick={() => { setFClass("all"); setFRole("all"); setFSub("all"); setFType("all"); setFExternal("all"); setFScope("all"); setFDecision("all"); }}>
                          Limpiar filtros
                        </Button>
                      )}
                    </PopoverContent>
                  </Popover>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" checked={onlyElevated} onChange={(e) => setOnlyElevated(e.target.checked)} className="accent-primary h-4 w-4" />
                    Solo elevados
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" checked={onlyAlerts} onChange={(e) => setOnlyAlerts(e.target.checked)} className="accent-primary h-4 w-4" />
                    Solo con alertas
                  </label>
                  {kpiFilter && (
                    <button type="button" onClick={() => setKpiFilter(null)}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                      aria-label={`Quitar filtro ${KPI_FILTER_LABEL[kpiFilter]}`}>
                      {KPI_FILTER_LABEL[kpiFilter]}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {fDecision !== "all" && (
                    <button type="button" onClick={() => setFDecision("all")}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                      aria-label={`Quitar filtro de decisión ${DECISION_FILTER_LABEL[fDecision]}`}>
                      Decisión: {DECISION_FILTER_LABEL[fDecision]}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <div className="text-xs text-muted-foreground ml-auto">
                    {assignments.length ? `${filteredAssignments.length} de ${assignments.length} asignaciones` : ""}
                  </div>
                </div>
                {/* Barra de decisión por lote: aparece solo con filas seleccionadas. Marcar no revoca
                    nada en Azure (el módulo es de lectura): registra la decisión con responsable y fecha. */}
                {editable && selectedCount > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                    <span className="text-sm">
                      {selectedCount === 1 ? "1 asignación seleccionada" : `${selectedCount} asignaciones seleccionadas`}
                    </span>
                    <Button size="sm" variant="outline" className="h-8" disabled={savingDecision}
                      onClick={() => applyDecision("mantener")}>
                      Mantener
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" disabled={savingDecision}
                      onClick={() => applyDecision("revocar")}>
                      Revocar
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" disabled={savingDecision}
                      onClick={() => { setJustifyNote(""); setJustifyOpen(true); }}>
                      Justificar
                    </Button>
                    <button type="button" onClick={() => setRowSelection({})}
                      className="text-xs text-muted-foreground hover:text-foreground ml-auto">
                      Quitar selección
                    </button>
                  </div>
                )}
                <DataTableBlock
                  table={assignTable}
                  emptyText={assignments.length ? "Sin asignaciones que coincidan con los filtros." : "Este cliente no tiene asignaciones RBAC activas registradas."}
                  rowClassName={(a) => (assignmentAlert(a, dias) || isOrphanAssignment(a) ? "bg-red-50 dark:bg-red-950/30" : "")}
                />
              </TabsContent>

              <TabsContent value="admins">
                <DataTableBlock table={adminTable} emptyText="No se encontraron Global Administrators." />
              </TabsContent>

              <TabsContent value="guests" className="space-y-3">
                {guestsOnlyAlert && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setGuestsOnlyAlert(false)}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                      aria-label="Quitar filtro Guests inactivos con permisos">
                      Guests inactivos con permisos
                      <X className="w-3 h-3" />
                    </button>
                    <div className="text-xs text-muted-foreground ml-auto">
                      {guests.length ? `${filteredGuests.length} de ${guests.length} guests` : ""}
                    </div>
                  </div>
                )}
                <DataTableBlock table={guestTable}
                  emptyText={guestsOnlyAlert && guests.length ? "Sin guests inactivos con permisos sobre el umbral actual." : "No se encontraron cuentas guest."} />
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

      {/* Justificar exige nota: es la única decisión que baja el conteo de los hallazgos, así que
          queda con motivo, responsable y fecha. */}
      <Dialog open={justifyOpen} onOpenChange={setJustifyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Justificar los accesos seleccionados</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {selectedCount === 1
                ? "1 asignación quedará marcada como justificada."
                : `${selectedCount} asignaciones quedarán marcadas como justificadas.`}{" "}
              La nota es obligatoria: se guarda con tu usuario y la fecha, y estos accesos salen del
              conteo de los hallazgos.
            </p>
            <Textarea value={justifyNote} onChange={(e) => setJustifyNote(e.target.value)} rows={4}
              aria-label="Nota de justificación"
              placeholder="Motivo por el que estos accesos se mantienen…" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setJustifyOpen(false)}>Cancelar</Button>
              <Button disabled={!justifyNote.trim() || savingDecision}
                onClick={() => applyDecision("justificado", justifyNote.trim())}>
                Guardar justificación
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
