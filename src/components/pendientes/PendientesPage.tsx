import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Plus, RefreshCw, Users } from "lucide-react";
import AppShell from "@/components/AppShell";
import SearchInput from "@/components/SearchInput";
import ConfirmDelete from "@/components/ConfirmDelete";
import PendientesDataTable from "@/components/pendientes/PendientesDataTable";
import PendienteFormDialog from "@/components/pendientes/PendienteFormDialog";
import ClientesDialog from "@/components/pendientes/ClientesDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePendientes } from "@/hooks/usePendientes";
import { deletePendiente } from "@/lib/api";
import { canEditModule } from "@/lib/auth";
import {
  ESTADO_LABEL, STALE_DIAS, TIPO_LABEL, estaEstancado, responsablesDelTablero, tituloPrincipal,
  ultimaNota,
} from "@/lib/pendientes";
import type { PendienteItem } from "@/types";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Kpi({ label, value, hint, active, onClick }: {
  label: string; value: number; hint?: string; active?: boolean; onClick?: () => void;
}) {
  const base = "rounded-lg border bg-card p-4 text-left transition-colors";
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`${base} ${active ? "border-primary" : "hover:bg-secondary/50"}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm">{label}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </button>
  );
}

function csvCell(value: string | number | null | undefined) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Tablero de pendientes y bloqueantes por cliente. Una sola implementación para las dos áreas
 * (CDC e Infra & SSAA): `area` decide el módulo de permisos, el título y los datos.
 *
 * El dato sale de la BD del tablero de Seguimiento CDC, que la SWA original sigue usando, así que un
 * conflicto al editar (409) es un caso esperado y se resuelve recargando.
 */
export default function PendientesPage({ area, section, title, onNavigate }: {
  area: "CDC" | "INFRA";
  section: string;
  title: string;
  onNavigate?: (s: string) => void;
}) {
  const { clientes, pendientes, loading, error, reload } = usePendientes(area);
  const puedeEditar = canEditModule(section);

  const [q, setQ] = useState("");
  const [fTipo, setFTipo] = useState("all");
  const [fEstado, setFEstado] = useState("all");
  const [fCliente, setFCliente] = useState("all");
  const [ocultarCerrados, setOcultarCerrados] = useState(true);
  const [soloEstancados, setSoloEstancados] = useState(false);

  // undefined = diálogo cerrado, null = crear, objeto = ver/editar. Una sola pantalla para todo:
  // datos y bitácora del pendiente (pedido del usuario, 2026-08-21).
  const [editar, setEditar] = useState<PendienteItem | null | undefined>(undefined);
  const [aBorrar, setABorrar] = useState<PendienteItem | null>(null);
  const [clientesOpen, setClientesOpen] = useState(false);

  const kpis = useMemo(() => ({
    abiertos: pendientes.filter((p) => p.estado === "ABIERTO").length,
    enProgreso: pendientes.filter((p) => p.estado === "EN_PROGRESO").length,
    bloqueantes: pendientes.filter((p) => p.tipo === "BLOQUEANTE" && p.estado !== "CERRADO").length,
    estancados: pendientes.filter((p) => estaEstancado(p)).length,
  }), [pendientes]);

  // Distinto de los valores por defecto (ocultarCerrados nace en true): con esto se
  // decide si mostrar "Limpiar filtros", que restaura exactamente esos defaults.
  const hayFiltros = q.trim() !== "" || fTipo !== "all" || fEstado !== "all"
    || fCliente !== "all" || soloEstancados || !ocultarCerrados;

  const limpiarFiltros = () => {
    setQ(""); setFTipo("all"); setFEstado("all"); setFCliente("all");
    setSoloEstancados(false); setOcultarCerrados(true);
  };

  // Sale de todos los pendientes del área, no de `filtrados`: la lista del formulario no se achica
  // porque haya un filtro puesto en la tabla.
  const responsables = useMemo(() => responsablesDelTablero(pendientes, clientes), [pendientes, clientes]);

  const filtrados = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const nombre = (num: number) => clientes.find((c) => c.num === num)?.cliente ?? "";
    return pendientes.filter((p) => {
      if (ocultarCerrados && p.estado === "CERRADO") return false;
      if (fTipo !== "all" && p.tipo !== fTipo) return false;
      if (fEstado !== "all" && p.estado !== fEstado) return false;
      if (fCliente !== "all" && String(p.cliente_num) !== fCliente) return false;
      if (soloEstancados && !estaEstancado(p)) return false;
      if (!needle) return true;
      const heno = [
        nombre(p.cliente_num), p.descripcion, p.titulo, p.responsable,
        ...p.historial.map((n) => n.nota),
      ].join(" ").toLowerCase();
      return heno.includes(needle);
    });
  }, [pendientes, clientes, q, fTipo, fEstado, fCliente, ocultarCerrados, soloEstancados]);

  const handleDelete = useCallback(async () => {
    if (!aBorrar) return;
    try {
      await deletePendiente(area, aBorrar.id);
      toast.success("Pendiente eliminado.");
      setABorrar(null);
      reload();
    } catch (e) { toast.error(msg(e)); }
  }, [area, aBorrar, reload]);

  // Exporta lo que está en pantalla (con los filtros aplicados), no la tabla completa.
  const exportCsv = useCallback(() => {
    const encabezados = [
      "Cliente", "Tipo", "Pendiente", "Prioridad", "Responsable", "Estado", "Creado",
      "Ultima nota", "Fecha ultima nota", "Autor ultima nota",
    ];
    const filas = filtrados.map((p) => {
      const nota = ultimaNota(p);
      return [
        clientes.find((c) => c.num === p.cliente_num)?.cliente ?? `(${p.cliente_num})`,
        p.tipo, tituloPrincipal(p), p.prioridad, p.responsable, p.estado, p.fecha_creacion,
        nota?.nota, nota?.fecha, nota?.autor,
      ].map(csvCell).join(",");
    });
    // BOM para que Excel en Windows abra los acentos bien.
    const csv = `﻿${[encabezados.join(","), ...filas].join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pendientes-${area.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtrados, clientes, area]);

  return (
    <AppShell
      title={title}
      subtitle="Pendientes y bloqueantes por cliente, con su bitácora de novedades."
      active={section}
      onNavigate={onNavigate}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Kpi label="Abiertos" value={kpis.abiertos}
          active={fEstado === "ABIERTO"}
          onClick={() => { setFEstado((v) => (v === "ABIERTO" ? "all" : "ABIERTO")); setOcultarCerrados(true); }} />
        <Kpi label="En progreso" value={kpis.enProgreso}
          active={fEstado === "EN_PROGRESO"}
          onClick={() => { setFEstado((v) => (v === "EN_PROGRESO" ? "all" : "EN_PROGRESO")); setOcultarCerrados(true); }} />
        <Kpi label="Bloqueantes" value={kpis.bloqueantes} hint="sin cerrar"
          active={fTipo === "BLOQUEANTE"}
          onClick={() => { setFTipo((v) => (v === "BLOQUEANTE" ? "all" : "BLOQUEANTE")); setOcultarCerrados(true); }} />
        <Kpi label="Sin novedad" value={kpis.estancados} hint={`más de ${STALE_DIAS} días`}
          active={soloEstancados}
          onClick={() => setSoloEstancados((v) => !v)} />
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <SearchInput value={q} onChange={setQ} placeholder="Buscar cliente, texto o nota…"
          className="w-full sm:w-72" aria-label="Buscar pendientes" />

        <select className={selectClass} value={fTipo} onChange={(e) => setFTipo(e.target.value)}
          aria-label="Filtrar por tipo">
          <option value="all">Todos los tipos</option>
          {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <select className={selectClass} value={fEstado} onChange={(e) => setFEstado(e.target.value)}
          aria-label="Filtrar por estado">
          <option value="all">Todos los estados</option>
          {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <select className={selectClass} value={fCliente} onChange={(e) => setFCliente(e.target.value)}
          aria-label="Filtrar por cliente">
          <option value="all">Todos los clientes</option>
          {clientes.map((c) => <option key={c.num} value={String(c.num)}>{c.cliente}</option>)}
        </select>

        {/* Sin anidar el input en el label: anidado, el click se re-despacha y el checkbox
            termina en el mismo estado (activación de label del navegador). */}
        <div className="flex items-center gap-2 text-sm">
          <input id="pend-ocultar-cerrados" type="checkbox" checked={ocultarCerrados}
            onChange={(e) => setOcultarCerrados(e.target.checked)} />
          <Label htmlFor="pend-ocultar-cerrados" className="font-normal">Ocultar cerrados</Label>
        </div>

        {hayFiltros && (
          <Button variant="ghost" size="sm" className="h-9" onClick={limpiarFiltros}>Limpiar filtros</Button>
        )}

        <div className="ml-auto flex gap-2">
          {puedeEditar && (
            <Button size="sm" onClick={() => setEditar(null)} disabled={clientes.length === 0}>
              <Plus className="w-4 h-4 mr-1" /> Nuevo pendiente
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">Acciones</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={reload}>
                <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setClientesOpen(true)}>
                <Users className="w-4 h-4 mr-2" /> Clientes del tablero
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportCsv} disabled={filtrados.length === 0}>
                <Download className="w-4 h-4 mr-2" /> Exportar CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : error ? (
        <p className="text-destructive py-6">{error}</p>
      ) : pendientes.length === 0 ? (
        <p className="text-muted-foreground py-6">Todavía no hay pendientes registrados en esta área.</p>
      ) : (
        <PendientesDataTable
          pendientes={filtrados}
          clientes={clientes}
          canEdit={puedeEditar}
          onOpen={(p) => setEditar(p)}
          onEdit={(p) => setEditar(p)}
          onDelete={(p) => setABorrar(p)} />
      )}

      <PendienteFormDialog
        area={area}
        open={editar !== undefined}
        pendiente={editar ?? null}
        clientes={clientes}
        responsables={responsables}
        canEdit={puedeEditar}
        onOpenChange={(o) => !o && setEditar(undefined)}
        onSaved={reload} />

      <ClientesDialog
        area={area}
        open={clientesOpen}
        clientes={clientes}
        canEdit={puedeEditar}
        onOpenChange={setClientesOpen}
        onChanged={reload} />

      <ConfirmDelete
        open={!!aBorrar}
        label={aBorrar ? tituloPrincipal(aBorrar) : ""}
        onOpenChange={(o) => !o && setABorrar(null)}
        onConfirm={handleDelete} />
    </AppShell>
  );
}
