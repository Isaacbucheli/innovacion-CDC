import type { Column } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import ColumnFilterPopover from "@/components/ColumnFilterPopover";

// Cabecera de columna reutilizable: título + orden (clic) + embudo de filtro avanzado.
export default function DataTableColumnHeader<T>({ column, title, align = "left" }: {
  column: Column<T, unknown>;
  title: string;
  align?: "left" | "right";
}) {
  const sorted = column.getIsSorted();
  const canSort = column.getCanSort();
  return (
    <span className={cn("inline-flex items-center gap-0.5", align === "right" && "w-full justify-end")}>
      <span
        onClick={canSort ? column.getToggleSortingHandler() : undefined}
        className={cn(canSort && "cursor-pointer select-none")}
      >
        {title}
        {sorted === "asc" ? " ↑" : sorted === "desc" ? " ↓" : ""}
      </span>
      {column.getCanFilter() && <ColumnFilterPopover column={column} label={title} />}
    </span>
  );
}
