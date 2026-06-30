import { Server, PlayCircle, PauseCircle, ShieldCheck, Cpu, MemoryStick, DatabaseBackup, CheckCircle2 } from "lucide-react";
import ReportDonut from "@/components/reports/ReportDonut";
import { REPORT_COLORS, vmStatusCounts, osCounts, healthCounts, slaAverage, perfAverages } from "@/lib/report";
import type { MonthlyReport } from "@/types";

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="w-8 h-8 rounded-lg grid place-items-center mb-2" style={{ background: `${accent}22`, color: accent }}>{icon}</div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums tracking-tight mt-0.5">{value}</div>
    </div>
  );
}

export default function ExecutiveSummary({ report }: { report: MonthlyReport }) {
  const inv = report.inventario ?? [];
  const vms = report.performance?.virtual_machines ?? [];
  const status = vmStatusCounts(inv);
  const os = osCounts(inv);
  const health = healthCounts(report.estado_recursos);
  const sla = slaAverage(report.sla);
  const perf = perfAverages(vms);
  const backupItems = report.backups?.items?.length ?? 0;
  const jobsOk = report.backups?.jobs_mes?.["Completado"] ?? 0;
  const meta = report.meta ?? {};
  const narrative = report.narrative ?? {};
  const { green, greenDark, gold, crit, ink } = REPORT_COLORS;

  return (
    <div className="space-y-6">
      {/* Portada */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">{report.client?.name ?? "—"}</h2>
            <p className="text-sm text-muted-foreground">Informe de gestión · {report.period?.label ?? ""}{report.period?.partial ? " (parcial)" : ""}</p>
          </div>
          {report.generated_at && <span className="text-xs text-muted-foreground">generado {report.generated_at.slice(0, 10)}</span>}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {(meta.regiones ?? []).map((r) => (
            <span key={r} className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{r}</span>
          ))}
          {(meta.suscripciones ?? []).length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {meta.suscripciones!.length} {meta.suscripciones!.length === 1 ? "suscripción" : "suscripciones"}
            </span>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<Server className="w-4 h-4" />} label="Máquinas virtuales" value={String(inv.length)} accent={green} />
        <Kpi icon={<PlayCircle className="w-4 h-4" />} label="En ejecución" value={String(status.running)} accent={greenDark} />
        <Kpi icon={<PauseCircle className="w-4 h-4" />} label="Detenidas" value={String(status.stopped)} accent={gold} />
        <Kpi icon={<ShieldCheck className="w-4 h-4" />} label="Disponibilidad SLA" value={`${sla}%`} accent={greenDark} />
        <Kpi icon={<Cpu className="w-4 h-4" />} label="CPU promedio" value={`${perf.cpu}%`} accent={ink} />
        <Kpi icon={<MemoryStick className="w-4 h-4" />} label="RAM promedio" value={`${perf.ram}%`} accent={ink} />
        <Kpi icon={<DatabaseBackup className="w-4 h-4" />} label="Elementos con backup" value={String(backupItems)} accent={green} />
        <Kpi icon={<CheckCircle2 className="w-4 h-4" />} label="Backup jobs OK" value={String(jobsOk)} accent={greenDark} />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ReportDonut title="Estado de máquinas virtuales" data={[
          { name: "En ejecución", value: status.running, color: greenDark },
          { name: "Detenidas", value: status.stopped, color: gold },
        ]} />
        <ReportDonut title="Sistema operativo" data={[
          { name: "Windows", value: os.windows, color: green },
          { name: "Linux", value: os.linux, color: gold },
        ]} />
        <ReportDonut title="Salud de recursos Azure" data={[
          { name: "Disponibles", value: health.disponibles, color: greenDark },
          { name: "Con alerta", value: health.con_alerta, color: crit },
        ]} />
      </div>

      {/* Narrativa IA */}
      {(narrative.resumen_ejecutivo || (narrative.hallazgos?.length ?? 0) > 0) && (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h3 className="text-sm font-medium">Resumen ejecutivo</h3>
          {narrative.resumen_ejecutivo && <p className="text-sm text-muted-foreground leading-relaxed">{narrative.resumen_ejecutivo}</p>}
          {(narrative.hallazgos?.length ?? 0) > 0 && (
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              {narrative.hallazgos!.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
