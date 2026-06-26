import type { Alert } from "@/types";
import { severityKey } from "@/lib/severity";

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-lg bg-background border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${danger ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

export default function Kpis({ alerts, kqlCount }: { alerts: Alert[]; kqlCount: number }) {
  const high = alerts.filter((a) => ["critical", "high"].includes(severityKey(a.severity))).length;
  const types = new Set(alerts.map((a) => a.alert_type).filter(Boolean)).size;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <Stat label="Total alertas" value={alerts.length} />
      <Stat label="Alta / crítica" value={high} danger />
      <Stat label="Tipos" value={types} />
      <Stat label="Consultas KQL" value={kqlCount} />
    </div>
  );
}
