import { useMemo, useState } from "react";
import { Download, LayoutGrid, Plus, Search, Table2 } from "lucide-react";
import type { Alert } from "@/types";
import { type AlertFilters, filterAlerts, uniqueValues } from "@/lib/filter";
import { alertsToCsv } from "@/lib/csv";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Kpis from "@/components/alerts/Kpis";
import AlertCard from "@/components/alerts/AlertCard";
import AlertsDataTable from "@/components/alerts/AlertsDataTable";

const EMPTY: AlertFilters = { q: "", resource: "", type: "", severity: "", origin: "" };

function downloadCsv(csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "catalogo-alertas.csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

export default function AlertsView({ alerts, kqlCount, canEdit, onOpen, onNew, onEdit, onDelete }: {
  alerts: Alert[]; kqlCount: number; canEdit: boolean;
  onOpen: (a: Alert) => void; onNew: () => void; onEdit: (a: Alert) => void; onDelete: (a: Alert) => void;
}) {
  const [f, setF] = useState<AlertFilters>(EMPTY);
  const [view, setView] = useState<"table" | "cards">("table");
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
        <div className="flex rounded-md border overflow-hidden">
          <button
            type="button"
            onClick={() => setView("table")}
            aria-label="Vista tabla"
            className={`px-2.5 py-1.5 inline-flex items-center ${view === "table" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"}`}
          >
            <Table2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("cards")}
            aria-label="Vista tarjetas"
            className={`px-2.5 py-1.5 inline-flex items-center border-l ${view === "cards" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={() => downloadCsv(alertsToCsv(rows))}>
          <Download className="w-4 h-4 mr-1" />Exportar CSV
        </Button>
        {canEdit && <Button size="sm" onClick={onNew}><Plus className="w-4 h-4 mr-1" />Nueva</Button>}
      </div>
      {view === "table" ? (
        <AlertsDataTable alerts={rows} canEdit={canEdit} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Sin alertas que coincidan.</p>}
          {rows.map((a) => <AlertCard key={a.alert_id} alert={a} canEdit={canEdit} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  );
}
