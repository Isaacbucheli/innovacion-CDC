import { useState } from "react";
import { Filter } from "lucide-react";
import type { Column } from "@tanstack/react-table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FILTER_OPERATORS, emptyColumnFilter, isFilterActive,
  type ColumnFilterValue, type FilterOp, type Connector,
} from "@/lib/columnFilter";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function ColumnFilterPopover<T>({ column, label }: { column: Column<T, unknown>; label: string }) {
  const [open, setOpen] = useState(false);
  const current = column.getFilterValue() as ColumnFilterValue | undefined;
  const [draft, setDraft] = useState<ColumnFilterValue>(current ?? emptyColumnFilter());
  const active = isFilterActive(current);

  function openChange(next: boolean) {
    if (next) setDraft(current ?? emptyColumnFilter());
    setOpen(next);
  }
  function apply() {
    column.setFilterValue(isFilterActive(draft) ? draft : undefined);
    setOpen(false);
  }
  function clear() {
    column.setFilterValue(undefined);
    setDraft(emptyColumnFilter());
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Filtrar ${label}`}
          className={cn(
            "ml-1 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted",
            active ? "text-primary" : "text-muted-foreground/60",
          )}
        >
          <Filter className={cn("h-3.5 w-3.5", active && "fill-current")} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4 text-muted-foreground" />
          Filtro · {label}
        </div>
        <div className="space-y-2">
          <select
            className={selectClass}
            value={draft.a.op}
            onChange={(e) => setDraft({ ...draft, a: { ...draft.a, op: e.target.value as FilterOp } })}
            aria-label="Operador condición 1"
          >
            {FILTER_OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Input
            className="h-9"
            value={draft.a.val}
            onChange={(e) => setDraft({ ...draft, a: { ...draft.a, val: e.target.value } })}
            placeholder="Valor…"
            aria-label="Valor condición 1"
          />
          <select
            className={cn(selectClass, "w-20")}
            value={draft.conn}
            onChange={(e) => setDraft({ ...draft, conn: e.target.value as Connector })}
            aria-label="Conector"
          >
            <option value="and">Y</option>
            <option value="or">O</option>
          </select>
          <select
            className={selectClass}
            value={draft.b.op}
            onChange={(e) => setDraft({ ...draft, b: { ...draft.b, op: e.target.value as FilterOp } })}
            aria-label="Operador condición 2"
          >
            {FILTER_OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Input
            className="h-9"
            value={draft.b.val}
            onChange={(e) => setDraft({ ...draft, b: { ...draft.b, val: e.target.value } })}
            placeholder="Valor… (opcional)"
            aria-label="Valor condición 2"
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Button size="sm" className="h-8" onClick={apply}>Filtrar</Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={clear}>Limpiar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
