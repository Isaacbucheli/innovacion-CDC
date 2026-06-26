import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import type { Alert } from "@/types";
import { SEVERITY_META, severityKey } from "@/lib/severity";
import { Button } from "@/components/ui/button";

export default function AlertCard({ alert, canEdit, onOpen, onEdit, onDelete }: {
  alert: Alert; canEdit: boolean; onOpen: (a: Alert) => void; onEdit: (a: Alert) => void; onDelete: (a: Alert) => void;
}) {
  const meta = SEVERITY_META[severityKey(alert.severity)];
  const chip = (v: string | null) => v ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{v}</span> : null;
  return (
    <div className="flex bg-background border rounded-lg overflow-hidden hover:border-primary/40 transition-colors">
      <div className="w-1" style={{ background: meta.accent }} />
      <button className="flex-1 text-left p-4 min-w-0" onClick={() => onOpen(alert)}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium flex-1 min-w-0">{alert.name}</span>
          <span className={`text-xs px-2.5 py-0.5 rounded-md ${meta.badge}`}>{meta.label}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex gap-1.5 flex-wrap mt-2">{chip(alert.resource)}{chip(alert.alert_type)}{chip(alert.origin)}</div>
      </button>
      {canEdit && (
        <div className="flex items-center gap-1 pr-3">
          <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => onEdit(alert)}><Pencil className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Eliminar" onClick={() => onDelete(alert)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
        </div>
      )}
    </div>
  );
}
