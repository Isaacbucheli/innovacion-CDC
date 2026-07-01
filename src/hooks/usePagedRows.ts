import { useMemo } from "react";
import { type ColumnDef, getCoreRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";

/**
 * Pagina un array plano de filas reusando @tanstack/react-table en modo
 * "headless" (sin columnas): solo para aprovechar <DataTablePagination/> en
 * listas/tablas simples que no necesitan ordenar ni filtrar por columna
 * (tarjetas, SimpleTable). Antes cada página duplicaba este bloque a mano.
 */
export function usePagedRows<T>(rows: T[], pageSize = 10) {
  const columns = useMemo<ColumnDef<T>[]>(() => [], []);
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });
  const pageRows = table.getRowModel().rows.map((r) => r.original);
  return { table, pageRows };
}
