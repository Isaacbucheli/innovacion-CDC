import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getReservationConsumers } from "@/lib/api";
import { appliedScopeText, daysLabel, daysChip, stateChip, utilChip } from "@/lib/reservations";
import type { Reservation, ReservationConsumer } from "@/types";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

export default function ReservationDetailDialog({ reservation, clientId, util, open, onOpenChange }: {
  reservation: Reservation | null;
  clientId: number;
  util: { last?: string | null; d7?: string | null };
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [consumers, setConsumers] = useState<ReservationConsumer[] | null>(null);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !reservation) return;
    setConsumers(null); setSource(""); setLoading(true);
    getReservationConsumers(clientId, reservation.credential_id, reservation.reservation_id, 30)
      .then((d) => { setConsumers(d.consumers ?? []); setSource(d.source); })
      .catch(() => { setConsumers([]); setSource("error"); })
      .finally(() => setLoading(false));
  }, [open, reservation, clientId]);

  const r = reservation;
  const chip = (cls: string, text: React.ReactNode) => <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{text}</span>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle className="truncate">{r?.name ?? "Reserva"}</DialogTitle></DialogHeader>
        {r && (
          <div className="space-y-5">
            <div>
              <h4 className="text-sm font-medium mb-1">Identificación</h4>
              <Row label="Producto" value={r.product} />
              <Row label="Región" value={r.region} />
              <Row label="Cantidad" value={r.quantity} />
              <Row label="Término" value={r.term_label || r.term} />
              <Row label="Caduca" value={<span className="inline-flex items-center gap-2">{r.expires_on} {chip(daysChip(r), daysLabel(r))}</span>} />
              <Row label="Estado" value={chip(stateChip(r.state), r.state)} />
              <Row label="Ámbito" value={appliedScopeText(r)} />
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">Utilización</h4>
              <Row label="Uso 1 día" value={chip(utilChip(util.last), util.last ?? "n/d")} />
              <Row label="Uso 7 días" value={chip(utilChip(util.d7), util.d7 ?? "n/d")} />
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">Recursos que la usan</h4>
              {loading ? (
                <p className="text-xs text-muted-foreground">Cargando recursos…</p>
              ) : consumers && consumers.length > 0 ? (
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="px-3 py-2">Recurso</th><th className="px-3 py-2">Grupo / Suscripción</th><th className="px-3 py-2 text-right">Horas (30d)</th>
                    </tr></thead>
                    <tbody>
                      {consumers.map((c, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-2">{c.resource_name}</td>
                          <td className="px-3 py-2">{c.resource_group ? <>{c.resource_group}<br /></> : null}<span className="text-xs text-muted-foreground">{c.subscription_name || c.subscription_id || ""}</span></td>
                          <td className="px-3 py-2 text-right tabular-nums">{c.used_hours ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>{source === "error" ? "No se pudo leer el consumo (posible restricción de permisos o de Consumption en CSP)." : "Sin consumo registrado en los últimos 30 días."}</p>
                  <p><span className="font-medium text-foreground">Ámbito de la reserva:</span> {appliedScopeText(r)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
