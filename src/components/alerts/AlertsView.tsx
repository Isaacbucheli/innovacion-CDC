import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Alert } from "@/types";
import { type AlertFilters, filterAlerts, uniqueValues } from "@/lib/filter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Kpis from "@/components/alerts/Kpis";
import AlertCard from "@/components/alerts/AlertCard";

const EMPTY: AlertFilters = { q: "", resource: "", type: "", severity: "", origin: "" };

export default function AlertsView({ alerts, kqlCount, canEdit, onOpen, onEdit, onDelete }: {
  alerts: Alert[]; kqlCount: number; canEdit: boolean;
  onOpen: (a: Alert) => void; onEdit: (a: Alert) => void; onDelete: (a: Alert) => void;
}) {
  const [f, setF] = useState<AlertFilters>(EMPTY);
  const rows = useMemo(() => filterAlerts(alerts, f), [alerts, f]);
  const set = (k: keyof AlertFilters) => (v: string) => setF((p) => ({ ...p, [k]: v === "__all" ? "" : v }));

  const pick = (key: "resource" | "alert_type" | "severity" | "origin", label: string, fk: keyof AlertFilters) => (
    <Select value={f[fk] || "__all"} onValueChange={set(fk)}>
      <SelectTrigger className="w-[150px]"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">{label}: todos</SelectItem>
        {uniqueValues(alerts, key).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div>
      <Kpis alerts={alerts} kqlCount={kqlCount} />
      <div className="flex gap-2 flex-wrap items-center mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar alerta…" value={f.q} onChange={(e) => setF((p) => ({ ...p, q: e.target.value }))} />
        </div>
        {pick("resource", "Recurso", "resource")}
        {pick("alert_type", "Tipo", "type")}
        {pick("severity", "Severidad", "severity")}
        {pick("origin", "Origen", "origin")}
        <span className="text-sm text-muted-foreground ml-auto">{rows.length} de {alerts.length}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {rows.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Sin alertas que coincidan.</p>}
        {rows.map((a) => <AlertCard key={a.alert_id} alert={a} canEdit={canEdit} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />)}
      </div>
    </div>
  );
}
