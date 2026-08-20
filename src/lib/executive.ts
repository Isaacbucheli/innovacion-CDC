import { REPORT_COLORS } from "@/lib/report";
import type { ExecutivePayload, MonthlyReport, ReportVmInventory } from "@/types";

// Colores/estados del semáforo (port de informe-gerencial.js). verde/amarillo/rojo → paleta de marca.
export const STATE_COLORS: Record<string, string> = {
  verde: REPORT_COLORS.greenDark, amarillo: REPORT_COLORS.gold, rojo: REPORT_COLORS.crit,
};
export const STATE_LABELS: Record<string, string> = { verde: "Verde", amarillo: "Amarillo", rojo: "Rojo" };
export const STATE_HEADLINES: Record<string, string> = {
  verde: "Operación estable en el periodo",
  amarillo: "Plataforma disponible, con riesgos puntuales",
  rojo: "Hay desviaciones que requieren acción inmediata",
};
export const WAF_PILLARS: Record<number, string> = {
  1: "Eficiencia del rendimiento", 2: "Excelencia operacional", 3: "Seguridad",
  4: "Confiabilidad", 5: "Optimización de costos",
};

/** Porcentaje con un decimal; vacío si no hay valor. */
export function pct(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return `${Number(v).toFixed(1)} %`;
}

export function deltaText(v: number | null | undefined): string {
  if (v === null || v === undefined) return "sin comparativo mensual";
  const n = Number(v);
  return `${n > 0 ? "+" : ""}${n.toFixed(1)} pts vs mes anterior`;
}

export type Tone = "" | "warn" | "danger" | "neutral";
export function advisorTone(v: number | null | undefined): Tone {
  if (v === null || v === undefined) return "neutral";
  if (Number(v) >= 80) return "";
  if (Number(v) >= 50) return "warn";
  return "danger";
}

export function jobKind(label: string): "completado" | "advertencia" | "fallido" {
  const l = (label || "").toLowerCase();
  if (l.includes("advertencia")) return "advertencia";
  if (l.includes("fallido") || l.includes("failed")) return "fallido";
  return "completado";
}

// Forma laxa de las VMs de performance (no tipada estrictamente en MonthlyReport).
interface PerfVm { resource_name: string; cpu_avg?: number; cpu_max?: number; ram_avg?: number; ram_max?: number }
function perfVms(report: MonthlyReport): PerfVm[] {
  return (report.performance?.virtual_machines ?? []) as PerfVm[];
}

export interface KpiData {
  inventory: ReportVmInventory[]; running: number; cpuAvg: number | null; ramAvg: number | null;
  unavailable: number; protectedVms: number; events: number; total: number;
}

// Port de gxKpiData: métricas del informe (no recalcula Azure).
export function kpiData(report: MonthlyReport): KpiData {
  const inventory = report.inventario ?? [];
  const running = inventory.filter((vm) => /running/i.test(vm.status)).length;
  const vms = perfVms(report);
  const withCpu = vms.filter((v) => v.cpu_avg !== null && v.cpu_avg !== undefined);
  const withRam = vms.filter((v) => v.ram_avg !== null && v.ram_avg !== undefined);
  const cpuAvg = withCpu.length ? withCpu.reduce((s, v) => s + (v.cpu_avg ?? 0), 0) / withCpu.length : null;
  const ramAvg = withRam.length ? withRam.reduce((s, v) => s + (v.ram_avg ?? 0), 0) / withRam.length : null;
  const status = report.estado_recursos ?? [];
  const unavailable = status.reduce((s, r) => s + (r.con_alerta ?? 0), 0);
  const protectedVms = inventory.filter((vm) => vm.has_backup).length;
  const events = ((report.caidas as unknown[] | undefined) ?? []).length;
  return { inventory, running, cpuAvg, ramAvg, unavailable, protectedVms, events, total: inventory.length };
}

export interface Finding { nivel: string; titulo: string; detalle: string; accion: string }

// Port de gxBuildFindings: hallazgos automáticos priorizados a partir del semáforo + performance.
export function buildFindings(report: MonthlyReport, exec: ExecutivePayload | null): Finding[] {
  const findings: Finding[] = [];
  const domains = exec?.semaforo?.dominios ?? [];
  const byKey: Record<string, (typeof domains)[number]> = {};
  domains.forEach((d) => { byKey[d.dominio] = d; });
  const threshold = exec?.semaforo?.umbral_presion ?? 90;

  const paas = byKey.paas;
  if (paas && paas.estado === "rojo") {
    findings.push({ nivel: "rojo", titulo: "Recursos PaaS no disponibles", detalle: paas.lectura,
      accion: "Validar criticidad, estado real, dependencias y causa raíz de cada recurso." });
  }
  // "CPU prom X % (máx Y %)": omite el máximo sin dato y la métrica entera sin promedio,
  // para no dejar paréntesis o etiquetas vacías en el detalle.
  const metricaTexto = (nombre: string, avg?: number, max?: number): string => {
    if (avg === null || avg === undefined) return "";
    const maxTxt = max === null || max === undefined ? "" : ` (máx ${pct(max)})`;
    return `${nombre} prom ${pct(avg)}${maxTxt}`;
  };
  perfVms(report)
    .filter((v) => (v.cpu_avg ?? 0) >= threshold || (v.ram_avg ?? 0) >= threshold)
    .sort((a, b) => Math.max(b.ram_avg ?? 0, b.cpu_avg ?? 0) - Math.max(a.ram_avg ?? 0, a.cpu_avg ?? 0))
    .slice(0, 3)
    .forEach((v) => {
      const partes = [metricaTexto("CPU", v.cpu_avg, v.cpu_max), metricaTexto("RAM", v.ram_avg, v.ram_max)]
        .filter(Boolean);
      findings.push({ nivel: "rojo", titulo: v.resource_name,
        detalle: partes.length ? `${partes.join(" · ")}.` : "",
        accion: "Revisar carga, procesos y horarios de saturación; evaluar ajuste de capacidad." });
    });
  const alertas = byKey.alertas;
  if (alertas && alertas.estado === "rojo") {
    findings.push({ nivel: "rojo", titulo: "Alertas críticas del mes", detalle: alertas.lectura,
      accion: "Revisar causa raíz de los disparos críticos y acciones correctivas aplicadas." });
  }
  const backup = byKey.backup;
  if (backup && backup.estado !== "verde") {
    findings.push({ nivel: backup.estado, titulo: "Cobertura de respaldo", detalle: backup.lectura,
      accion: "Confirmar matriz de criticidad y alcance esperado de respaldo con el cliente." });
  }
  const rbac = byKey.rbac;
  if (rbac && rbac.estado !== "verde") {
    findings.push({ nivel: rbac.estado, titulo: "Permisos elevados (RBAC)", detalle: rbac.lectura,
      accion: "Revisar necesidad, vigencia y principio de menor privilegio." });
  }
  const conectividad = byKey.conectividad;
  if (conectividad && conectividad.estado !== "verde") {
    findings.push({ nivel: conectividad.estado, titulo: "Conectividad", detalle: conectividad.lectura,
      accion: "Validar estado de circuitos/conexiones con el proveedor." });
  }
  const order: Record<string, number> = { rojo: 0, amarillo: 1, verde: 2 };
  findings.sort((a, b) => (order[a.nivel] ?? 3) - (order[b.nivel] ?? 3));
  return findings;
}
