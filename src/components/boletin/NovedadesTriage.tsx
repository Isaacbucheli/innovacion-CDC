import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SearchInput from "@/components/SearchInput";
import DataTablePagination from "@/components/DataTablePagination";
import { usePagedRows } from "@/hooks/usePagedRows";
import { resourceTypeLabel } from "@/components/boletin/azureServiceIcons";
import {
  fmtDate, novedadDescripcion, novedadTitle, NOVEDAD_CATEGORIA_META,
  NOVEDAD_ESTADO_PILL_LABEL as ESTADO_PILL_LABEL,
  NOVEDAD_ESTADO_PILL_CLASS as ESTADO_PILL_CLASS,
  resolveNovedadIcon,
} from "@/components/boletin/boletinMeta";
import type { NovedadCliente } from "@/types";

const CATEGORIAS = Object.keys(NOVEDAD_CATEGORIA_META) as NovedadCliente["categoria_bit"][];

/** Colores de categoría (desaturados) de la maqueta, como clases con variante dark. */
const CATEGORIA_COLOR: Record<NovedadCliente["categoria_bit"], string> = {
  productividad_ia: "text-amber-700 dark:text-amber-400",
  seguridad_identidad: "text-purple-700 dark:text-purple-400",
  resiliencia_plataforma: "text-teal-700 dark:text-teal-400",
  costo_operacion: "text-emerald-700 dark:text-emerald-400",
};

type EstadoFiltro = "todos" | "ga" | "preview";

function publishedDate(n: NovedadCliente): string {
  return fmtDate(n.published_at.slice(0, 10));
}

function coincide(n: NovedadCliente, q: string): boolean {
  if (!q.trim()) return true;
  const needle = q.trim().toLowerCase();
  return [n.titulo, n.titulo_es, n.por_que].some((v) => (v ?? "").toLowerCase().includes(needle));
}

/** Tabla compacta de triage para las novedades pendientes de revisión: buscador + filtros de
 *  categoría/estado, selección en lote (solo rechazo) y fila expandible con el detalle + acciones.
 *  Componente de presentación puro: el estado de `drafts` y las recargas siguen en NovedadesTab. */
export default function NovedadesTriage({
  pendientes, english, drafts, onDraftChange, busyId, onDecidir, onBulkReject,
}: {
  pendientes: NovedadCliente[];
  english: boolean;
  drafts: Record<number, string>;
  onDraftChange: (id: number, value: string) => void;
  busyId: number | null;
  onDecidir: (n: NovedadCliente, estado: "aprobada" | "rechazada") => void;
  onBulkReject: (ids: number[]) => void | Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState<"todas" | NovedadCliente["categoria_bit"]>("todas");
  const [estado, setEstado] = useState<EstadoFiltro>("todos");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const filtradas = useMemo(() => pendientes.filter((n) => {
    if (categoria !== "todas" && n.categoria_bit !== categoria) return false;
    if (estado === "ga" && n.estado_feed !== "launched") return false;
    if (estado === "preview" && n.estado_feed !== "in_preview") return false;
    return coincide(n, search);
  }), [pendientes, categoria, estado, search]);

  const { table, pageRows } = usePagedRows(filtradas);

  function toggleExpand(id: number) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  function toggleSelect(id: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function toggleSelectPage(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const n of pageRows) { if (checked) next.add(n.id); else next.delete(n.id); }
      return next;
    });
  }

  async function handleBulkReject() {
    const ids = [...selected];
    setBulkBusy(true);
    try {
      await onBulkReject(ids);
      setSelected(new Set());
    } finally {
      setBulkBusy(false);
    }
  }

  const pageAllSelected = pageRows.length > 0 && pageRows.every((n) => selected.has(n.id));

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar novedad o servicio…"
          aria-label="Buscar novedad"
          className="min-w-[240px] flex-1"
        />
        <Select value={categoria} onValueChange={(v) => setCategoria(v as typeof categoria)}>
          <SelectTrigger className="h-9 w-[220px]" aria-label="Filtrar por categoría">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Categoría: Todas</SelectItem>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c} value={c}>{NOVEDAD_CATEGORIA_META[c].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={estado} onValueChange={(v) => setEstado(v as EstadoFiltro)}>
          <SelectTrigger className="h-9 w-[170px]" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Estado: Todos</SelectItem>
            <SelectItem value="ga">Estado: GA</SelectItem>
            <SelectItem value="preview">Estado: Preview</SelectItem>
          </SelectContent>
        </Select>
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm font-medium">
            <span className="tabular-nums">{selected.size} seleccionada{selected.size === 1 ? "" : "s"}</span>
            <Button variant="outline" size="sm" className="text-destructive" disabled={bulkBusy}
              onClick={() => void handleBulkReject()}>
              {bulkBusy ? "Rechazando…" : "Rechazar seleccionadas"}
            </Button>
            <Button variant="ghost" size="sm" disabled={bulkBusy} onClick={() => setSelected(new Set())}>
              Limpiar
            </Button>
          </div>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-9">
              <input type="checkbox" className="accent-primary h-3.5 w-3.5 align-middle cursor-pointer"
                aria-label="Seleccionar la página" checked={pageAllSelected}
                onChange={(e) => toggleSelectPage(e.target.checked)} />
            </TableHead>
            <TableHead>Novedad</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="w-9" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                Sin novedades pendientes que coincidan con el filtro.
              </TableCell>
            </TableRow>
          ) : pageRows.map((n) => {
            const titulo = novedadTitle(n, english);
            const icon = resolveNovedadIcon(n);
            const isOpen = expandedId === n.id;
            const busy = busyId === n.id;
            const pillLabel = ESTADO_PILL_LABEL[n.estado_feed];
            return (
              <Fragment key={n.id}>
                <TableRow className="cursor-pointer" onClick={() => toggleExpand(n.id)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="accent-primary h-3.5 w-3.5 align-middle cursor-pointer"
                      aria-label={`Seleccionar ${titulo}`} checked={selected.has(n.id)}
                      onChange={(e) => toggleSelect(n.id, e.target.checked)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        {"src" in icon
                          ? <img src={icon.src} alt="" className="h-4 w-4" />
                          : <icon.Icon className="h-4 w-4 text-muted-foreground" />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{titulo}</div>
                        {n.recursos && n.recursos.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {n.recursos.map((r, i) => (
                              <span key={i}
                                className="rounded-md border bg-muted px-2 py-0.5 text-[11.5px] font-medium text-muted-foreground">
                                {r.cantidad} {resourceTypeLabel(r.type)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`whitespace-nowrap text-[11.5px] font-semibold ${CATEGORIA_COLOR[n.categoria_bit]}`}>
                      {NOVEDAD_CATEGORIA_META[n.categoria_bit].label}
                    </span>
                  </TableCell>
                  <TableCell>
                    {pillLabel && (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO_PILL_CLASS[n.estado_feed]}`}>
                        {pillLabel}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {publishedDate(n)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={6} className="space-y-3 py-4">
                      <p className="max-w-3xl text-sm text-muted-foreground">{novedadDescripcion(n, english)}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <a href={n.link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                          Ver anuncio en Azure Updates <ExternalLink className="h-3 w-3" />
                        </a>
                        <span>Publicado {publishedDate(n)}</span>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground"
                          htmlFor={`por-que-${n.id}`}>
                          Por qué le sirve a este cliente (editable, es lo que se publica)
                        </label>
                        <Textarea
                          id={`por-que-${n.id}`}
                          aria-label={`Por qué le sirve a este cliente: ${titulo}`}
                          value={drafts[n.id] ?? ""}
                          onChange={(e) => onDraftChange(n.id, e.target.value)}
                          rows={3}
                          className="max-w-3xl"
                        />
                      </div>
                      <div className="flex max-w-3xl justify-end gap-2">
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => onDecidir(n, "rechazada")}>
                          Rechazar
                        </Button>
                        <Button size="sm" disabled={busy} onClick={() => onDecidir(n, "aprobada")}>
                          Aprobar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
      <div className="px-4 pb-4">
        <DataTablePagination table={table} />
      </div>
    </div>
  );
}
