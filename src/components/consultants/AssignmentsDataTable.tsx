import { useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Check, Columns3, Copy, Eye, Pencil, Rows3, Rows4, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ConsultantAssignment, PersonRef } from "@/types";
import { CATEGORY_META, CATEGORY_RANK, normalizeCategory } from "@/lib/category";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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

const textFilter = textColumnFilter<ConsultantAssignment>;
// La categoría se filtra por su texto original (es lo que muestra el badge).
const categoryFilterFn = labelColumnFilter<ConsultantAssignment>((raw) => String(raw ?? ""));

const COL_LABELS: Record<string, string> = {
  client_name: "Cliente",
  service: "Servicio",
  category: "Categoría",
  country: "País",
  principals: "Principales",
  backups: "Backups",
  coordinator: "Coordinador",
};

function CategoryBadge({ category }: { category: string | null }) {
  const m = CATEGORY_META[normalizeCategory(category)];
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-md ${m.badge}`}>
      {category || m.label}
    </span>
  );
}

function PersonChips({ refs }: { refs: PersonRef[] }) {
  if (refs.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {refs.map((r) => (
        <Badge key={r.person_id} variant="outline" className="font-normal whitespace-nowrap">
          {r.name}
        </Badge>
      ))}
    </div>
  );
}

const joinNames = (refs: PersonRef[]) => refs.map((r) => r.name).join("; ");

export default function AssignmentsDataTable({
  assignments,
  isAdmin,
  onOpen,
  onEdit,
  onDelete,
}: {
  assignments: ConsultantAssignment[];
  isAdmin: boolean;
  onOpen: (a: ConsultantAssignment) => void;
  onEdit: (a: ConsultantAssignment) => void;
  onDelete: (a: ConsultantAssignment) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [dense, setDense] = useState(false);

  const columns: ColumnDef<ConsultantAssignment>[] = [
    {
      accessorKey: "client_name",
      header: "Cliente", filterFn: textFilter,
      cell: (c) => <span className="font-medium">{c.getValue<string>()}</span>,
    },
    { accessorKey: "service", header: "Servicio", filterFn: textFilter },
    {
      accessorKey: "category",
      header: "Categoría", filterFn: categoryFilterFn,
      cell: (c) => <CategoryBadge category={c.getValue<string | null>()} />,
      sortingFn: (a, b) =>
        CATEGORY_RANK[normalizeCategory(a.original.category)] - CATEGORY_RANK[normalizeCategory(b.original.category)],
    },
    { accessorKey: "country", header: "País", filterFn: textFilter },
    {
      id: "principals",
      accessorFn: (a) => joinNames(a.principals),
      header: "Principales", filterFn: textFilter,
      cell: ({ row }) => <PersonChips refs={row.original.principals} />,
    },
    {
      id: "backups",
      accessorFn: (a) => joinNames(a.backups),
      header: "Backups", filterFn: textFilter,
      cell: ({ row }) => <PersonChips refs={row.original.backups} />,
    },
    {
      id: "coordinator",
      accessorFn: (a) => a.coordinator?.name ?? "",
      header: "Coordinador", filterFn: textFilter,
      cell: ({ row }) => row.original.coordinator?.name ?? null,
    },
    {
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ver" onClick={() => onOpen(row.original)}>
            <Eye className="w-3.5 h-3.5" />
          </Button>
          {isAdmin && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Editar" onClick={() => onEdit(row.original)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Eliminar" onClick={() => onDelete(row.original)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: assignments,
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
  const [copied, setCopied] = useState(false);

  // Copia SOLO los correos de contacto de los clientes visibles (filtros aplicados,
  // todas las páginas), deduplicados y separados por "; ": pega directo en el campo
  // de destinatarios de Outlook/Teams. El campo en BD es multilínea (un correo por línea).
  async function copyContacts() {
    const rows = table.getPrePaginationRowModel().rows.map((r) => r.original);
    const seen = new Set<string>();
    const emails: string[] = [];
    for (const a of rows) {
      for (const raw of (a.client_contact_email ?? "").split("\n")) {
        const email = raw.trim();
        if (!email || seen.has(email.toLowerCase())) continue;
        seen.add(email.toLowerCase());
        emails.push(email);
      }
    }
    if (emails.length === 0) {
      toast.error("No hay correos para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(emails.join("; "));
      toast.success(`${emails.length} correo(s) copiados.`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar al portapapeles.");
    }
  }

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
            {table
              .getAllColumns()
              .filter((c) => c.getCanHide())
              .map((c) => (
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
        <Button variant="outline" size="sm" title="Copiar los correos de contacto de todos los clientes" onClick={copyContacts}>
          {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
          Copiar contactos
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader className="bg-secondary">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="whitespace-nowrap">
                    {h.isPlaceholder ? null : <DataTableColumnHeader column={h.column} title={String(h.column.columnDef.header)} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                  Sin asignaciones que coincidan.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const accent = CATEGORY_META[normalizeCategory(row.original.category)].accent;
                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => onOpen(row.original)}
                  >
                    {row.getVisibleCells().map((cell, i) => (
                      <TableCell
                        key={cell.id}
                        className={pad}
                        style={i === 0 ? { boxShadow: `inset 3px 0 0 ${accent}` } : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
