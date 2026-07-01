import type { CostResult, Scenario } from "@/types";

// Etiquetas e iconos de servicio (portados del front vanilla de bitcost).
export const SERVICE_LABELS: Record<string, string> = {
  vms: "Virtual Machines",
  sql_vm: "SQL Server en Azure VMs",
  sql_managed_instance: "SQL Managed Instance",
  disks: "Managed Disks",
  sql: "Azure SQL Database",
  synapse_dw: "Synapse Dedicated SQL Pool",
  appservice: "App Service Plans",
  mysql: "MySQL Flexible Server",
  cosmos: "Cosmos DB",
  redis: "Azure Cache for Redis",
  public_ip: "IPs públicas",
  storage: "Storage Account",
};

export const SERVICE_ICONS: Record<string, string> = {
  vms: "/assets/azure-icons/virtual-machine.svg",
  sql_vm: "/assets/azure-icons/virtual-machine.svg",
  sql_managed_instance: "/assets/azure-icons/sql-managed-instance.svg",
  disks: "/assets/azure-icons/managed-disks.svg",
  sql: "/assets/azure-icons/sql-database.svg",
  synapse_dw: "/assets/azure-icons/synapse-analytics.svg",
  appservice: "/assets/azure-icons/app-service.svg",
  mysql: "/assets/azure-icons/mysql.svg",
  cosmos: "/assets/azure-icons/cosmos-db.svg",
  redis: "/assets/azure-icons/redis.svg",
  public_ip: "/assets/azure-icons/public-ip.svg",
  storage: "/assets/azure-icons/storage-account.svg",
};

/** sql_vm es interno: se muestra agrupado bajo "vms". */
export function visibleServiceKey(key: string | null | undefined): string {
  return key === "sql_vm" ? "vms" : key ?? "";
}

export function serviceName(key: string | null | undefined): string {
  const k = key ?? "";
  return SERVICE_LABELS[k] || k || "-";
}

export function serviceIcon(key: string | null | undefined): string {
  return SERVICE_ICONS[key ?? ""] || "/assets/azure-icons/resources.svg";
}

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formato USD con 2 decimales; "-" para nulo/vacío/no finito. */
export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return moneyFormatter.format(n);
}

/** Porcentaje con 1 decimal; valores <= 1 se asumen fracción (x100); "-" si <= 0 o no finito. */
export function formatPct(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "-";
  const pct = n <= 1 ? n * 100 : n;
  return `${pct.toFixed(1)}%`;
}

// Estados de cálculo: etiqueta + estilo del pill.
export const STATUS_META: Record<string, { label: string; badge: string }> = {
  calculated: { label: "Calculado", badge: "bg-green-100 text-green-800" },
  variable_pricing: { label: "Precio variable", badge: "bg-amber-100 text-amber-800" },
  price_not_found: { label: "Precio no encontrado", badge: "bg-red-100 text-red-800" },
  manual_required: { label: "Requiere costo manual", badge: "bg-orange-100 text-orange-800" },
  not_applicable: { label: "No aplica", badge: "bg-slate-100 text-slate-700" },
  not_running: { label: "No encendida", badge: "bg-slate-100 text-slate-700" },
  error: { label: "Error", badge: "bg-red-100 text-red-800" },
};

export function statusMeta(status: string | null | undefined): { label: string; badge: string } {
  return STATUS_META[status ?? ""] ?? { label: status || "-", badge: "bg-slate-100 text-slate-700" };
}

// Origen del precio: refleja pricingBadge() del front vanilla.
export type PricingKind = "ai" | "manual" | "exact" | "none";

export const PRICING_META: Record<PricingKind, { label: string; title: string; badge: string }> = {
  ai: {
    label: "IA asistida",
    title: "Azure OpenAI ayudó a seleccionar un meter real de Retail Prices API.",
    badge: "bg-violet-100 text-violet-800",
  },
  manual: {
    label: "Manual",
    title: "No hubo candidato real suficiente en Retail Prices API.",
    badge: "bg-orange-100 text-orange-800",
  },
  exact: {
    label: "Exacto",
    title: "Precio seleccionado por reglas determinísticas y Retail Prices API.",
    badge: "bg-green-100 text-green-800",
  },
  none: { label: "-", title: "", badge: "bg-slate-100 text-slate-600" },
};

export function pricingKind(row: CostResult): PricingKind {
  const raw = row.calculation_notes || "";
  if (raw.includes("assist_match")) return "ai";
  if (row.calculation_status === "manual_required") return "manual";
  if (row.calculation_status === "calculated") return "exact";
  return "none";
}

export function riConfirmed(row: CostResult): boolean {
  return row.ri_coverage === "confirmed";
}

export function riTooltip(row: CostResult): string {
  return [row.ri_reservation_name, row.ri_term].filter(Boolean).join(" · ");
}

/** Horas encendida del mes anterior (solo VMs); "-" si no aplica o sin datos. */
export function powerHoursLabel(row: CostResult): string {
  if (row.power_running_hours == null) return "-";
  return `${Math.round(Number(row.power_running_hours))} h`;
}

export function powerUptimeLabel(row: CostResult): string {
  if (row.power_uptime_pct == null) return "-";
  return `${Number(row.power_uptime_pct).toFixed(0)}%`;
}

/**
 * Nota legible por servicio, parseada de calculation_notes (puramente cosmética).
 * Port de translateNote() del front vanilla; usa \S+ para capturar tokens completos.
 */
export function translateNote(row: CostResult): string {
  const raw = row.calculation_notes || "";
  const service = visibleServiceKey(row.service_key);
  const sku = raw.match(/sku=(\S+)/i)?.[1];
  const category = raw.match(/category=(\S+)/i)?.[1];
  const capacity = raw.match(/capacity=(\S+)/i)?.[1];
  const tier = raw.match(/tier=(\S+)/i)?.[1];
  const storage = raw.match(/storage_gb=(\S+)/i)?.[1];

  if (service === "public_ip") {
    const assocText = category === "orphan" ? "sin recurso asociado" : "asociada a un recurso activo";
    return `IP pública ${sku || "Azure"} ${assocText}. Costo mensual estimado con Azure Retail Prices API.`;
  }
  if (service === "appservice") {
    const instances = capacity ? `${capacity} instancia(s)` : "capacidad detectada";
    return `Plan ${sku || "App Service"} con ${instances}. Precio mensual calculado según región y sistema operativo.`;
  }
  if (service === "mysql") {
    const storageText = storage ? ` y ${storage} GB de almacenamiento` : "";
    return `Servidor MySQL Flexible ${tier || ""}${storageText}. Compute y storage calculados por separado.`;
  }
  if (service === "redis") {
    return `Cache Redis ${sku || ""}. Precio seleccionado por SKU, familia y capacidad.`;
  }
  if (service === "disks") {
    return `Disco administrado ${sku || ""}. Precio mensual estimado por tipo, tier y tamaño provisionado.`;
  }
  if (service === "sql") {
    return `Base Azure SQL calculada según tier, modelo de compra y capacidad configurada.`;
  }
  if (service === "vms") {
    return `Máquina virtual calculada por tamaño, región, sistema operativo y estado de ejecución.`;
  }
  return raw || "Costo calculado con metadata importada desde Azure.";
}

/** Costo PAYG mensual de una fila (payg_monthly, con fallback a costo manual). */
export function rowPayg(row: CostResult): number {
  return Number(row.payg_monthly ?? row.manual_monthly_cost ?? 0) || 0;
}

/** Nombres de suscripción presentes (orden alfabético); "(sin suscripción)" si falta. */
export function subscriptionNames(rows: CostResult[]): string[] {
  return [...new Set(rows.map((r) => r.subscription_name || "(sin suscripción)"))].sort();
}

/** Aplica el filtro multi-suscripción (null = todas). */
export function applySubscriptionFilter(rows: CostResult[], selected: string[] | null): CostResult[] {
  if (selected === null) return rows;
  return rows.filter((r) => selected.includes(r.subscription_name || "(sin suscripción)"));
}

/** Texto sobre el que actúa el buscador full-text de la tabla. */
export function rowSearchText(row: CostResult): string {
  return [
    serviceName(visibleServiceKey(row.service_key)),
    row.resource_name,
    row.resource_group,
    row.location,
    statusMeta(row.calculation_status).label,
    translateNote(row),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export interface ResultFilters {
  q: string;
  serviceKey: string; // "" = todos
  hideReserved: boolean;
}

/** Filtro de la tabla de resultados: buscador + servicio + ocultar reservados. */
export function filterResults(rows: CostResult[], f: ResultFilters): CostResult[] {
  const term = f.q.trim().toLowerCase();
  return rows.filter((row) => {
    if (f.hideReserved && riConfirmed(row)) return false;
    if (f.serviceKey && visibleServiceKey(row.service_key) !== f.serviceKey) return false;
    if (term && !rowSearchText(row).includes(term)) return false;
    return true;
  });
}

export interface ServiceGroup {
  serviceKey: string;
  label: string;
  icon: string;
  payg: number;
  count: number;
  issues: number;
}

/**
 * Agrupa por servicio visible para las tarjetas-resumen. issues = recursos cuyo
 * estado NO es calculated/not_running/not_applicable (los que "por revisar").
 */
export function groupByService(rows: CostResult[]): ServiceGroup[] {
  const acc = new Map<string, ServiceGroup>();
  for (const row of rows) {
    const key = visibleServiceKey(row.service_key) || "otros";
    let g = acc.get(key);
    if (!g) {
      g = { serviceKey: key, label: serviceName(key), icon: serviceIcon(key), payg: 0, count: 0, issues: 0 };
      acc.set(key, g);
    }
    g.count += 1;
    g.payg += rowPayg(row);
    if (!["calculated", "not_running", "not_applicable"].includes(row.calculation_status ?? "")) {
      g.issues += 1;
    }
  }
  return [...acc.values()];
}

export interface CostKpis {
  payg: number;
  resources: number;
  calculated: number;
  review: number;
  best: Scenario | null;
}

/** KPIs ejecutivos calculados igual que el front vanilla (renderKpis). */
export function computeKpis(rows: CostResult[], scenarios: Scenario[]): CostKpis {
  const payg = rows.reduce((acc, row) => acc + rowPayg(row), 0);
  const calculated = rows.filter((r) => r.calculation_status === "calculated").length;
  const review = rows.filter(
    (r) => r.calculation_status === "variable_pricing" || r.calculation_status === "manual_required",
  ).length;
  return { payg, resources: rows.length, calculated, review, best: bestScenario(scenarios) };
}

/** Escenario con el mayor ahorro mensual (el "mejor"); null si no hay. */
export function bestScenario(scenarios: Scenario[]): Scenario | null {
  if (!scenarios.length) return null;
  return scenarios
    .slice()
    .sort((a, b) => Number(b.savings_monthly || 0) - Number(a.savings_monthly || 0))[0];
}
