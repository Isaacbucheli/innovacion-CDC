import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable, type RowSelectionState, type SortingState,
  type Table as RTTable,
} from "@tanstack/react-table";
import {
  Layers, MoreHorizontal, RefreshCw, Download, History, Loader2, X,
  ShieldAlert, KeyRound, Globe, Wrench, ChevronRight, Sparkles, AlignJustify,
  ChevronDown, Check, Ban, FileText,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import DeltaStrip from "@/components/access-review/DeltaStrip";
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
import {
  listClientsAdmin, getAccessReview, syncAccessReview, listAccessReviewRuns, downloadFromApi,
  saveAccessDecisions, acceptAccessFinding,
} from "@/lib/api";
import {
  mfaChip, scopeLabel, graphStatusLabel, assignmentAlert, daysSince, principalTypeLabel,
  roleClassLabel, roleClassChip, roleClassShortLabel, accountPrivilege, externalLabel, externalChip,
  viaLabel, livesInTenant, subscriptionLabel,
  decisionChip, decisionLabel, decisionProgress, decisionSummary, decisionTitle,
  environmentLabel, environmentChip,
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
/**
 * `muted` = no medido (el valor va en "n/d"). `partial` es distinto y más sutil: el valor SÍ se midió,
 * pero sobre un inventario que quedó corto porque alguna credencial no respondió, así que es un piso y
 * no el total. Se marca con "≥" para no presentar un mínimo como si fuera la cifra real.
 */
function Counter({ icon, label, value, accent, muted, partial, hint, onClick, active }: {
  icon: React.ReactNode; label: string; value: string; accent?: string; muted?: boolean;
  partial?: boolean; hint?: string;
  onClick?: () => void; active?: boolean;
}) {
  const inner = (
    <>
      <span className={muted ? "text-muted-foreground" : ""} style={muted ? undefined : { color: accent }}>
        {icon}
      </span>
      <span className={`text-lg font-bold tabular-nums leading-none ${muted ? "text-muted-foreground" : ""}`}>
        {partial && !muted && <span className="text-muted-foreground font-normal">≥</span>}
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
// alerta. `onRowClick` lo usa Cuentas: la fila entera abre el panel de detalle de la cuenta. `dense`
// es el control de densidad de la vista (cómoda / compacta): solo cambia el padding de las filas.
function DataTableBlock<T>({ table, emptyText, rowClassName, onRowClick, dense }: {
  table: RTTable<T>; emptyText: string; rowClassName?: (row: T) => string;
  onRowClick?: (row: T) => void; dense?: boolean;
}) {
  const cellPad = dense ? "py-1.5" : "py-3";
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
              <TableRow key={row.id}
                className={`${rowClassName?.(row.original) ?? ""} ${onRowClick ? "cursor-pointer" : ""}`}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={cellPad}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
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

/**
 * Mantiene la página de una tabla al recargar los datos, y la corrige si quedó fuera de rango.
 *
 * Recargar el snapshot (guardar una decisión, aceptar un hallazgo, mover el umbral) reemplaza el
 * arreglo de datos, y con el reseteo automático de TanStack eso devolvía la tabla a la página 1: una
 * revisión de cientos de filas se hace en tandas, y cada tanda expulsaba al principio. Las tablas que
 * lo usan declaran `autoResetPageIndex: false`.
 *
 * Si el conjunto se achica y la página deja de existir, va a la ÚLTIMA que existe, no a la primera:
 * es lo más cerca de donde se estaba, y evita la tabla vacía sin motivo aparente.
 */
function useStablePage(table: { getPageCount: () => number; setPageIndex: (i: number) => void;
  getState: () => { pagination: { pageIndex: number } } }) {
  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;
  useEffect(() => {
    if (pageCount > 0 && pageIndex > pageCount - 1) table.setPageIndex(pageCount - 1);
  }, [pageCount, pageIndex, table]);
}

/** Umbral de inactividad por defecto, en días. El usuario puede cambiarlo y ese cambio ACOMPAÑA al
 *  cambio de cliente (comparar dos clientes con el mismo criterio es legítimo), así que cuando no es
 *  este valor la vista lo dice: si no, el cliente nuevo se evalúa con un criterio invisible. */
const DIAS_DEFAULT = 90;

/** Asignación + la clave de fila estable que le pone la página (ver el memo `assignments`). */
type AssignmentRow = AccessAssignment & { row_key: string };

const colAssign = createColumnHelper<AssignmentRow>();
const colAccount = createColumnHelper<AccessAccount>();
const colAdmin = createColumnHelper<AccessGlobalAdmin>();
const colGuest = createColumnHelper<AccessGuest>();

const ROLE_CLASSES: Exclude<AccessRoleClass, null>[] =
  ["owner", "otorga_accesos", "escritura_total", "escritura_servicio", "lectura"];

// Los cuatro valores que puede devolver la clasificación de ambiente del backend (inferida del
// nombre de la suscripción). Fija, no derivada de la corrida: el filtro debe ofrecer "Producción"
// aunque este cliente no tenga ninguna suscripción clasificada así.
// "transversal" no es un ambiente al que el acceso pertenezca: es un acceso por encima de la
// suscripción que alcanza varios (lo resuelve el backend con TODO lo que alcanza, no con el
// nombre de una suscripción cualquiera).
const ENVIRONMENTS = ["produccion", "preproduccion", "desarrollo", "transversal", "desconocido"] as const;

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

/** Densidad de las tablas: preferencia de quien revisa, no del cliente. */
const DENSITY_KEY = "cdc:access-review:density";

/** Campo del panel de detalle: etiqueta micro arriba, valor abajo. */
function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

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
  const [dias, setDias] = useState(DIAS_DEFAULT);
  // Texto del input, separado del número: permite el estado intermedio vacío sin elegir un umbral
  // por el usuario ni disparar una recarga (ver el comentario junto al Input).
  const [diasText, setDiasText] = useState(String(DIAS_DEFAULT));

  const runId = useRef(0);
  // Cliente activo, para que una respuesta en vuelo no pinte datos de un cliente que ya no se está
  // mirando (ver el comentario de `load`).
  const clientIdRef = useRef<number | null>(null);
  const mounted = useRef(true);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstDias = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // Sincroniza el ref del cliente activo. Va declarado ANTES del efecto que dispara `load`, porque
  // los efectos corren en orden de declaración: si el ref quedara sin actualizar, `vigente()`
  // descartaría la respuesta de la carga inicial y la vista nunca mostraría datos.
  useEffect(() => { clientIdRef.current = clientId; }, [clientId]);

  const clearPoll = useCallback(() => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  }, []);

  const clearDebounce = useCallback(() => {
    if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null; }
  }, []);

  // Carga (o recarga silenciosa) del snapshot. Si el estado devuelto es queued/running arranca
  // el polling cada 5s (anti-race con runId, igual que ReservationsPage) hasta llegar a un estado final.
  //
  // El guard por runId NO alcanza: una recarga disparada después de guardar una decisión nace con el
  // runId más alto, así que gana la carrera contra la carga del cliente al que el usuario acaba de
  // cambiar y pinta el inventario del cliente anterior bajo la cabecera del nuevo. De ahí el segundo
  // guard por `cid`: si el cliente activo ya no es el de esta carga, la respuesta se descarta.
  const load = useCallback((cid: number, days: number, opts?: { silent?: boolean }) => {
    const myRun = ++runId.current;
    const vigente = () => mounted.current && myRun === runId.current && cid === clientIdRef.current;
    clearPoll();
    if (opts?.silent) setRefreshing(true); else setLoading(true);
    setMessage("");
    getAccessReview(cid, days)
      .then((data) => {
        if (!vigente()) return;
        setResp(data);
        if (data.status === "queued" || data.status === "running") {
          pollTimer.current = setInterval(() => {
            if (!vigente()) { clearPoll(); return; }
            getAccessReview(cid, days)
              .then((next) => {
                if (!vigente()) return;
                setResp(next);
                if (next.status !== "queued" && next.status !== "running") clearPoll();
              })
              .catch((e) => {
                if (vigente()) setMessage(`No se pudo actualizar el estado de la sincronización: ${msg(e)}`);
              });
          }, 5000);
        }
      })
      .catch((e) => {
        if (vigente()) {
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
    writeActiveClient(id);
    // El ref se actualiza de forma sincrónica: una respuesta en vuelo del cliente anterior tiene que
    // descartarse aunque llegue antes de que React procese el cambio de estado.
    clientIdRef.current = id;
    setClientId(id);
    // Se limpia TODO lo que filtra. Dejar filtros vivos entre clientes mostraba una tabla recortada
    // por un criterio del cliente anterior, y en el caso de la suscripción (un GUID que no existe en
    // el otro tenant) la dejaba en cero filas sin que nada lo explicara.
    setGuestsOnlyAlert(false); setAccountFilter(null); setFindingFilter(null); setQAccount("");
    clearAssignFilters();
    // Y la selección: con claves estables sobrevive a todo lo demás, pero pertenece a los accesos de
    // ESTE cliente. Lo mismo el detalle de cuenta abierto y la página de la tabla.
    setRowSelection({}); setDetailAccountId(null);
    assignTable.setPageIndex(0);
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

  const rawAssignments = useMemo(() => resp?.assignments ?? [], [resp]);
  /**
   * Cada asignación con una clave de fila ESTABLE: no depende del orden ni de qué filtro esté puesto,
   * así que sobrevive a recargar el snapshot y a cambiar de filtro.
   *
   * Antes la clave llevaba el índice dentro del conjunto filtrado, y eso obligaba a descartar la
   * selección en cada recarga: con el índice adentro, la fila 3 de un conjunto es otra fila distinta
   * en el siguiente, y conservar la selección habría significado guardar decisiones sobre accesos que
   * nadie marcó. El índice estaba ahí por un caso real: la misma cuenta puede tener el mismo rol en el
   * mismo scope por dos vías (directa y heredada de un grupo). Eso se resuelve con la vía en la clave,
   * que además es información y no posición.
   *
   * El contador final cubre el empate residual (dos filas idénticas en todo, incluida la vía) y se
   * calcula sobre la lista COMPLETA, no sobre la filtrada: por eso filtrar no renumera nada. Dos filas
   * así son intercambiables —mismo principal, rol y scope— y producen la misma decisión, con lo que
   * cuál de las dos se lleve el sufijo 1 es indiferente.
   */
  const assignments = useMemo(() => {
    const vistos = new Map<string, number>();
    return rawAssignments.map((a) => {
      const base = `${a.principal_object_id}|${a.role_definition_id}|${a.scope}|${a.via_group_id ?? "directo"}`;
      const n = vistos.get(base) ?? 0;
      vistos.set(base, n + 1);
      return { ...a, row_key: n === 0 ? base : `${base}#${n}` };
    });
  }, [rawAssignments]);
  const accounts = useMemo(() => resp?.accounts ?? [], [resp]);
  const findings = useMemo(() => resp?.findings ?? [], [resp]);
  const globalAdmins = useMemo(() => resp?.global_admins ?? [], [resp]);
  const guests = useMemo(() => resp?.guests ?? [], [resp]);
  const servicePrincipals = useMemo(() => assignments.filter((a) => a.principal_type === "ServicePrincipal"), [assignments]);
  const credentials = useMemo(() => resp?.credentials ?? [], [resp]);
  // Delta contra la corrida anterior: lo calcula el backend. Sin corrida previa (has_previous false)
  // no hay novedad que mostrar, y eso NO es "no cambió nada".
  const delta = resp?.delta;
  // El eje de accesos del delta es comparable solo si el inventario ARM se leyó completo en LAS DOS
  // corridas. Si no, "nuevos" no es 0 ni un número: es n/d. Comparar contra un inventario parcial
  // reportaba altas que nadie hizo (y el filtro "solo nuevos" mostraría un recorte arbitrario).
  // El `??` cubre corridas servidas por una API anterior a este campo.
  const deltaAccesosOk = (delta?.accesos_comparables ?? delta?.nuevos_accesos !== null) === true;

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
  // Inventario ARM incompleto: alguna credencial no pudo listar sus asignaciones, o la corrida murió.
  // No es lo mismo que el Graph incompleto: acá no queda un indicador "sin medir", queda la TABLA
  // corta. Todo lo que se cuenta sobre asignaciones (total, % elevadas, owners, roles propios) es un
  // piso, y presentarlo como el total hace concluir "este cliente tiene poco acceso repartido".
  const armIncomplete = useMemo(
    () => status === "error" || credentials.some((c) => c.arm_status !== "ok"),
    [status, credentials],
  );
  // Falta de licencia P1/P2: el directorio se leyó completo, solo no hay último inicio de sesión. Es
  // una limitación del tenant del cliente, no una falla, y merece su propio aviso: el banner anterior
  // la reportaba como "los indicadores de Entra ID no reflejan datos completos", que es falso.
  const sinLicenciaP1 = useMemo(
    () => credentials.some((c) => c.graph_status === "sin_licencia_p1"),
    [credentials],
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
  const totalAsign = resp?.kpis?.total_asignaciones ?? 0;
  // Las usa el titular ejecutivo del panel de hallazgos (no los contadores).
  const cuentasUnicas = resp?.kpis?.cuentas_unicas ?? 0;
  const pendientes = resp?.kpis?.pendientes_de_revisar ?? 0;
  const pctElevadas = resp?.kpis?.pct_elevadas ?? 0;
  const owners = resp?.kpis?.owners ?? 0;
  const externas = resp?.kpis?.cuentas_externas ?? 0;
  const rolesCustom = resp?.kpis?.roles_personalizados ?? 0;

  // ---- Filtros de negocio sobre Asignaciones (point 7) ----
  const [q, setQ] = useState("");
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [onlyElevated, setOnlyElevated] = useState(false);
  const [fClass, setFClass] = useState("all");
  const [fDecision, setFDecision] = useState<DecisionFilter>("all");
  const [fEnv, setFEnv] = useState("all");
  // "Solo nuevos" va en línea (no en el popover): en una revisión mensual es el primer filtro que se
  // usa, porque lo que cambió es lo único que todavía nadie miró.
  const [onlyNew, setOnlyNew] = useState(false);

  // ---- Drill-down desde los contadores ----
  const [tab, setTab] = useState("accounts");
  const [kpiFilter, setKpiFilter] = useState<KpiAssignFilter | null>(null);
  const [guestsOnlyAlert, setGuestsOnlyAlert] = useState(false);
  const [accountFilter, setAccountFilter] = useState<KpiAccountFilter | null>(null);
  const [qAccount, setQAccount] = useState("");
  // Drill-down de un hallazgo: se guarda la lista de principals en un Set para no recorrer un array
  // de cientos de ids por cada fila de la tabla.
  // Solo la CLAVE del hallazgo: las cuentas se releen del snapshot vigente. Guardar el Set
  // materializado dejaba la tabla mostrando las cuentas de un hallazgo que ya cambió (subir el umbral
  // de inactividad reescribe el hallazgo, y la tabla seguía listando las que ya no califican) o de
  // uno que desapareció al justificarse.
  const [findingFilter, setFindingFilter] = useState<{ key: string } | null>(null);

  // Clic en contador: lleva a la pestaña correspondiente y aplica su filtro
  // (clic de nuevo sobre el contador activo lo quita).
  function toggleKpiFilter(f: KpiAssignFilter) {
    setTab("assignments");
    setKpiFilter((prev) => (prev === f ? null : f));
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
    setKpiFilter(null); setQ(""); setOnlyAlerts(false); setOnlyElevated(false);
    setFClass("all"); setFDecision("all"); setFEnv("all"); setOnlyNew(false);
  }
  // Contador "Nuevos" (y la franja de cambios): lleva a Asignaciones con "solo nuevos". Limpia el
  // filtro de otros contadores para no cruzar dos criterios y dejar una tabla vacía sin explicación.
  // Desde otra pestaña el clic SIEMPRE muestra lo nuevo: con `active` mirando la pestaña, el
  // contador aparecía apagado aunque el filtro siguiera puesto, y el clic lo apagaba en vez de llevar
  // a la novedad — dos clics para lo que promete el hint.
  function toggleOnlyNew() {
    if (tab !== "assignments") { showNewAssignments(); return; }
    setKpiFilter(null);
    setOnlyNew((prev) => !prev);
  }
  function showNewAssignments() {
    setTab("assignments");
    setKpiFilter(null);
    setOnlyNew(true);
  }
  // "Abrir en la pestaña Cuentas" desde el modal de un hallazgo. Se limpia el filtro de contadores:
  // combinar dos criterios sin avisar daría una tabla vacía sin explicación.
  function drillDownFinding(f: AccessFinding) {
    setTab("accounts");
    setAccountFilter(null);
    setFindingFilter({ key: f.key });
  }

  // Filtros secundarios activos: alimenta el contador del botón "Filtros".
  // Filtros activos que NO se ven a simple vista: hoy los tres selects están en línea con su
  // etiqueta, así que el usuario siempre ve cuál está aplicado. Se conserva el conteo solo para el
  // botón de limpiar.
  const activeFilters = [fClass, fEnv, fDecision].filter((v) => v !== "all").length
    + (q.trim() ? 1 : 0) + (onlyElevated ? 1 : 0) + (onlyAlerts ? 1 : 0)
    + (onlyNew && deltaAccesosOk ? 1 : 0);   // no cuenta si no filtra (ver el predicado)

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
        // Incluye suscripción y tipo porque sus selects se quitaron: sin esto quedarían
        // inalcanzables. El scope ya trae el id de la suscripción; el nombre es lo que se busca.
        // El toLowerCase() va sobre la cadena COMPLETA: aplicado a un solo tramo del template dejaba
        // el nombre, el login y el rol comparándose con mayúsculas contra un término en minúsculas.
        const hay = (`${a.display_name ?? a.principal_object_id} ${a.login ?? ""} ${a.role_name} `
          + `${a.scope} ${a.subscription_name ?? ""} ${principalTypeLabel(a.principal_type)}`).toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (fClass !== "all" && (a.role_class ?? "sin_clasificar") !== fClass) return false;
      if (fDecision !== "all") {
        if (fDecision === "pendiente" ? a.decision !== null : a.decision !== fDecision) return false;
      }
      if (fEnv !== "all" && a.environment !== fEnv) return false;
      // `deltaAccesosOk` también acá: tras un re-sync que quedó parcial el filtro puede seguir
      // encendido de la corrida anterior, y entonces recortaría la tabla por un "nuevo" que ya no se
      // puede afirmar. Sin eje comparable el filtro simplemente no aplica.
      if (onlyNew && deltaAccesosOk && !a.is_new) return false;
      if (onlyElevated && !a.is_elevated) return false;
      if (onlyAlerts && !assignmentAlert(a, dias) && !isOrphanAssignment(a)) return false;
      return true;
    });
  }, [assignments, q, fClass, fDecision, fEnv, onlyNew, deltaAccesosOk,
      onlyAlerts, onlyElevated, dias, kpiFilter, isOrphanAssignment]);

  // El hallazgo del drill-down, releído del snapshot actual: si desapareció (por ejemplo porque se
  // justificaron todos sus accesos) el filtro se cae solo y no queda un chip describiendo algo que ya
  // no existe.
  const activeFinding = useMemo(
    () => (findingFilter ? findings.find((f) => f.key === findingFilter.key) ?? null : null),
    [findingFilter, findings],
  );
  const findingPrincipals = useMemo(
    () => (activeFinding ? new Set(activeFinding.affected_principals) : null),
    [activeFinding],
  );

  const filteredAccounts = useMemo(() => {
    const term = qAccount.trim().toLowerCase();
    return accounts.filter((a) => {
      if (findingPrincipals && !findingPrincipals.has(a.principal_object_id)) return false;
      if (accountFilter === "externas" && a.is_external !== true) return false;
      if (accountFilter === "owners_externos" && !(a.is_external === true && a.owner > 0)) return false;
      if (term) {
        const hay = `${a.display_name ?? a.principal_object_id} ${a.login ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [accounts, accountFilter, qAccount, findingPrincipals]);

  // Mismo criterio que el KPI "guests_inactivos_con_permisos": inactivo sobre el umbral Y con roles RBAC.
  const filteredGuests = useMemo(() => {
    if (!guestsOnlyAlert) return guests;
    return guests.filter((g) => {
      const d = daysSince(g.last_sign_in);
      return d !== null && d > dias && !!g.roles_in_subs;
    });
  }, [guests, guestsOnlyAlert, dias]);

  // Panel de detalle de una cuenta: lo que ya no cabe (ni conviene) en la tabla. Reemplaza a la
  // expansión en línea — dos formas de ver el mismo detalle competían entre sí, y la expansión no
  // podía crecer sin volver a apretar la tabla.
  // Se guarda el ID, no la cuenta: guardada como objeto, el panel seguía mostrando la foto del
  // momento en que se abrió. Al decidir un acceso desde el panel, sus contadores de decisión no se
  // movían aunque la tabla de atrás ya estuviera actualizada. Igual que el drill-down de hallazgos.
  const [detailAccountId, setDetailAccountId] = useState<string | null>(null);
  const detailAccount = useMemo(
    () => (detailAccountId ? accounts.find((a) => a.principal_object_id === detailAccountId) ?? null : null),
    [detailAccountId, accounts],
  );

  // Densidad de las tablas (cómoda / compacta). Es preferencia de la persona, no del cliente: se
  // guarda en localStorage y se aplica a las cinco pestañas.
  const [dense, setDense] = useState(() => localStorage.getItem(DENSITY_KEY) === "compacta");
  function toggleDensity() {
    setDense((prev) => {
      const next = !prev;
      localStorage.setItem(DENSITY_KEY, next ? "compacta" : "comoda");
      return next;
    });
  }

  // ---- Columnas (memoizadas, sin dependencias de estado externo) ----
  // Cuentas: seis columnas. Con trece, "Databricks Resource Provider" se partía en tres líneas y
  // "Scope más amplio" se cortaba a la derecha. Lo que salió (tipo, correo, subs, scope, vía, MFA y
  // el desglose numérico por clase de rol) está completo en el panel de detalle de la fila: nada se
  // perdió, solo dejó de competir por ancho.
  const accountColumns = useMemo(() => [
    colAccount.accessor((a) => a.display_name || a.login || a.principal_object_id, {
      id: "cuenta", header: "Cuenta",
      cell: (c) => {
        const a = c.row.original;
        const primary = a.display_name || a.login || a.principal_object_id;
        // Segunda línea: el correo cuando lo hay y, si no, la especie del principal (un grupo o un
        // service principal no tienen UPN, y saber qué es cambia cómo se lee la fila).
        const secondary = a.display_name && a.login ? a.login : principalTypeLabel(a.principal_type);
        return (
          <div className="min-w-0 max-w-[300px]">
            <div className="flex items-center gap-2 min-w-0">
              <span title={primary}
                className={`truncate whitespace-nowrap ${a.display_name ? "font-medium" : "font-mono text-xs"}`}>
                {primary}
              </span>
              {a.orphan && (
                <span title="El principal ya no existe en Entra ID (en el portal aparece como 'Identity not found'). Acceso residual: conviene eliminar la asignación."
                  className="shrink-0 text-xs px-2 py-0.5 rounded-full whitespace-nowrap bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                  Eliminado de Entra ID
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate whitespace-nowrap" title={secondary}>
              {secondary}
            </div>
          </div>
        );
      },
    }),
    colAccount.accessor((a) => a.is_external === null ? 2 : a.is_external ? 1 : 0, {
      id: "externa", header: "Origen",
      cell: (c) => chip(externalChip(c.row.original.is_external), externalLabel(c.row.original.is_external)),
    }),
    colAccount.accessor("total_assignments", { header: "Accesos", cell: (c) => <span className="tabular-nums">{c.getValue()}</span> }),
    // Techo de privilegio en un solo chip, en lugar de cuatro columnas numéricas que casi siempre
    // están en cero. El orden de gravedad y los conteos los da el backend (accountPrivilege solo
    // elige el mayor). Ordena por gravedad, no alfabéticamente.
    colAccount.accessor((a) => {
      const p = accountPrivilege(a);
      return p === "owner" ? 0 : p === "otorga_accesos" ? 1 : p === "escritura_total" ? 2
        : p === "escritura_servicio" ? 3 : p === "lectura" ? 4 : 5;
    }, {
      id: "privilegio", header: "Privilegio",
      cell: (c) => {
        const a = c.row.original;
        if (a.total_assignments === 0) return <span className="text-muted-foreground">—</span>;
        const p = accountPrivilege(a);
        return <span className="whitespace-nowrap">{chip(roleClassChip(p), roleClassShortLabel(p))}</span>;
      },
    }),
    // Avance de la revisión, no "N pendientes" en cada fila: con nada decidido, ese texto es idéntico
    // en toda la columna. El desglose por decisión queda en el panel (y en el título/lectores).
    colAccount.accessor((a) => a.decision_mantener + a.decision_revocar + a.decision_justificado, {
      id: "decision", header: "Decisión",
      cell: (c) => {
        const a = c.row.original;
        const progreso = decisionProgress(a);
        const resumen = decisionSummary(a);
        return (
          <span className="text-xs tabular-nums whitespace-nowrap" title={resumen}>
            <span className={progreso === "—" ? "text-muted-foreground" : ""}>{progreso}</span>
            <span className="sr-only"> {resumen}</span>
          </span>
        );
      },
    }),
    colAccount.accessor((a) => a.last_sign_in ?? "", {
      id: "last_sign_in", header: "Último login",
      cell: (c) => <span className="whitespace-nowrap">{dateOrDash(c.row.original.last_sign_in)}</span>,
    }),
    // Acceso por teclado al panel de detalle (la fila entera también abre, con el mouse). El nombre
    // accesible dice "Ver asignaciones" porque eso es lo que el panel lista abajo, además del resto de
    // los datos de la cuenta.
    colAccount.display({
      id: "detalle",
      header: "",
      cell: (c) => (
        <span className="flex justify-end">
          <button type="button" aria-label="Ver asignaciones" aria-haspopup="dialog"
            title="Ver el detalle de la cuenta"
            onClick={(e) => { e.stopPropagation(); setDetailAccountId(c.row.original.principal_object_id); }}
            className="text-muted-foreground hover:text-foreground cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </button>
        </span>
      ),
    }),
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
        // El chip "Nuevo" convive con el de decisión: un acceso nuevo casi siempre está pendiente, y
        // saber que apareció entre dos revisiones es justo lo que cambia cómo se lo revisa.
        <span className="inline-flex items-center gap-1 flex-wrap">
          <span title={decisionTitle(c.row.original)}
            className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${decisionChip(c.row.original.decision)}`}>
            {decisionLabel(c.row.original.decision)}
          </span>
          {c.row.original.is_new && (
            <span title="Este acceso no existía en la corrida anterior."
              className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Nuevo
            </span>
          )}
        </span>
      ),
    }),
    colAssign.accessor(subscriptionLabel, {
      id: "subscription", header: "Suscripción",
      cell: (c) => <span title={c.row.original.scope}>{subscriptionLabel(c.row.original)}</span>,
    }),
    // El ambiente lo infiere el backend del nombre de la suscripción (el front no clasifica nada).
    colAssign.accessor((a) => environmentLabel(a.environment), {
      id: "environment", header: "Ambiente",
      cell: (c) => (
        <span title={c.row.original.environment === "transversal"
          ? "El acceso está por encima de la suscripción y alcanza suscripciones de más de un ambiente."
          : "Inferido del nombre de la suscripción."}
          className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${environmentChip(c.row.original.environment)}`}>
          {environmentLabel(c.row.original.environment)}
        </span>
      ),
    }),
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
    colAssign.accessor(subscriptionLabel, {
      id: "subscription", header: "Suscripción",
      cell: (c) => <span title={c.row.original.scope}>{subscriptionLabel(c.row.original)}</span>,
    }),
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
  const accountTable = useReactTable({
    autoResetPageIndex: false,   // ver useStablePage
    data: filteredAccounts, columns: accountColumns,
    state: { sorting: accountSorting },
    onSortingChange: setAccountSorting,
    getRowId: (a) => a.principal_object_id,
    enableColumnFilters: false,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });
  useStablePage(accountTable);

  // Asignaciones de una cuenta, listadas en el panel de detalle.
  const accountAssignments = useCallback((a: AccessAccount) => {
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
    getRowId: (a) => a.row_key,
    enableColumnFilters: false,
    autoResetPageIndex: false,   // ver useStablePage
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  useStablePage(assignTable);

  // Del modelo de filas, no de las claves de `rowSelection`: una fila seleccionada que ya no está en
  // el conjunto vigente (la sacó un filtro, o desapareció del snapshot) no se puede decidir, así que
  // tampoco debe contarse. Es exactamente lo que `applyDecision` va a mandar.
  const selectedCount = assignTable.getSelectedRowModel().rows.length;

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
    autoResetPageIndex: false,   // ver useStablePage
    data: servicePrincipals, columns: spColumns,
    state: { sorting: spSorting }, onSortingChange: setSpSorting,
    enableColumnFilters: false,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });
  useStablePage(spTable);

  const [adminSorting, setAdminSorting] = useState<SortingState>([]);
  const adminTable = useReactTable({
    autoResetPageIndex: false,   // ver useStablePage
    data: globalAdmins, columns: adminColumns,
    state: { sorting: adminSorting }, onSortingChange: setAdminSorting,
    enableColumnFilters: false,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });
  useStablePage(adminTable);

  const [guestSorting, setGuestSorting] = useState<SortingState>([]);
  const guestTable = useReactTable({
    autoResetPageIndex: false,   // ver useStablePage
    data: filteredGuests, columns: guestColumns,
    state: { sorting: guestSorting }, onSortingChange: setGuestSorting,
    enableColumnFilters: false,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });
  useStablePage(guestTable);

  const badCredentials = credentials.filter((c) => c.arm_status !== "ok" || c.graph_status !== "ok");

  // Un aviso por cada cosa que efectivamente no se pudo medir, en orden de gravedad: primero lo que
  // deja la tabla corta, después lo que deja indicadores sin medir, y al final la limitación de
  // licencia (que no es una falla). Vacío = la corrida cubrió todo y no hay nada que advertir.
  const avisosCobertura = [
    armIncomplete
      ? "No se pudo listar las asignaciones de todas las credenciales: la tabla y los conteos de asignaciones son un piso, no el total del tenant."
      : null,
    graphIncomplete
      ? "No se pudo leer el directorio de Entra ID: MFA, cuentas habilitadas, origen interna/externa, administradores e invitados quedan sin medir."
      : null,
    sinLicenciaP1
      ? "El tenant del cliente no tiene licencia Entra ID P1/P2: sin último inicio de sesión, la inactividad de cuentas no es evaluable."
      : null,
  ].filter((a): a is string => a !== null);

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
            {/* El aviso se arma de lo que realmente faltó, no del `status` de la corrida. El texto
                único mentía en los dos sentidos: una corrida `partial` solo por falta de licencia P1
                leyó el directorio completo (nada de MFA ni administradores queda sin medir), y una
                corrida `ok` con una credencial sin consent no mostraba aviso alguno aunque media
                columna estuviera en n/d. Y el caso peor no se avisaba nunca: con una credencial que
                falló en ARM la tabla queda corta y los conteos se leían como el total. */}
            {avisosCobertura.length > 0 && (
              <div
                className={`text-sm rounded-lg border px-3 py-2 space-y-1 ${
                  status === "error" || armIncomplete
                    ? "text-red-700 dark:text-red-400 border-red-300 dark:border-red-800"
                    : "text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800"
                }`}
              >
                {avisosCobertura.map((a) => <p key={a}>{a}</p>)}
                {badCredentials.length > 0 && (
                  <p className="text-muted-foreground">Revisa el estado por credencial más abajo.</p>
                )}
              </div>
            )}

            {/* Los contadores de privilegio solo dependen de ARM: siguen midiéndose aunque la fase
                Graph haya fallado (es la ganancia concreta en corridas Lighthouse / sin consent).
                Si lo que falló es ARM van con "≥": el número es correcto sobre lo que se pudo leer,
                pero el total del tenant es mayor. */}
            <div className="flex flex-wrap gap-2">
              <Counter icon={<Layers className="w-4 h-4" />} label="Asignaciones" value={String(totalAsign)} accent="#606161"
                partial={armIncomplete}
                hint={armIncomplete
                  ? "Piso, no el total: alguna credencial no pudo listar sus asignaciones. Clic para ver las que sí se leyeron."
                  : "Clic para ver todas las asignaciones (limpia los filtros)"}
                onClick={showAllAssignments} />
              {/* "Nuevos" depende de ARM y de que exista corrida previa. Sin corrida anterior no se
                  muestra — un 0 ahí se leería como "no cambió nada". Con corrida anterior pero
                  inventario parcial en cualquiera de las dos, va en "n/d": el conteo saldría de
                  comparar contra una lista que quedó a medias. */}
              {delta?.has_previous && (
                <Counter icon={<Sparkles className="w-4 h-4" />} label="Nuevos"
                  value={deltaAccesosOk ? String(delta.nuevos_accesos) : "n/d"}
                  accent={deltaAccesosOk && (delta.nuevos_accesos ?? 0) > 0 ? "#d9a82a" : "#70b043"}
                  muted={!deltaAccesosOk}
                  hint={deltaAccesosOk
                    ? "Accesos que no existían en la corrida anterior. Clic para verlos en Asignaciones."
                    : "No medido: alguna de las dos corridas comparadas no leyó el inventario completo de asignaciones."}
                  onClick={deltaAccesosOk ? toggleOnlyNew : undefined} active={onlyNew} />
              )}
              {/* El porcentaje NO lleva "≥": sobre un inventario parcial puede salir para cualquier
                  lado (es un cociente entre dos números incompletos), así que se aclara en el hint. */}
              <Counter icon={<ShieldAlert className="w-4 h-4" />} label="% elevadas" value={`${pctElevadas}%`}
                accent={pctElevadas >= 25 ? "#a53b35" : "#d9a82a"}
                hint={armIncomplete
                  ? "Calculado solo sobre las asignaciones que se pudieron leer: con el inventario incompleto el porcentaje real puede ser mayor o menor. Clic para filtrarlas."
                  : "Owner, Otorga accesos y Escritura total sobre el total de asignaciones. Clic para filtrarlas."}
                onClick={() => toggleKpiFilter("elevadas")} active={kpiFilter === "elevadas"} />
              <Counter icon={<KeyRound className="w-4 h-4" />} label="Owners" value={String(owners)}
                accent={owners > 0 ? "#a53b35" : "#70b043"} partial={armIncomplete}
                hint={armIncomplete
                  ? "Piso, no el total: alguna credencial no pudo listar sus asignaciones. Clic para filtrar las que sí se leyeron."
                  : "Asignaciones con rol que otorga accesos y escritura total. Clic para filtrarlas."}
                onClick={() => toggleKpiFilter("owner")} active={kpiFilter === "owner"} />
              <Counter icon={<Globe className="w-4 h-4" />} label="Externas"
                value={graphIncomplete ? "n/d" : String(externas)} accent={externas > 0 ? "#d9a82a" : "#70b043"} muted={graphIncomplete}
                hint={graphIncomplete ? "No medido: el origen interna/externa sale del UPN, que requiere leer el directorio." : "Cuentas invitadas o de otro tenant. Clic para filtrarlas."}
                onClick={() => toggleAccountFilter("externas")} active={accountFilter === "externas"} />
              <Counter icon={<Wrench className="w-4 h-4" />} label="Roles propios" value={String(rolesCustom)}
                accent={rolesCustom > 0 ? "#d9a82a" : "#606161"} partial={armIncomplete}
                hint={armIncomplete
                  ? "Piso, no el total: solo los roles personalizados vistos en las credenciales que respondieron. Clic para filtrar sus asignaciones."
                  : "Definiciones de rol personalizadas en uso. Clic para filtrar sus asignaciones."}
                onClick={() => toggleKpiFilter("personalizados")} active={kpiFilter === "personalizados"} />
              {/* Pendientes solo depende de ARM + decisiones: nunca va en "no medido". */}
            </div>

            <DeltaStrip delta={delta} onShowNew={showNewAssignments} />

            <FindingsPanel findings={findings} accounts={accounts}
              pendientes={pendientes} cuentasUnicas={cuentasUnicas}
              onDrillDown={drillDownFinding}
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
                {/* El texto se edita libre y el número se confirma al salir del campo. Clampear en
                    cada tecla repone "90" al borrar (un valor que el usuario no eligió), y como React
                    reescribe el value el caret queda al final: teclear 365 producía 903 → 9036 → 3650. */}
                <Input type="number" min={1} max={3650} value={diasText}
                  onChange={(e) => {
                    setDiasText(e.target.value);
                    const n = Number(e.target.value);
                    if (e.target.value.trim() !== "" && Number.isFinite(n) && n >= 1 && n <= 3650) setDias(n);
                  }}
                  onBlur={() => {
                    const n = Number(diasText);
                    const val = diasText.trim() === "" || !Number.isFinite(n)
                      ? dias
                      : Math.min(3650, Math.max(1, Math.trunc(n)));
                    setDias(val);
                    setDiasText(String(val));
                  }}
                  className="h-8 w-20 text-foreground" aria-label="Umbral de inactividad en días" />
              </label>
              {/* El umbral sobrevive al cambio de cliente, y con él cambian los hallazgos de
                  inactividad y el conteo de cuentas inactivas. Sin este aviso, el cliente nuevo se
                  evaluaba con un criterio que nadie eligió para él y nada lo mostraba. */}
              {dias !== DIAS_DEFAULT && (
                <button type="button"
                  onClick={() => { setDias(DIAS_DEFAULT); setDiasText(String(DIAS_DEFAULT)); }}
                  title={`Volver al umbral por defecto de ${DIAS_DEFAULT} días`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900">
                  Umbral no estándar ({dias} días)
                  <X className="w-3 h-3" />
                </button>
              )}
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
                    {/* Densidad: en el menú, no como botón suelto en el encabezado. */}
                    <DropdownMenuItem onClick={toggleDensity}>
                      <AlignJustify className="w-4 h-4 mr-2" />
                      {dense ? "Filas cómodas" : "Filas compactas"}
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
                  {/* El título sale del hallazgo VIVO, no de una copia: así el chip nunca describe un
                      criterio que el snapshot actual ya cambió. Si el hallazgo desapareció, no hay chip
                      ni filtro. */}
                  {activeFinding && (
                    <button type="button" onClick={() => setFindingFilter(null)}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                      aria-label={`Quitar filtro del hallazgo ${activeFinding.title}`}>
                      Hallazgo: {activeFinding.title}
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
                  onRowClick={(a) => setDetailAccountId(a.principal_object_id)}
                  dense={dense}
                />
              </TabsContent>

              <TabsContent value="assignments" className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SearchInput placeholder="Buscar nombre, login, rol o scope…" value={q} onChange={setQ} className="w-[260px] max-w-full" inputClassName="h-9" aria-label="Buscar asignaciones" />
                  {/* Ocho selects apilados en un popover son un formulario volcado, no un panel de
                      filtros. Quedan los tres que una revisión usa de verdad, en línea y visibles.
                      Rol, Suscripción, Tipo, Origen y Nivel de scope se quitaron: la búsqueda ya cubre
                      rol, scope y suscripción, y esos filtros guardaban valores del cliente anterior
                      (un subscription_id no existe en otro tenant), dejando la tabla en cero filas con
                      el select en blanco. Menos filtros, y ninguno que pueda mentir. */}
                  <Select value={fClass} onValueChange={setFClass}>
                    <SelectTrigger className="h-9 w-[190px]" aria-label="Filtrar por clase de rol">
                      <SelectValue placeholder="Clase de rol: todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Clase de rol: todas</SelectItem>
                      {ROLE_CLASSES.map((c) => <SelectItem key={c} value={c}>{roleClassLabel(c)}</SelectItem>)}
                      <SelectItem value="sin_clasificar">Sin clasificar</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={fEnv} onValueChange={setFEnv}>
                    <SelectTrigger className="h-9 w-[170px]" aria-label="Filtrar por ambiente">
                      <SelectValue placeholder="Ambiente: todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Ambiente: todos</SelectItem>
                      {ENVIRONMENTS.map((e) => <SelectItem key={e} value={e}>{environmentLabel(e)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={fDecision} onValueChange={(v) => setFDecision(v as DecisionFilter)}>
                    <SelectTrigger className="h-9 w-[165px]" aria-label="Filtrar por decisión">
                      <SelectValue placeholder="Decisión: todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Decisión: todas</SelectItem>
                      <SelectItem value="pendiente">Pendientes</SelectItem>
                      <SelectItem value="mantener">Mantener</SelectItem>
                      <SelectItem value="revocar">Revocar</SelectItem>
                      <SelectItem value="justificado">Justificado</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* En línea, no en el popover: en una revisión mensual "qué cambió" es lo primero
                      que se filtra. Sin corrida anterior no se ofrece (nada sería nuevo), y con el
                      inventario parcial tampoco: el recorte no sería "lo nuevo" sino lo que la corrida
                      anterior no alcanzó a leer. */}
                  {delta?.has_previous && deltaAccesosOk && (
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                      <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} className="accent-primary h-4 w-4" />
                      Solo nuevos
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" checked={onlyElevated} onChange={(e) => setOnlyElevated(e.target.checked)} className="accent-primary h-4 w-4" />
                    Solo elevados
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" checked={onlyAlerts} onChange={(e) => setOnlyAlerts(e.target.checked)} className="accent-primary h-4 w-4" />
                    Solo con alertas
                  </label>
                  {activeFilters > 0 && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
                      onClick={clearAssignFilters}>
                      Limpiar {activeFilters === 1 ? "el filtro" : `los ${activeFilters} filtros`}
                    </Button>
                  )}
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
                  {/* La decisión por lote vive en esta misma fila, no en una barra propia: aparecer y
                      desaparecer un bloque empujaba la tabla hacia abajo justo cuando el usuario está
                      marcando filas. Y las tres acciones van en un menú, no como botones sueltos, que
                      es el patrón del resto de la app. Marcar no revoca nada en Azure (el módulo es de
                      lectura): registra la decisión con responsable y fecha. */}
                  <div className="ml-auto flex items-center gap-3">
                    {editable && selectedCount > 0 && (
                      <>
                        <span className="text-xs text-muted-foreground">
                          {selectedCount === 1 ? "1 seleccionada" : `${selectedCount} seleccionadas`}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-8" disabled={savingDecision}>
                              Decidir<ChevronDown className="w-4 h-4 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => applyDecision("mantener")}>
                              <Check className="w-4 h-4 mr-2" />Mantener
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => applyDecision("revocar")}>
                              <Ban className="w-4 h-4 mr-2" />Revocar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setJustifyNote(""); setJustifyOpen(true); }}>
                              <FileText className="w-4 h-4 mr-2" />Justificar…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <button type="button" onClick={() => setRowSelection({})}
                          className="text-xs text-muted-foreground hover:text-foreground">
                          Quitar selección
                        </button>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {assignments.length ? `${filteredAssignments.length} de ${assignments.length} asignaciones` : ""}
                    </span>
                  </div>
                </div>
                <DataTableBlock
                  table={assignTable}
                  emptyText={assignments.length ? "Sin asignaciones que coincidan con los filtros." : "Este cliente no tiene asignaciones RBAC activas registradas."}
                  rowClassName={(a) => (assignmentAlert(a, dias) || isOrphanAssignment(a) ? "bg-red-50 dark:bg-red-950/30" : "")}
                  dense={dense}
                />
              </TabsContent>

              <TabsContent value="admins">
                <DataTableBlock table={adminTable} dense={dense} emptyText="No se encontraron Global Administrators." />
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
                <DataTableBlock table={guestTable} dense={dense}
                  emptyText={guestsOnlyAlert && guests.length ? "Sin guests inactivos con permisos sobre el umbral actual." : "No se encontraron cuentas guest."} />
              </TabsContent>

              <TabsContent value="sp">
                <DataTableBlock table={spTable} dense={dense} emptyText="No se encontraron service principals con asignaciones RBAC." />
              </TabsContent>
            </Tabs>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground border-t pt-3">
              <span>{resp?.finished_at ? `Última sincronización: ${dateOrDash(resp.finished_at)}` : "Sin sincronizaciones registradas."}</span>
              <span>Solo asignaciones activas: los roles elegibles vía PIM y los Classic administrators no se incluyen.</span>
            </div>
          </>
        )}
      </div>

      {/* Panel de detalle de la cuenta: todo lo que salió de la tabla (tipo, correo, subs, scope, vía,
          MFA y el desglose por clase de rol), más sus asignaciones. Una sola forma de ver el detalle,
          en vez de una expansión en línea que apretaba la tabla y competía con este panel. */}
      <Dialog open={detailAccount !== null} onOpenChange={(o) => { if (!o) setDetailAccountId(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8 break-words">
              {detailAccount?.display_name || detailAccount?.login || detailAccount?.principal_object_id}
            </DialogTitle>
          </DialogHeader>
          {detailAccount && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                <DetailField label="Tipo">{principalTypeLabel(detailAccount.principal_type)}</DetailField>
                <DetailField label="Origen">
                  {chip(externalChip(detailAccount.is_external), externalLabel(detailAccount.is_external))}
                </DetailField>
                <DetailField label="Correo/Login">
                  <span className="break-all">{detailAccount.login || "—"}</span>
                </DetailField>
                <DetailField label="Habilitada">{enabledChip(detailAccount.account_enabled)}</DetailField>
                <DetailField label="MFA">{mfaCell(detailAccount.mfa_status)}</DetailField>
                <DetailField label="Último login">{dateOrDash(detailAccount.last_sign_in)}</DetailField>
                <DetailField label="Suscripciones">
                  <span className="tabular-nums">{detailAccount.subscriptions}</span>
                </DetailField>
                <DetailField label="Scope más amplio">{scopeLabel(detailAccount.broadest_scope_level)}</DetailField>
                <DetailField label="Vía">{viaLabel(detailAccount.via)}</DetailField>
              </div>

              {/* El desglose numérico que antes ocupaba cuatro columnas de la tabla. Un 0 se muestra
                  como "—": lo que importa es dónde sí hay privilegio. */}
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Accesos por clase de rol
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {([
                    ["owner", detailAccount.owner],
                    ["otorga_accesos", detailAccount.otorga_accesos],
                    ["escritura_total", detailAccount.escritura_total],
                    ["escritura_servicio", detailAccount.escritura_servicio],
                    ["lectura", detailAccount.lectura],
                    [null, detailAccount.sin_clasificar],
                  ] as [AccessRoleClass, number][]).map(([cls, n]) => (
                    <span key={cls ?? "sin_clasificar"} className="inline-flex items-center gap-1.5">
                      <span className="text-muted-foreground">{roleClassLabel(cls)}:</span>
                      <span className={`tabular-nums ${n > 0 ? "font-medium" : "text-muted-foreground"}`}>
                        {n > 0 ? n : "—"}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Decisiones de esta cuenta
                </div>
                <div className="mt-1 text-sm">{decisionSummary(detailAccount)}</div>
              </div>

              {accountAssignments(detailAccount)}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
