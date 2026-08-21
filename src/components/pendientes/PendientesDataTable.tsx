import { useState } from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AlertTriangle, Columns3, Pencil, Rows3, Rows4, Trash2 } from "lucide-react";
import type { PendienteCliente, PendienteItem } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DataTablePagination from "@/components/DataTablePagination";
import DataTableColumnHeader from "@/components/DataTableColumnHeader";
import { textColumnFilter, labelColumnFilter } from "@/lib/columnFilter";
import {
  diasSinNovedad,
  estaEstancado,
  estadoLabel,
  tipoLabel,
  tituloPrincipal,
  ultimaNota,
} from "@/lib/pendientes";

const textFilter = textColumnFilter<PendienteItem>;
const labelFilter = labelColumnFilter<PendienteItem>((raw) => String(raw ?? ""));

const COL_LABELS: Record<string, string> = {
  cliente: "Cliente",
  asunto: "Pendiente / bloqueante",
  tipo: "Tipo",
  prioridad: "Prioridad",
  responsable: "Responsable",
  estado: "Estado",
  fecha_creacion: "Creado",
  ultima: "Últ. nota",
};

const PRIORIDAD_RANK: Record<string, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
const ESTADO_RANK: Record<string, number> = { ABIERTO: 0, EN_PROGRESO: 1, CERRADO: 2 };

function Chip({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-md whitespace-nowrap ${tone}`}>
      {children}
    </span>
  );
}

const TIPO_TONE: Record<string, string> = {
  BLOQUEANTE: "bg-destructive/10 text-destructive",
  PENDIENTE: "bg-secondary text-secondary-foreground",
};

const PRIORIDAD_TONE: Record<string, string> = {
  ALTA: "bg-destructive/10 text-destructive",
  MEDIA: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  BAJA: "bg-secondary text-secondary-foreground",
};

const ESTADO_TONE: Record<string, string> = {
  ABIERTO: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  EN_PROGRESO: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  CERRADO: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

export default function PendientesDataTable({
  pendientes,
  clientes,
  canEdit,
  onOpen,
  onEdit,
  onDelete,
}: {
  pendientes: PendienteItem[];
  clientes: PendienteCliente[];
  canEdit: boolean;
  onOpen: (p: PendienteItem) => void;
  onEdit: (p: PendienteItem) => void;
  onDelete: (p: PendienteItem) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [dense, setDense] = useState(false);

  // Sin FK en la BD del tablero: un ClienteNum puede quedar sin fila en Cliente. La tabla lo dice
  // en vez de esconder el pendiente.
  const nombreCliente = (num: number) =>
    clientes.find((c) => c.num === num)?.cliente ?? `Cliente desconocido (${num})`;

  const columns: ColumnDef<PendienteItem>[] = [
    {
      id: "cliente",
      accessorFn: (p) => nombreCliente(p.cliente_num),
      header: "Cliente", filterFn: textFilter,
      cell: ({ row }) => {
        const cliente = clientes.find((c) => c.num === row.original.cliente_num);
        return (
          <div className="min-w-40">
            <span className="font-medium">{nombreCliente(row.original.cliente_num)}</span>
            {cliente?.consultor && (
              <div className="text-xs text-muted-foreground">{cliente.consultor}</div>
            )}
          </div>
        );
      },
    },
    {
      id: "asunto",
      accessorFn: (p) => `${p.descripcion ?? ""} ${p.titulo ?? ""}`,
      header: "Pendiente / bloqueante", filterFn: textFilter,
      cell: ({ row }) => (
        <div className="max-w-xl">
          <div className="whitespace-pre-wrap">{tituloPrincipal(row.original)}</div>
          {row.original.titulo?.trim() && row.original.descripcion?.trim() && (
            <div className="text-xs text-muted-foreground">{row.original.titulo}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "tipo",
      header: "Tipo", filterFn: labelFilter,
      cell: (c) => {
        const v = c.getValue<string | null>();
        const label = tipoLabel(v);
        return label ? <Chip tone={TIPO_TONE[v ?? ""] ?? "bg-secondary"}>{label}</Chip> : null;
      },
    },
    {
      accessorKey: "prioridad",
      header: "Prioridad", filterFn: labelFilter,
      cell: (c) => {
        const v = c.getValue<string | null>();
        return v ? <Chip tone={PRIORIDAD_TONE[v] ?? "bg-secondary"}>{v}</Chip> : null;
      },
      sortingFn: (a, b) =>
        (PRIORIDAD_RANK[a.original.prioridad ?? ""] ?? 9) - (PRIORIDAD_RANK[b.original.prioridad ?? ""] ?? 9),
    },
    {
      accessorKey: "responsable",
      header: "Responsable", filterFn: textFilter,
      cell: (c) => c.getValue<string | null>(),
    },
    {
      accessorKey: "estado",
      header: "Estado", filterFn: labelFilter,
      cell: (c) => {
        const v = c.getValue<string | null>();
        const label = estadoLabel(v);
        return label ? <Chip tone={ESTADO_TONE[v ?? ""] ?? "bg-secondary"}>{label}</Chip> : null;
      },
      sortingFn: (a, b) =>
        (ESTADO_RANK[a.original.estado ?? ""] ?? 9) - (ESTADO_RANK[b.original.estado ?? ""] ?? 9),
    },
    {
      accessorKey: "fecha_creacion",
      header: "Creado", filterFn: textFilter,
      cell: (c) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {c.getValue<string | null>() ?? ""}
        </span>
      ),
    },
    {
      id: "ultima",
      accessorFn: (p) => ultimaNota(p)?.nota ?? "",
      header: "Últ. nota", filterFn: textFilter,
      cell: ({ row }) => {
        const nota = ultimaNota(row.original);
        const dias = diasSinNovedad(row.original);
        const estancado = estaEstancado(row.original);
        return (
          <div className="max-w-sm">
            {nota ? (
              <>
                <div className="truncate">{nota.nota}</div>
                <div className="text-xs text-muted-foreground">
                  {nota.fecha ?? "sin fecha"}
                  {nota.autor ? ` · ${nota.autor}` : ""}
                </div>
              </>
            ) : (
              // En bloque, no en línea: como span, el aviso de abajo se le pegaba al lado
              // ("Sin notasSin novedad 28 días").
              <div className="text-muted-foreground">Sin notas</div>
            )}
            {estancado && (
              <div className="mt-1">
                {/* Como los demás avisos de la fila (tipo, prioridad, estado): chip, no texto rojo suelto. */}
                <Chip tone="bg-destructive/10 text-destructive">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Sin novedad {dias} días
                </Chip>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      header: "",
      cell: ({ row }) =>
        canEdit ? (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Editar"
              onClick={() => onEdit(row.original)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Eliminar"
              onClick={() => onDelete(row.original)}>
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        ) : null,
    },
  ];

  const table = useReactTable({
    data: pendientes,
    columns,
    state: { sorting, columnVisibility, columnFilters },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const pad = dense ? "py-1.5" : "py-3";

  return (
    <div>
      <div className="flex gap-2 items-center mb-3">
        <Button variant="outline" size="sm" onClick={() => setDense((d) => !d)}>
          {dense ? <Rows4 className="w-4 h-4 mr-1" /> : <Rows3 className="w-4 h-4 mr-1" />}
          {dense ? "Cómoda" : "Compacta"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 className="w-4 h-4 mr-1" />
              Columnas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
            {table.getAllColumns().filter((c) => c.getCanHide()).map((c) => (
              <DropdownMenuCheckboxItem
                key={c.id}
                checked={c.getIsVisible()}
                onCheckedChange={(v) => c.toggleVisibility(!!v)}
              >
                {COL_LABELS[c.id] ?? c.id}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader className="bg-secondary">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="whitespace-nowrap">
                    {h.isPlaceholder ? null : (
                      <DataTableColumnHeader column={h.column} title={String(h.column.columnDef.header)} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                  Sin pendientes que coincidan.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="cursor-pointer" onClick={() => onOpen(row.original)}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={pad}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
