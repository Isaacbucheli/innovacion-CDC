import { useEffect, useRef, useState } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getWafRecommendation, getWafResources, getWafComments, getWafHistory, dismissWafRecommendation } from "@/lib/api";
import { impactMeta, wafHistoryFieldLabel, wafHistoryValue } from "@/lib/waf";
import { translateToEnglish } from "@/lib/wafTranslate";
import { canEditModule } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import ConfirmDelete from "@/components/ConfirmDelete";
import type { WafRecommendationDetail, WafResource, WafComment, WafHistoryEntry } from "@/types";
import TrackingForm from "@/components/waf/TrackingForm";
import Comments from "@/components/waf/Comments";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-4">
      <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-3">{title}</h3>
      {children}
    </section>
  );
}

export default function WafDetailDialog({ clientId, canonicalId, pillarName, fallbackTitle, open, onOpenChange, onChanged, english = false }: {
  clientId: number; canonicalId: number | null; pillarName: string; fallbackTitle?: string;
  open: boolean; onOpenChange: (o: boolean) => void; onChanged: () => void; english?: boolean;
}) {
  const [detail, setDetail] = useState<WafRecommendationDetail | null>(null);
  const [resources, setResources] = useState<WafResource[]>([]);
  const [comments, setComments] = useState<WafComment[]>([]);
  const [history, setHistory] = useState<WafHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const editable = canEditModule("waf");
  // Id de petición: descarta respuestas obsoletas si el usuario abre otra recomendación
  // antes de que termine la carga anterior (evita que una respuesta vieja pise a la nueva).
  const reqRef = useRef(0);

  async function loadDetail(cid: number, reset: boolean) {
    const my = ++reqRef.current;
    // Al cambiar de recomendación se limpia el detalle previo para no mostrar datos viejos
    // (título/cuerpo) mientras carga el nuevo. En un refresco del mismo detalle no se limpia.
    if (reset) { setDetail(null); setResources([]); setComments([]); setHistory([]); }
    setLoading(true);
    try {
      const [d, r, c, h] = await Promise.all([
        getWafRecommendation(clientId, cid), getWafResources(clientId, cid),
        getWafComments(clientId, cid), getWafHistory(clientId, cid),
      ]);
      if (my !== reqRef.current) return; // llegó una petición más nueva: ignora esta
      setDetail(d); setResources(r); setComments(c); setHistory(h);
    } finally { if (my === reqRef.current) setLoading(false); }
  }

  useEffect(() => {
    if (open && canonicalId != null) loadDetail(canonicalId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, canonicalId]);

  const [tr, setTr] = useState<{ scope?: string; benefit?: string; client?: string; bit?: string }>({});
  useEffect(() => {
    setTr({}); // limpia la traducción del detalle anterior antes de traducir el nuevo
    if (!english || !detail) return;
    let cancelled = false;
    // El ámbito solo se traduce si NO hay original de Azure; beneficio y acciones son autoría BIT
    // (no existen en Azure), así que esos sí van siempre por traducción.
    const fields = [
      ...(detail.advisor_name_en ? [] : [detail.review_scope_es]),
      detail.benefit_es, detail.client_action_es, detail.bit_action_es,
    ].map((x) => x ?? "");
    translateToEnglish(fields)
      .then((map) => {
        if (cancelled) return;
        const g = (v: string | null) => (v ? map.get(v) : undefined);
        setTr({ scope: g(detail.review_scope_es), benefit: g(detail.benefit_es), client: g(detail.client_action_es), bit: g(detail.bit_action_es) });
      })
      .catch(() => { /* silencioso: mantiene el español */ });
    return () => { cancelled = true; };
  }, [english, detail]);

  const pick = (en: string | undefined, es: string | null) => (english ? (en ?? es) : es) ?? "—";
  // Título en inglés: manda el original de Azure; si no hay, la traducción del español curado.
  const scopeShown = detail
    ? (english ? (detail.advisor_name_en ?? tr.scope ?? detail.review_scope_es) : detail.review_scope_es)
    : null;

  function refreshComments() { if (canonicalId != null) getWafComments(clientId, canonicalId).then(setComments); }
  function afterTracking() { if (canonicalId != null) loadDetail(canonicalId, false); onChanged(); }

  async function doDismiss() {
    if (canonicalId == null) return;
    try {
      await dismissWafRecommendation(clientId, canonicalId);
      setConfirmOpen(false);
      onOpenChange(false);
      onChanged();
      toast.success("Recomendación descartada para este cliente.");
    } catch (e) {
      toast.error(`No se pudo descartar: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const m = detail ? impactMeta(detail.business_impact) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{detail ? `${detail.matrix_code} · ${scopeShown ?? "Recomendación"}` : (fallbackTitle ?? "Recomendación")}</span>
          </DialogTitle>
        </DialogHeader>
        {loading || !detail ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>
        ) : (
          <div>
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-accent text-accent-foreground">{pillarName}</span>
              {m && <span className={`text-xs px-2.5 py-0.5 rounded-full ${m.chip}`}>Impacto {m.label}</span>}
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{detail.resource_count} recursos</span>
              {english && (
                <span className="text-xs px-2.5 py-0.5 rounded-full border text-muted-foreground">
                  {detail.advisor_name_en ? "Título: original de Azure Advisor" : "Título: traducción automática"}
                </span>
              )}
              {editable && (
                <Button variant="outline" size="sm" className="ml-auto text-destructive hover:text-destructive"
                  onClick={() => setConfirmOpen(true)}>
                  <Ban className="w-4 h-4 mr-1" /> Descartar
                </Button>
              )}
            </div>

            <Section title="Resumen">
              <div className="space-y-3 text-sm">
                {english && (
                  <p className="text-xs text-muted-foreground">
                    Traducido (contenido BIT): estos textos no existen en Azure Advisor.
                  </p>
                )}
                <div><div className="text-muted-foreground text-xs mb-0.5">Beneficio</div>{pick(tr.benefit, detail.benefit_es)}</div>
                <div><div className="text-muted-foreground text-xs mb-0.5">Acción del cliente</div>{pick(tr.client, detail.client_action_es)}</div>
                <div><div className="text-muted-foreground text-xs mb-0.5">Acción Business IT</div>{pick(tr.bit, detail.bit_action_es)}</div>
              </div>
            </Section>

            <Section title="Seguimiento">
              <TrackingForm clientId={clientId} canonicalId={detail.canonical_id} detail={detail} onSaved={afterTracking}
                logHistory={history.filter((h) => h.field_changed === "execution_log")} />
            </Section>

            <Section title={`Recursos asociados (${resources.length})`}>
              {resources.length === 0 ? <p className="text-sm text-muted-foreground">Sin recursos.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1.5 pr-3 font-medium">Recurso</th><th className="py-1.5 pr-3 font-medium">Tipo</th>
                      <th className="py-1.5 pr-3 font-medium">Grupo</th><th className="py-1.5 font-medium">Estado</th>
                    </tr></thead>
                    <tbody>
                      {resources.map((r) => (
                        <tr key={r.finding_id} className="border-t border-border">
                          <td className="py-1.5 pr-3">{r.resource_name}</td><td className="py-1.5 pr-3">{r.resource_type ?? "—"}</td>
                          <td className="py-1.5 pr-3">{r.resource_group ?? "—"}</td>
                          <td className="py-1.5">{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title="Comentarios">
              <Comments clientId={clientId} canonicalId={detail.canonical_id} comments={comments} onAdded={refreshComments} />
            </Section>

            <Section title="Historial de cambios">
              {history.length === 0 ? <p className="text-sm text-muted-foreground">Sin cambios registrados.</p> : (
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  {history.map((h) => {
                    const showValues = (h.old_value ?? "") !== "" || (h.new_value ?? "") !== "";
                    return (
                      <li key={h.history_id}>
                        <span className="text-foreground">{wafHistoryFieldLabel(h.field_changed)}</span>
                        {showValues && <>: {wafHistoryValue(h.field_changed, h.old_value)} → {wafHistoryValue(h.field_changed, h.new_value)}</>}
                        {" · "}{h.changed_by ?? "—"} · {fmtDate(h.changed_at)}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          </div>
        )}
        <ConfirmDelete
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          label={detail?.matrix_code ?? "esta recomendación"}
          title="¿Descartar recomendación?"
          description={<>Esta recomendación se descartará para este cliente y no volverá a mostrarse aunque Advisor, CSV o Excel la importen de nuevo.</>}
          confirmLabel="Descartar"
          onConfirm={doDismiss}
        />
      </DialogContent>
    </Dialog>
  );
}
