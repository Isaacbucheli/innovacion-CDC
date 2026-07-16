import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getWafRecommendation, getWafResources, getWafComments, getWafHistory } from "@/lib/api";
import { impactMeta } from "@/lib/waf";
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

export default function WafDetailDialog({ clientId, canonicalId, pillarName, open, onOpenChange, onChanged }: {
  clientId: number; canonicalId: number | null; pillarName: string;
  open: boolean; onOpenChange: (o: boolean) => void; onChanged: () => void;
}) {
  const [detail, setDetail] = useState<WafRecommendationDetail | null>(null);
  const [resources, setResources] = useState<WafResource[]>([]);
  const [comments, setComments] = useState<WafComment[]>([]);
  const [history, setHistory] = useState<WafHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
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

  function refreshComments() { if (canonicalId != null) getWafComments(clientId, canonicalId).then(setComments); }
  function afterTracking() { if (canonicalId != null) loadDetail(canonicalId, false); onChanged(); }

  const m = detail ? impactMeta(detail.business_impact) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{detail ? `${detail.matrix_code} · ${detail.review_scope_es ?? "Recomendación"}` : "Cargando…"}</span>
          </DialogTitle>
        </DialogHeader>
        {loading || !detail ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>
        ) : (
          <div>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-accent text-accent-foreground">{pillarName}</span>
              {m && <span className={`text-xs px-2.5 py-0.5 rounded-full ${m.chip}`}>Impacto {m.label}</span>}
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{detail.resource_count} recursos</span>
            </div>

            <Section title="Resumen">
              <div className="space-y-3 text-sm">
                <div><div className="text-muted-foreground text-xs mb-0.5">Beneficio</div>{detail.benefit_es ?? "—"}</div>
                <div><div className="text-muted-foreground text-xs mb-0.5">Acción del cliente</div>{detail.client_action_es ?? "—"}</div>
                <div><div className="text-muted-foreground text-xs mb-0.5">Acción Business IT</div>{detail.bit_action_es ?? "—"}</div>
              </div>
            </Section>

            <Section title="Seguimiento">
              <TrackingForm clientId={clientId} canonicalId={detail.canonical_id} detail={detail} onSaved={afterTracking} />
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
                  {history.map((h) => (
                    <li key={h.history_id}>
                      <span className="text-foreground">{h.field_changed}</span> {h.old_value ?? "—"} → {h.new_value ?? "—"} · {h.changed_by ?? "—"} · {new Date(h.changed_at).toLocaleDateString("es-EC")}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
