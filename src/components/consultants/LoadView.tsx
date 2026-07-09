import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import type { ConsultantAssignment, Person } from "@/types";
import { computeLoads, type ConsultantLoad } from "@/lib/consultantLoad";
import { CATEGORY_META, normalizeCategory } from "@/lib/category";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import DataTablePagination from "@/components/DataTablePagination";
import { usePagedRows } from "@/hooks/usePagedRows";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

function CategoryBadge({ category }: { category: string | null }) {
  const m = CATEGORY_META[normalizeCategory(category)];
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-md ${m.badge}`}>
      {category || m.label}
    </span>
  );
}

const roleChip = (role: "principal" | "backup") =>
  role === "principal"
    ? <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">Principal</span>
    : <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Backup</span>;

/** Ranking de carga por consultor (solo admin). Barra proporcional al máximo del ranking. */
export default function LoadView({ assignments, people, onReassign }: {
  assignments: ConsultantAssignment[];
  people: Person[];
  onReassign: () => void;
}) {
  const loads = useMemo(() => computeLoads(assignments, people), [assignments, people]);
  const maxLoad = loads.reduce((m, l) => Math.max(m, l.weighted_load), 0) || 1;
  const [detail, setDetail] = useState<ConsultantLoad | null>(null);
  const { table, pageRows } = usePagedRows(loads);

  const cols: SimpleCol<ConsultantLoad>[] = [
    { key: "name", label: "Consultor", render: (l) => <span className="font-medium">{l.name}</span> },
    { key: "principal_count", label: "Principal", align: "right" },
    { key: "backup_count", label: "Backup", align: "right" },
    {
      key: "weighted_load", label: "Carga ponderada",
      render: (l) => (
        <div className="flex items-center gap-2 min-w-[180px]">
          <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round((l.weighted_load / maxLoad) * 100)}%` }}
            />
          </div>
          <span className="tabular-nums text-sm w-8 text-right">{l.weighted_load}</span>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex gap-2 flex-wrap items-center mb-4">
        <p className="text-sm text-muted-foreground">
          Carga ponderada por categoría del cliente: ALTO=3 · MEDIO=2 · BAJO=1 (solo asignaciones activas donde es principal).
        </p>
        <Button size="sm" className="ml-auto" onClick={onReassign}>
          <ArrowLeftRight className="w-4 h-4 mr-1" />Reasignar…
        </Button>
      </div>

      <SimpleTable
        cols={cols}
        rows={pageRows}
        onRowClick={(l) => setDetail(l)}
        empty="Sin consultores activos en el directorio."
      />
      <DataTablePagination table={table} />

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{detail?.name}</SheetTitle></SheetHeader>
          {detail && (
            <div className="space-y-4 mt-4">
              <div className="flex gap-2 flex-wrap text-xs">
                <span className="px-2 py-0.5 rounded-full bg-secondary">{detail.principal_count} como principal</span>
                <span className="px-2 py-0.5 rounded-full bg-secondary">{detail.backup_count} como backup</span>
                <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary">Carga {detail.weighted_load}</span>
              </div>
              <div className="rounded-lg border divide-y">
                {detail.assignments.length === 0 && (
                  <p className="text-sm text-muted-foreground p-3">Sin asignaciones activas.</p>
                )}
                {detail.assignments.map((a, i) => (
                  <div key={`${a.assignment_id}-${a.role}-${i}`} className="flex items-center gap-2 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{a.client_name}</div>
                      {a.service && <div className="text-xs text-muted-foreground truncate">{a.service}</div>}
                    </div>
                    {roleChip(a.role)}
                    <CategoryBadge category={a.category} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
