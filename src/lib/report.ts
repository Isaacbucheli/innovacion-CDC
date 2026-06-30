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

// Nombre legible de una regla de alerta cuyo "tipo" suele ser un resource id largo.
export function shortRuleName(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  if (!t || t === "-") return "—";
  if (t.includes("/")) return t.split("/").filter(Boolean).pop() ?? t;
  return t;
}

// Clase de chip (Tailwind) por severidad de alerta.
export function alertSeverityChip(sev: string | null | undefined): string {
  const s = (sev ?? "").toLowerCase();
  if (/crit|error/.test(s)) return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
  if (/advert|warn/.test(s)) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
}

// Clase de chip por estado de respaldo/job.
export function backupStateChip(estado: string | null | undefined): string {
  const s = (estado ?? "").toLowerCase();
  if (/complet|exito|success/.test(s)) return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200";
  if (/fall|error|fail/.test(s)) return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
  return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
}

// Top-N por una métrica numérica (descendente).
export function topBy<T>(rows: T[], key: (r: T) => number, n: number): T[] {
  return [...rows].sort((a, b) => key(b) - key(a)).slice(0, n);
}
