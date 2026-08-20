import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateWafTracking } from "@/lib/api";
import { validateTracking } from "@/lib/waf";
import { canEditModule } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import type { WafRecommendationDetail, WafTrackingUpdate, WafHistoryEntry } from "@/types";

const PRIORITY = [{ v: "1", l: "Alta" }, { v: "2", l: "Media" }, { v: "3", l: "Baja" }];

export default function TrackingForm({ clientId, canonicalId, detail, onSaved, logHistory = [] }: {
  clientId: number; canonicalId: number; detail: WafRecommendationDetail; onSaved: () => void;
  logHistory?: WafHistoryEntry[];
}) {
  const editable = canEditModule("waf");
  const [pct, setPct] = useState(detail.completion_pct ?? 0);
  const [date, setDate] = useState(detail.remediation_start_date ?? "");
  const [endDate, setEndDate] = useState(detail.remediation_end_date ?? "");
  const [effort, setEffort] = useState(detail.projected_bit_effort ?? "");
  const [priority, setPriority] = useState(detail.priority_override ? String(detail.priority_override) : "");
  const [log, setLog] = useState(detail.execution_log ?? "");
  const [notes, setNotes] = useState(detail.internal_notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    const errs = validateTracking({
      completion_pct: pct, remediation_start_date: date || null, remediation_end_date: endDate || null,
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body: WafTrackingUpdate = {
      completion_pct: pct,
      remediation_start_date: date || null,
      remediation_end_date: endDate || null,
      projected_bit_effort: effort || null,
      priority_override: priority ? Number(priority) : null,
      execution_log: log || null,
      internal_notes: notes || null,
    };
    setSaving(true);
    try {
      await updateWafTracking(clientId, canonicalId, body);
      toast.success("Seguimiento guardado");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pct">Avance: {pct}%</Label>
          <input id="pct" type="range" min={0} max={100} step={1} value={pct}
            disabled={!editable} onChange={(e) => setPct(Number(e.target.value))} className="w-full" />
          {errors.completion_pct && <p className="text-sm text-destructive">{errors.completion_pct}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="priority">Prioridad</Label>
          <Select value={priority} onValueChange={setPriority} disabled={!editable}>
            <SelectTrigger id="priority"><SelectValue placeholder="Sin definir" /></SelectTrigger>
            <SelectContent>{PRIORITY.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Fecha de inicio</Label>
          <Input id="date" type="date" value={date} disabled={!editable} onChange={(e) => setDate(e.target.value)} />
          {errors.remediation_start_date && <p className="text-sm text-destructive">{errors.remediation_start_date}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end-date">Fecha de cierre</Label>
          <Input id="end-date" type="date" value={endDate} disabled={!editable} onChange={(e) => setEndDate(e.target.value)} />
          {errors.remediation_end_date && <p className="text-sm text-destructive">{errors.remediation_end_date}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="effort">Esfuerzo BIT</Label>
          <Input id="effort" value={effort} disabled={!editable} onChange={(e) => setEffort(e.target.value)} placeholder="8 horas" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="log">Bitácora de ejecución</Label>
        <Textarea id="log" rows={2} value={log} disabled={!editable} onChange={(e) => setLog(e.target.value)} />
        {logHistory.length > 0 && (
          <details className="mt-0.5">
            <summary className="text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground w-fit">
              Historial ({logHistory.length})
            </summary>
            <ul className="mt-1.5 space-y-2 max-h-40 overflow-y-auto rounded-md border border-border bg-muted/30 px-2.5 py-2">
              {logHistory.map((h) => (
                <li key={h.history_id} className="text-xs">
                  <div className="text-muted-foreground">
                    {[fmtDate(h.changed_at), h.changed_by].filter(Boolean).join(" · ")}
                  </div>
                  <div className="whitespace-pre-wrap text-foreground">{h.new_value ?? ""}</div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas internas</Label>
        <Textarea id="notes" rows={2} value={notes} disabled={!editable} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {editable && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>Guardar seguimiento</Button>
        </div>
      )}
    </div>
  );
}
