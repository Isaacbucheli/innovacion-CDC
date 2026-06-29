import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { analyzeWafCanonical, applyWafSuggestion, updateWafCanonical } from "@/lib/api";
import { REVIEW_STATUS_META, reviewStatusMeta } from "@/lib/waf";
import type { WafCanonical, WafAiSuggestion, WafCanonicalUpdate } from "@/types";

const PILLARS = [1, 2, 3, 4, 5];
const REVIEW = Object.keys(REVIEW_STATUS_META);
function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

export default function CanonicalEditDialog({ open, canonical, onOpenChange, onSaved }: {
  open: boolean; canonical: WafCanonical | null; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const [pillar, setPillar] = useState("2");
  const [status, setStatus] = useState("pending");
  const [scope, setScope] = useState("");
  const [benefit, setBenefit] = useState("");
  const [clientAction, setClientAction] = useState("");
  const [bitAction, setBitAction] = useState("");
  const [excluded, setExcluded] = useState(false);
  const [reason, setReason] = useState("");
  const [suggestion, setSuggestion] = useState<WafAiSuggestion | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !canonical) return;
    setPillar(String(canonical.pillar_number));
    setStatus(canonical.ai_review_status || "pending");
    setScope(canonical.review_scope_es ?? "");
    setBenefit(canonical.benefit_es ?? "");
    setClientAction(canonical.client_action_es ?? "");
    setBitAction(canonical.bit_action_es ?? "");
    setExcluded(canonical.is_excluded);
    setReason(canonical.exclusion_reason ?? "");
    setSuggestion(null);
  }, [open, canonical]);

  if (!canonical) return null;

  async function doAnalyze() {
    setBusy(true);
    try {
      const r = await analyzeWafCanonical(canonical!.canonical_id);
      setSuggestion(r.suggestion);
      toast.success("Análisis IA listo");
    } catch (e) { toast.error(`Error al analizar: ${msg(e)}`); }
    finally { setBusy(false); }
  }
  async function doApply() {
    if (!suggestion) return;
    setBusy(true);
    try {
      await applyWafSuggestion(canonical!.canonical_id, suggestion);
      toast.success("Sugerencia IA aplicada");
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error(`Error al aplicar: ${msg(e)}`); }
    finally { setBusy(false); }
  }
  async function doSave() {
    const body: WafCanonicalUpdate = {
      pillar_number: Number(pillar), review_scope_es: scope, benefit_es: benefit,
      client_action_es: clientAction, bit_action_es: bitAction, is_excluded: excluded,
      exclusion_reason: excluded ? reason : null, ai_review_status: status,
    };
    setBusy(true);
    try {
      await updateWafCanonical(canonical!.canonical_id, body);
      toast.success("Catálogo actualizado");
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error(`Error al guardar: ${msg(e)}`); }
    finally { setBusy(false); }
  }

  const field = (label: string, value: string, set: (v: string) => void) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea rows={2} value={value} onChange={(e) => set(e.target.value)} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{canonical.advisor_name}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{canonical.advisor_category}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Pilar</Label>
            <Select value={pillar} onValueChange={setPillar}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PILLARS.map((p) => <SelectItem key={p} value={String(p)}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Estado de revisión</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REVIEW.map((s) => <SelectItem key={s} value={s}>{reviewStatusMeta(s).label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {field("Ámbito", scope, setScope)}
        {field("Beneficio", benefit, setBenefit)}
        {field("Acción del cliente", clientAction, setClientAction)}
        {field("Acción Business IT", bitAction, setBitAction)}
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={excluded} onChange={(e) => setExcluded(e.target.checked)} /> Excluir del catálogo
        </label>
        {excluded && field("Motivo de exclusión", reason, setReason)}

        {suggestion && (
          <div className="rounded-lg border border-border bg-secondary p-3 text-sm space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Sugerencia IA · decisión: {suggestion.decision} · confianza {Math.round((suggestion.confidence ?? 0) * 100)}%</div>
            <div><span className="text-muted-foreground text-xs">Ámbito: </span>{suggestion.review_scope_es}</div>
            <div><span className="text-muted-foreground text-xs">Beneficio: </span>{suggestion.benefit_es}</div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={doAnalyze}>Analizar con IA</Button>
          {suggestion && <Button type="button" variant="outline" disabled={busy} onClick={doApply}>Aplicar sugerencia</Button>}
          <Button type="button" disabled={busy} onClick={doSave}>Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
