import { useEffect, useMemo, useState } from "react";
import {
  createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable, type SortingState, type ColumnFiltersState, type VisibilityState,
} from "@tanstack/react-table";
import { Columns3, Rows3, Rows4, Languages } from "lucide-react";
import { toast } from "sonner";
import { translateToEnglish } from "@/lib/wafTranslate";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SearchInput from "@/components/SearchInput";
import DataTablePagination from "@/components/DataTablePagination";
import DataTableColumnHeader from "@/components/DataTableColumnHeader";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { impactMeta, filterRecommendations } from "@/lib/waf";
import { sourceMeta } from "@/lib/wafSource";
import { textColumnFilter, labelColumnFilter, globalTextFilter } from "@/lib/columnFilter";
import type { WafRecommendation } from "@/types";

const col = createColumnHelper<WafRecommendation>();

// Formatea "yyyy-MM-dd" a "dd/MM/yyyy" sin construir Date (evita corrimiento por zona horaria).
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

const textFilter = textColumnFilter<WafRecommendation>;
// Impacto se filtra contra la etiqueta en español (Alta/Media/Baja), no contra "high/medium/low".
const impactFilter = labelColumnFilter<WafRecommendation>((raw) => impactMeta(raw as string | null).label);
// Origen se filtra contra la etiqueta mostrada (Excel/CSV/Advisor), no contra el valor crudo.
const sourceFilter = labelColumnFilter<WafRecommendation>((raw) => sourceMeta(raw as string | null)?.label ?? "—");
// Búsqueda global sobre código + ámbito.
const globalSearch = globalTextFilter<WafRecommendation>((r) => `${r.matrix_code} ${r.review_scope_es ?? ""}`);

export default function WafDataTable({ recommendations, pillarNames, minPct, maxPct, onOpen, english = false, onEnglishChange }: {
  recommendations: WafRecommendation[];
  pillarNames: Record<number, string>;
  minPct: number;
  maxPct: number;
  onOpen: (canonicalId: number) => void;
  english?: boolean;
  onEnglishChange?: (v: boolean) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ source: false });
  const [dense, setDense] = useState(false);
  const [globalFilter, setGlobalFilter] = useState("");
  const data = useMemo(() => filterRecommendations(recommendations, { minPct, maxPct }), [recommendations, minPct, maxPct]);

  const [scopeEn, setScopeEn] = useState<Map<string, string>>(new Map());
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (!english) return;
    const scopes = data.map((r) => r.review_scope_es ?? "").filter((s) => s.trim() !== "");
    if (scopes.length === 0) return;
    let cancelled = false;
    setTranslating(true);
    translateToEnglish(scopes)
      .then((map) => { if (!cancelled) setScopeEn(map); })
      .catch(() => {
        if (cancelled) return;
        onEnglishChange?.(false);
        toast.error("No se pudo traducir. Verifica que la IA esté configurada.");
      })
      .finally(() => { if (!cancelled) setTranslating(false); });
    return () => { cancelled = true; };
  }, [english, data, onEnglishChange]);

  const columns = useMemo(() => {
    // Pilar se filtra contra el NOMBRE del pilar (lo que ve el usuario), no el número.
    const pillarFilter = labelColumnFilter<WafRecommendation>((raw) => pillarNames[raw as number] ?? String(raw ?? ""));
    return [
    col.accessor("matrix_code", { header: "Código", filterFn: textFilter, cell: (c) => (
      <span className="relative inline-block pl-0.5">
        {c.row.original.is_new && (
          <svg aria-label="Recomendación nueva" role="img" viewBox="0 0 24 24" fill="none"
               className="absolute -left-2.5 -top-2 w-3.5 h-3.5 text-primary">
            <path d="M12 2.5c.4 3.5 1.6 4.7 5.1 5.1-3.5.4-4.7 1.6-5.1 5.1-.4-3.5-1.6-4.7-5.1-5.1C10.4 7.2 11.6 6 12 2.5Z" fill="currentColor"/>
            <path d="M18.5 13c.2 1.8.8 2.4 2.6 2.6-1.8.2-2.4.8-2.6 2.6-.2-1.8-.8-2.4-2.6-2.6C17.7 15.4 18.3 14.8 18.5 13Z" fill="currentColor"/>
          </svg>
        )}
        <span className="font-medium">{c.getValue()}</span>
      </span>
    ) }),
    col.accessor("pillar_number", { header: "Pilar", filterFn: pillarFilter, cell: (c) => pillarNames[c.getValue()] ?? c.getValue() }),
    col.accessor("review_scope_es", { header: "Ámbito", filterFn: textFilter, cell: (c) => {
      const es = c.getValue();
      const shown = english && es ? (scopeEn.get(es) ?? es) : es;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="truncate block max-w-[280px] cursor-default">{shown ?? "—"}</span>
          </TooltipTrigger>
          {shown && <TooltipContent className="whitespace-normal">{shown}</TooltipContent>}
        </Tooltip>
      );
    } }),
    col.accessor("business_impact", {
      header: "Impacto", filterFn: impactFilter,
      cell: (c) => { const m = impactMeta(c.getValue()); return <span className={`text-xs px-2.5 py-0.5 rounded-full ${m.chip}`}>{m.label}</span>; },
    }),
    col.accessor("source", {
      header: "Origen", filterFn: sourceFilter,
      cell: (c) => {
        const m = sourceMeta(c.getValue());
        if (!m) return <span className="text-muted-foreground">—</span>;
        const Icon = m.icon;
        return <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full ${m.chip}`}><Icon className="w-3.5 h-3.5" />{m.label}</span>;
      },
    }),
    col.accessor("resource_count", { header: "Recursos", filterFn: textFilter, sortingFn: "basic", cell: (c) => <span className="tabular-nums">{c.getValue()}</span> }),
    col.accessor("completion_pct", {
      header: "Avance", filterFn: textFilter, sortingFn: "basic",
      cell: (c) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-[70px] rounded-full bg-secondary overflow-hidden">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${c.getValue()}%` }} />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{c.getValue()}%</span>
        </div>
      ),
    }),
    col.accessor("remediation_end_date", {
      header: "Fecha de cierre", filterFn: textFilter, sortingFn: "basic",
      cell: (c) => <span className="tabular-nums text-xs text-muted-foreground">{fmtDate(c.getValue())}</span>,
    }),
    ];
  }, [pillarNames, english, scopeEn]);

  const table = useReactTable({
    data, columns,
    state: { sorting, columnFilters, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: globalSearch,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });
  const pad = dense ? "py-1.5" : "py-3";

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <SearchInput
          placeholder="Buscar ámbito o código…"
          value={globalFilter}
          onChange={setGlobalFilter}
          className="w-[260px] max-w-full"
          inputClassName="h-9"
          aria-label="Buscar recomendaciones"
        />
        <div className="flex gap-2 ml-auto">
          <Button variant={english ? "default" : "outline"} size="sm" aria-label="Alternar idioma inglés"
            onClick={() => onEnglishChange?.(!english)} disabled={translating}>
            <Languages className="w-4 h-4 mr-1" />
            {translating ? "Traduciendo…" : "Inglés"}
          </Button>
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
                    {h.isPlaceholder ? null : <DataTableColumnHeader column={h.column} title={String(h.column.columnDef.header)} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow><TableCell colSpan={table.getAllColumns().length} className="text-center text-muted-foreground py-8">Sin recomendaciones.</TableCell></TableRow>
            ) : table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} onClick={() => onOpen(row.original.canonical_id)} className="cursor-pointer">
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
    </TooltipProvider>
  );
}
