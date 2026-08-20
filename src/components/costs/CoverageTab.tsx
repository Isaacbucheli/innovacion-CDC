import { useEffect, useState } from "react";
import { Gauge, LayoutGrid } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { getCoverage } from "@/lib/api";
import { coverageKpis } from "@/lib/finops";
import { useCountUp } from "@/lib/useCountUp";
import type { CoverageResult } from "@/types";

function PctValue({ n }: { n: number }) {
  return <>{useCountUp(n)}%</>;
}

function Card({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border bg-background p-5 transition-shadow hover:shadow-md">
      <div className="w-9 h-9 rounded-lg grid place-items-center mb-3 text-[#5a7016] dark:text-[#a9c46a] bg-secondary">
        {icon}
      </div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums tracking-tight mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{sub}</div>}
    </div>
  );
}

export default function CoverageTab({ analysisId }: { analysisId: number }) {
  const [data, setData] = useState<CoverageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    getCoverage(analysisId)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar la cobertura de cálculo.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  if (loading) return <Skeleton className="h-40 w-full mt-4" />;
  if (error) return <p className="text-destructive py-4">{error}</p>;
  if (!data) return null;

  const kpis = coverageKpis(data);
  const uncovered = [...data.uncovered].sort((a, b) => b.count - a.count);

  return (
    <div className="mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card
          icon={<Gauge className="w-[18px] h-[18px]" />}
          label="Cobertura de cálculo"
          value={<PctValue n={data.coverage_pct} />}
          sub={kpis.costedLabel}
        />
        <Card
          icon={<LayoutGrid className="w-[18px] h-[18px]" />}
          label="Tipos sin costear"
          value={kpis.uncoveredCount}
          sub="Tipos de recurso distintos sin calculadora de costos."
        />
      </div>

      {uncovered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">
          Todos los recursos inventariados tienen calculadora de costos.
        </p>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary">
              <TableRow>
                <TableHead>Tipo de recurso</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uncovered.map((g) => (
                <TableRow key={g.resource_type}>
                  <TableCell>{g.display_name ?? g.resource_type}</TableCell>
                  <TableCell>{g.service_category ?? ""}</TableCell>
                  <TableCell className="text-right tabular-nums">{g.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        Estos tipos de recurso están inventariados pero no tienen calculadora de costos.
      </p>
    </div>
  );
}
