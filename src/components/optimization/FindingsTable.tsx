import { useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DataTablePagination from "@/components/DataTablePagination";
import DataTableColumnHeader from "@/components/DataTableColumnHeader";
import { SEVERITY_META, severityKey } from "@/lib/severity";
import { formatMoney } from "@/lib/costs";
import { checkMeta } from "@/lib/optimization";
import type { OptFinding } from "@/types";
import { SevBadge, StateBadge, detailText } from "@/components/optimization/FindingBits";

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export default function FindingsTable({ findings, onOpen }: {
  findings: OptFinding[];
  onOpen: (f: OptFinding) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns: ColumnDef<OptFinding>[] = [
    {
      id: "recomendacion",
      accessorFn: (f) => checkMeta(f.check_id).title,
      header: "Recomendación",
      cell: (c) => <span className="font-medium">{c.getValue<string>()}</span>,
    },
    {
      accessorKey: "resource_name",
      header: "Recurso",
      cell: (c) => <span className="tabular-nums">{c.getValue<string | null>() || "—"}</span>,
    },
    { accessorKey: "region", header: "Región", cell: (c) => <span className="text-muted-foreground">{c.getValue<string | null>() || "—"}</span> },
    {
      id: "detalle",
      accessorFn: (f) => detailText(f),
      header: "Detalle",
      enableSorting: false,
      cell: (c) => <span className="text-muted-foreground">{c.getValue<string>() || "—"}</span>,
    },
    {
      accessorKey: "estimated_monthly_savings",
      header: "Ahorro/mes",
      cell: (c) => {
        const v = c.getValue<number | null>();
        return v != null && v > 0
          ? <span className="font-bold tabular-nums text-[#5a7016] dark:text-[#a9c46a]">{formatMoney(v)}</span>
          : <span className="text-muted-foreground">—</span>;
      },
      sortingFn: (a, b) => (a.original.estimated_monthly_savings ?? 0) - (b.original.estimated_monthly_savings ?? 0),
    },
    {
      accessorKey: "severity",
      header: "Sev.",
      cell: (c) => <SevBadge sev={c.getValue<string | null>()} />,
      sortingFn: (a, b) => SEVERITY_RANK[severityKey(a.original.severity)] - SEVERITY_RANK[severityKey(b.original.severity)],
    },
    {
      accessorKey: "state",
      header: "Estado",
      cell: (c) => <StateBadge state={c.row.original.state} />,
    },
  ];

  const table = useReactTable({
    data: findings,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div>
      <div className="overflow-x-auto">
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
            {table.getRowModel().rows.map((row) => {
              const accent = SEVERITY_META[severityKey(row.original.severity)].accent;
              return (
                <TableRow key={row.id} className="cursor-pointer" onClick={() => onOpen(row.original)}>
                  {row.getVisibleCells().map((cell, i) => (
                    <TableCell
                      key={cell.id}
                      className="py-2.5"
                      style={i === 0 ? { boxShadow: `inset 3px 0 0 ${accent}` } : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {findings.length > 10 && <DataTablePagination table={table} />}
    </div>
  );
}
