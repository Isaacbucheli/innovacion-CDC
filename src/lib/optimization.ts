import type { OptFinding } from "@/types";
import { severityKey, type SeverityKey } from "@/lib/severity";

// Estructura del reporte al estilo del FinOps Toolkit: dos secciones (Rate / Usage)
// y, dentro de Usage, grupos por dominio (Compute / Storage / Networking).
export type OptSection = "rate" | "usage";
export type OptGroup = "ahb" | "compute" | "storage" | "networking" | "other";

export interface CheckMeta {
  /** Título en español del check (el backend solo envía check_id en los findings). */
  title: string;
  section: OptSection;
  group: OptGroup;
}

/** Mapa check_id → metadata de presentación. Espejo de OptimizationChecks.Registered (.NET). */
export const CHECK_META: Record<string, CheckMeta> = {
  vms_without_ahb: { title: "Azure Hybrid Benefit no aplicado", section: "rate", group: "ahb" },
  underutilized_vms: { title: "VMs subutilizadas (right-sizing)", section: "usage", group: "compute" },
  stopped_not_deallocated_vms: { title: "VMs detenidas no desasignadas", section: "usage", group: "compute" },
  long_deallocated_vms: { title: "VMs desasignadas (posibles olvidadas)", section: "usage", group: "compute" },
  empty_app_service_plans: { title: "App Service Plans sin aplicaciones", section: "usage", group: "compute" },
  vms_without_ha: { title: "VMs sin alta disponibilidad", section: "usage", group: "compute" },
  orphaned_disks: { title: "Discos administrados no conectados", section: "usage", group: "storage" },
  old_snapshots: { title: "Snapshots antiguos (>90 días)", section: "usage", group: "storage" },
  storage_no_retention: { title: "Storage sin política de retención", section: "usage", group: "storage" },
  orphaned_public_ips: { title: "Public IPs sin asociar", section: "usage", group: "networking" },
  orphaned_nics: { title: "Interfaces de red huérfanas", section: "usage", group: "networking" },
  empty_subnets: { title: "Subnets vacías", section: "usage", group: "networking" },
  lb_appgw_no_backend: { title: "Balanceadores / App Gateways sin backend", section: "usage", group: "networking" },
  basic_load_balancers: { title: "Load Balancers Basic (en retiro)", section: "usage", group: "networking" },
};

export function checkMeta(checkId: string): CheckMeta {
  return CHECK_META[checkId] ?? { title: checkId, section: "usage", group: "other" };
}

export const GROUP_LABEL: Record<OptGroup, string> = {
  ahb: "Azure Hybrid Benefit",
  compute: "Compute",
  storage: "Storage",
  networking: "Networking",
  other: "Otros",
};

export const GROUP_COLOR: Record<OptGroup, string> = {
  ahb: "#A3C243", // verde marca
  compute: "#6d8a2e", // verde oscuro
  storage: "#a8a8a8", // gris
  networking: "#d9d9d9", // gris claro
  other: "#c4c4c4",
};

const SECTION_LABEL: Record<OptSection, string> = { rate: "Rate optimization", usage: "Usage optimization" };
const GROUP_ORDER: OptGroup[] = ["ahb", "compute", "storage", "networking", "other"];
const SECTION_ORDER: OptSection[] = ["rate", "usage"];

function savingsOf(f: OptFinding): number {
  return f.estimated_monthly_savings ?? 0;
}

/** Ordena por ahorro descendente (nulls al final). No muta la entrada. */
export function sortBySavings(findings: OptFinding[]): OptFinding[] {
  return [...findings].sort((a, b) => savingsOf(b) - savingsOf(a));
}

export interface GroupBucket {
  group: OptGroup;
  label: string;
  color: string;
  findings: OptFinding[];
  savings: number;
  count: number;
}
export interface SectionBucket {
  section: OptSection;
  label: string;
  groups: GroupBucket[];
  savings: number;
  count: number;
}

/** Agrupa los findings en secciones → grupos (solo los no vacíos), ordenados y con subtotales. */
export function groupFindings(findings: OptFinding[]): SectionBucket[] {
  const bySection = new Map<OptSection, Map<OptGroup, OptFinding[]>>();
  for (const f of findings) {
    const m = checkMeta(f.check_id);
    if (!bySection.has(m.section)) bySection.set(m.section, new Map());
    const groups = bySection.get(m.section)!;
    if (!groups.has(m.group)) groups.set(m.group, []);
    groups.get(m.group)!.push(f);
  }

  const out: SectionBucket[] = [];
  for (const section of SECTION_ORDER) {
    const groups = bySection.get(section);
    if (!groups) continue;
    const buckets: GroupBucket[] = [];
    for (const group of GROUP_ORDER) {
      const items = groups.get(group);
      if (!items || items.length === 0) continue;
      buckets.push({
        group,
        label: GROUP_LABEL[group],
        color: GROUP_COLOR[group],
        findings: sortBySavings(items),
        savings: items.reduce((s, f) => s + savingsOf(f), 0),
        count: items.length,
      });
    }
    if (buckets.length === 0) continue;
    out.push({
      section,
      label: SECTION_LABEL[section],
      groups: buckets,
      savings: buckets.reduce((s, g) => s + g.savings, 0),
      count: buckets.reduce((s, g) => s + g.count, 0),
    });
  }
  return out;
}

export interface SavingsSlice { group: OptGroup; label: string; color: string; savings: number }

/** Ahorro mensual agregado por grupo (para la dona). Solo grupos con ahorro > 0. */
export function savingsByGroup(findings: OptFinding[]): SavingsSlice[] {
  const totals = new Map<OptGroup, number>();
  for (const f of findings) {
    const g = checkMeta(f.check_id).group;
    totals.set(g, (totals.get(g) ?? 0) + savingsOf(f));
  }
  return GROUP_ORDER
    .filter((g) => (totals.get(g) ?? 0) > 0)
    .map((g) => ({ group: g, label: GROUP_LABEL[g], color: GROUP_COLOR[g], savings: totals.get(g)! }));
}

export interface OptKpis {
  totalSavings: number;
  count: number;
  severity: Record<Extract<SeverityKey, "high" | "medium" | "low">, number>;
}

export function computeKpis(findings: OptFinding[]): OptKpis {
  const severity = { high: 0, medium: 0, low: 0 };
  let totalSavings = 0;
  for (const f of findings) {
    totalSavings += savingsOf(f);
    const k = severityKey(f.severity);
    if (k === "high" || k === "medium" || k === "low") severity[k] += 1;
  }
  return { totalSavings, count: findings.length, severity };
}
