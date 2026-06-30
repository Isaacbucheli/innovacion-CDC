import type { ReportVmInventory, ReportPerfVm, ReportEstadoRecurso, ReportSla } from "@/types";

// Paleta de marca del informe (igual que el informe original de PRD).
export const REPORT_COLORS = {
  green: "#a3c243",
  greenDark: "#70b043",
  gold: "#d9a82a",
  crit: "#a53b35",
  ink: "#20252d",
  muted: "#68707d",
};

export function isWindows(os: string | null | undefined): boolean {
  return /win/i.test(os ?? "");
}

export function isRunning(status: string | null | undefined): boolean {
  return /running/i.test(status ?? "");
}

// Conteo de VMs por estado (encendidas vs detenidas).
export function vmStatusCounts(inv: ReportVmInventory[]): { running: number; stopped: number } {
  let running = 0;
  for (const v of inv) if (isRunning(v.status)) running++;
  return { running, stopped: inv.length - running };
}

// Conteo de VMs por sistema operativo.
export function osCounts(inv: ReportVmInventory[]): { windows: number; linux: number } {
  let windows = 0;
  for (const v of inv) if (isWindows(v.os)) windows++;
  return { windows, linux: inv.length - windows };
}

// Salud de recursos Azure (suma de disponibles vs con alerta).
export function healthCounts(estado: ReportEstadoRecurso[] | undefined): { disponibles: number; con_alerta: number } {
  let disponibles = 0, con_alerta = 0;
  for (const e of estado ?? []) { disponibles += e.disponibles ?? 0; con_alerta += e.con_alerta ?? 0; }
  return { disponibles, con_alerta };
}

export function parsePct(v: string | number | null | undefined): number {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "").replace("%", "").trim());
  return Number.isFinite(n) ? n : 0;
}

// Disponibilidad SLA promedio (sobre los servicios del informe).
export function slaAverage(sla: ReportSla[] | undefined): number {
  const xs = sla ?? [];
  if (!xs.length) return 0;
  const sum = xs.reduce((s, x) => s + parsePct(x.disponibilidad), 0);
  return Math.round(sum / xs.length);
}

// Promedios de CPU y RAM del período (sobre las VMs con métricas).
export function perfAverages(vms: ReportPerfVm[] | undefined): { cpu: number; ram: number } {
  const xs = vms ?? [];
  if (!xs.length) return { cpu: 0, ram: 0 };
  const cpu = xs.reduce((s, x) => s + (x.cpu_avg ?? 0), 0) / xs.length;
  const ram = xs.reduce((s, x) => s + (x.ram_avg ?? 0), 0) / xs.length;
  return { cpu: Math.round(cpu), ram: Math.round(ram) };
}
