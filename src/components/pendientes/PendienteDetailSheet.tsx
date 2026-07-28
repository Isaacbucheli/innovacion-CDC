import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { PendienteCliente, PendienteItem } from "@/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addPendienteNota, deletePendienteNota } from "@/lib/api";
import { estadoLabel, tipoLabel, tituloPrincipal } from "@/lib/pendientes";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-primary mb-1">{label}</div>
      <div className="text-sm whitespace-pre-line leading-relaxed">{value}</div>
    </div>
  );
}

/**
 * Detalle de un pendiente con su bitácora. El timeline va por `orden` (orden de inserción, como en
 * el tablero original): las fechas pueden ir "hacia atrás" y eso es lo esperado, porque cada nota
 * lleva la fecha del hecho, no la de cuando se escribió.
 */
export default function PendienteDetailSheet({
  area,
  pendiente,
  clientes,
  canEdit,
  open,
  onOpenChange,
  onChanged,
}: {
  area: string;
  pendiente: PendienteItem | null;
  clientes: PendienteCliente[];
  canEdit: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
}) {
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);

  if (!pendiente) return null;

  const cliente = clientes.find((c) => c.num === pendiente.cliente_num);
  const notas = [...pendiente.historial].sort((a, b) => a.orden - b.orden || a.hist_id - b.hist_id);

  async function agregar() {
    if (!nota.trim()) return;
    setSaving(true);
    try {
      await addPendienteNota(area, pendiente!.id, nota.trim());
      setNota("");
      toast.success("Nota agregada.");
      onChanged();
    } catch (e) { toast.error(msg(e)); }
    finally { setSaving(false); }
  }

  async function borrar(histId: number) {
    try {
      await deletePendienteNota(area, pendiente!.id, histId);
      toast.success("Nota eliminada.");
      onChanged();
    } catch (e) { toast.error(msg(e)); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="pr-6 text-left">
            {cliente?.cliente ?? `Cliente desconocido (${pendiente.cliente_num})`}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          <div className="rounded-lg border bg-background p-3 space-y-3">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{tipoLabel(pendiente.tipo)}</span>
              <span>·</span>
              <span>{estadoLabel(pendiente.estado)}</span>
              <span>·</span>
              <span>Prioridad {pendiente.prioridad ?? "—"}</span>
              {pendiente.fecha_creacion && (<><span>·</span><span>Creado {pendiente.fecha_creacion}</span></>)}
            </div>
            <div className="text-sm whitespace-pre-line leading-relaxed">{tituloPrincipal(pendiente)}</div>
            <Field label="Responsable" value={pendiente.responsable} />
            <Field label="Servicio" value={cliente?.servicio} />
            <Field label="Coordinador" value={cliente?.coordinador} />
            <Field label="Consultor" value={cliente?.consultor} />
          </div>

          <div className="rounded-lg border bg-background p-3 space-y-3">
            <div className="text-sm font-semibold">
              Bitácora {notas.length > 0 && <span className="text-muted-foreground">({notas.length})</span>}
            </div>

            {notas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay notas.</p>
            ) : (
              <ol className="space-y-3">
                {notas.map((n) => (
                  <li key={n.hist_id} className="border-l-2 border-border pl-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        {n.fecha ?? "sin fecha"}
                        {n.autor ? ` · ${n.autor}` : ""}
                      </div>
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                          aria-label="Eliminar nota" onClick={() => borrar(n.hist_id)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="text-sm whitespace-pre-line leading-relaxed">{n.nota}</div>
                  </li>
                ))}
              </ol>
            )}

            {canEdit && (
              <div className="space-y-2 pt-1">
                <Textarea
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Nueva nota…"
                  aria-label="Nueva nota"
                  rows={3}
                />
                <Button size="sm" onClick={agregar} disabled={saving || !nota.trim()}>
                  Agregar nota
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
