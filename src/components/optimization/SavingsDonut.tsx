import ReportDonut from "@/components/reports/ReportDonut";
import { savingsByGroup } from "@/lib/optimization";
import type { OptFinding } from "@/types";

/** Dona de ahorro mensual estimado por categoría (reusa el ReportDonut del informe). */
export default function SavingsDonut({ findings }: { findings: OptFinding[] }) {
  const data = savingsByGroup(findings).map((s) => ({
    name: s.label,
    value: Math.round(s.savings),
    color: s.color,
  }));
  return <ReportDonut title="Ahorro estimado por categoría (USD/mes)" data={data} />;
}
