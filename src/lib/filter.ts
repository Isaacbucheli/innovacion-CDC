import type { Alert } from "@/types";

export interface AlertFilters {
  q: string;
  resource: string;
  type: string;
  severity: string;
  origin: string;
}

export function filterAlerts(alerts: Alert[], f: AlertFilters): Alert[] {
  const q = f.q.trim().toLowerCase();
  return alerts.filter((a) => {
    if (q) {
      const hay = `${a.name ?? ""} ${a.description ?? ""} ${a.resource ?? ""} ${a.detail ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.resource && a.resource !== f.resource) return false;
    if (f.type && a.alert_type !== f.type) return false;
    if (f.severity && a.severity !== f.severity) return false;
    if (f.origin && a.origin !== f.origin) return false;
    return true;
  });
}

export function uniqueValues(alerts: Alert[], key: keyof Alert): string[] {
  const set = new Set<string>();
  for (const a of alerts) {
    const v = a[key];
    if (typeof v === "string" && v) set.add(v);
  }
  return [...set].sort((x, y) => x.localeCompare(y, "es"));
}
