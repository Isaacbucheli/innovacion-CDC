import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateFindingState } from "@/lib/api";
import { formatMoney } from "@/lib/costs";
import { checkMeta } from "@/lib/optimization";
import type { FindingState, OptFinding } from "@/types";
import { SevBadge } from "@/components/optimization/FindingBits";

const STATES: { value: FindingState; label: string }[] = [
  { value: "abierto", label: "Abierto" },
  { value: "en_progreso", label: "En progreso" },
  { value: "resuelto", label: "Resuelto" },
  { value: "ignorado", label: "Ignorado" },
];

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-primary mb-1">{label}</div>
      <div className="text-sm whitespace-pre-wrap break-all leading-relaxed">{value}</div>
    </div>
  );
}

export default function FindingDetailSheet({ finding, canEdit, open, onOpenChange, onSaved }: {
  finding: OptFinding | null;
  canEdit: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [state, setState] = useState<FindingState>("abierto");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (finding) {
      setState(finding.state);
      setNotes(finding.notes ?? "");
    }
  }, [finding]);

  const meta = finding ? checkMeta(finding.check_id) : null;
  const savings = finding?.estimated_monthly_savings;

  async function save() {
    if (!finding) return;
    setSaving(true);
    try {
      await updateFindingState(finding.fingerprint, state, notes.trim() || null);
      toast.success("Estado del hallazgo actualizado.");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(`No se pudo actualizar: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{meta?.title ?? finding?.check_id}</SheetTitle></SheetHeader>
        {finding && (
          <div className="space-y-4 mt-4">
            <div className="flex gap-2 flex-wrap items-center text-xs">
              <SevBadge sev={finding.severity} />
              {finding.resource_type && <span className="px-2 py-0.5 rounded-full bg-secondary">{finding.resource_type}</span>}
              {finding.region && <span className="px-2 py-0.5 rounded-full bg-secondary">{finding.region}</span>}
              {savings != null && savings > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#A3C243]/15 text-[#5a7016] dark:text-[#a9c46a] font-semibold">
                  {formatMoney(savings)} /mes
                </span>
              )}
            </div>

            <Field label="Recurso" value={finding.resource_name} />
            <Field label="ID del recurso" value={finding.azure_resource_id} />
            <Field label="Suscripción" value={finding.subscription_id} />
            {typeof finding.details?.note === "string" && <Field label="Nota" value={finding.details.note} />}

            <div className="border-t pt-4 space-y-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-primary mb-1">Estado</div>
                <Select value={state} onValueChange={(v) => setState(v as FindingState)} disabled={!canEdit || saving}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-primary mb-1">Nota (opcional)</div>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit || saving} rows={3} placeholder="Ej.: se migrará en el próximo mantenimiento…" />
              </div>
              {canEdit && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={save} disabled={saving}>Guardar</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
