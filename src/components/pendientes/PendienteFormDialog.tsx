import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { PendienteCliente, PendienteItem, PendienteNota } from "@/types";
import {
  addPendienteNota, createPendiente, deletePendienteNota, getPendiente, updatePendiente,
} from "@/lib/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ResponsableCombobox from "@/components/pendientes/ResponsableCombobox";
import { ESTADO_LABEL, TIPO_LABEL } from "@/lib/pendientes";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

// Select nativo con el estilo del app (mismo patrón que AssignmentFormDialog).
const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70";

const schema = z.object({
  cliente_num: z.preprocess((v) => Number(v), z.number().int().positive("Seleccione el cliente")),
  descripcion: z.string().trim().min(1, "Escriba la descripción"),
  titulo: z.string().nullish(),
  tipo: z.string(),
  prioridad: z.string(),
  estado: z.string(),
  // La columna del tablero es nvarchar(300); pasarse sería un error de truncamiento del SQL.
  responsable: z.string().trim().max(300, "El nombre no puede pasar de 300 caracteres").nullish(),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

function defaults(p: PendienteItem | null, clientes: PendienteCliente[]): FormInput {
  if (!p) {
    return {
      cliente_num: clientes[0]?.num ?? 0,
      descripcion: "",
      titulo: "",
      tipo: "PENDIENTE",
      prioridad: "MEDIA",
      estado: "ABIERTO",
      responsable: "",
    };
  }
  return {
    cliente_num: p.cliente_num,
    descripcion: p.descripcion ?? "",
    titulo: p.titulo ?? "",
    tipo: p.tipo ?? "PENDIENTE",
    prioridad: p.prioridad ?? "MEDIA",
    estado: p.estado ?? "ABIERTO",
    responsable: p.responsable ?? "",
  };
}

/**
 * Alta, edición y bitácora de un pendiente en una sola pantalla: los datos y el historial de
 * novedades se trabajan desde el mismo botón (pedido del usuario, 2026-08-21), sin panel de detalle
 * aparte.
 *
 * Los campos se guardan al pulsar Guardar; las notas viajan al momento porque son su propio
 * endpoint. Después de tocar una nota se relee SOLO este pendiente (`getPendiente`): así el historial
 * queda al día sin recargar el tablero, que reemplazaría el formulario y se llevaría lo que todavía
 * no se guardó.
 *
 * En la edición se reenvía el `actualizado` que traía la fila: si la SWA del tablero (o otra pestaña)
 * tocó ese pendiente antes, el backend responde 409 y acá se muestra el mensaje en vez de
 * sobrescribir a ciegas.
 */
export default function PendienteFormDialog({
  area, open, pendiente, clientes, responsables, canEdit, onOpenChange, onSaved,
}: {
  area: string;
  open: boolean;
  pendiente: PendienteItem | null; // null = crear
  clientes: PendienteCliente[];
  /** Nombres que ya usa el tablero: la lista del selector de responsable. */
  responsables: string[];
  /** Sin permiso de edición el diálogo es de solo lectura: se consulta, no se escribe. */
  canEdit: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema) });
  const [submitError, setSubmitError] = useState("");
  const [notas, setNotas] = useState<PendienteNota[]>([]);
  const [nota, setNota] = useState("");
  const [guardandoNota, setGuardandoNota] = useState(false);
  // Las notas ya quedaron guardadas en el servidor; el tablero se recarga al salir para que la
  // columna "Últ. nota" no se quede vieja.
  const [notasTocadas, setNotasTocadas] = useState(false);

  useEffect(() => {
    setSubmitError("");
    setNota("");
    setNotasTocadas(false);
    setNotas(pendiente?.historial ?? []);
    reset(defaults(pendiente, clientes));
  }, [pendiente, clientes, open, reset]);

  // El historial va por `orden` (orden de inserción, como en el tablero original): las fechas pueden
  // ir "hacia atrás" y eso es lo esperado, porque cada nota lleva la fecha del hecho.
  const ordenadas = [...notas].sort((a, b) => a.orden - b.orden || a.hist_id - b.hist_id);
  const cliente = clientes.find((c) => c.num === Number(watch("cliente_num")));
  const metaCliente = [
    cliente?.servicio,
    cliente?.coordinador ? `Coordinador ${cliente.coordinador}` : "",
    cliente?.consultor ? `Consultor ${cliente.consultor}` : "",
  ].filter(Boolean);

  function cerrar() {
    if (notasTocadas) onSaved();
    onOpenChange(false);
  }

  async function refrescarNotas() {
    if (!pendiente) return;
    try {
      const fresco = await getPendiente(area, pendiente.id);
      setNotas(fresco.historial ?? []);
    } catch (e) { toast.error(msg(e)); }
  }

  async function agregarNota() {
    if (!pendiente || !nota.trim()) return;
    setGuardandoNota(true);
    try {
      await addPendienteNota(area, pendiente.id, nota.trim());
      setNota("");
      setNotasTocadas(true);
      await refrescarNotas();
      toast.success("Nota agregada.");
    } catch (e) { toast.error(msg(e)); }
    finally { setGuardandoNota(false); }
  }

  async function borrarNota(histId: number) {
    if (!pendiente) return;
    try {
      await deletePendienteNota(area, pendiente.id, histId);
      setNotasTocadas(true);
      await refrescarNotas();
      toast.success("Nota eliminada.");
    } catch (e) { toast.error(msg(e)); }
  }

  async function onSubmit(v: FormValues) {
    setSubmitError("");
    const body = {
      cliente_num: v.cliente_num,
      descripcion: v.descripcion,
      titulo: v.titulo || null,
      tipo: v.tipo,
      prioridad: v.prioridad,
      estado: v.estado,
      responsable: v.responsable || null,
    };
    try {
      if (pendiente) {
        await updatePendiente(area, pendiente.id, { ...body, actualizado: pendiente.actualizado });
      } else {
        await createPendiente(area, body);
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setSubmitError(msg(e));
    }
  }

  const titulo = !canEdit ? "Pendiente" : pendiente ? "Editar pendiente" : "Nuevo pendiente";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) cerrar(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        busy={isSubmitting || guardandoNota}>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label htmlFor="pend-cliente">Cliente</Label>
            <select id="pend-cliente" className={selectClass} disabled={!canEdit} {...register("cliente_num")}>
              {clientes.map((c) => (
                <option key={c.num} value={c.num}>{c.cliente}</option>
              ))}
            </select>
            {metaCliente.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{metaCliente.join(" · ")}</p>
            )}
            {errors.cliente_num && <p className="text-xs text-destructive mt-1">{errors.cliente_num.message}</p>}
          </div>

          <div>
            <Label htmlFor="pend-desc">Descripción</Label>
            <Textarea id="pend-desc" rows={4} disabled={!canEdit} {...register("descripcion")} />
            {errors.descripcion && <p className="text-xs text-destructive mt-1">{errors.descripcion.message}</p>}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="pend-tipo">Tipo</Label>
              <select id="pend-tipo" className={selectClass} disabled={!canEdit} {...register("tipo")}>
                {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="pend-prio">Prioridad</Label>
              <select id="pend-prio" className={selectClass} disabled={!canEdit} {...register("prioridad")}>
                {["ALTA", "MEDIA", "BAJA"].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="pend-estado">Estado</Label>
              <select id="pend-estado" className={selectClass} disabled={!canEdit} {...register("estado")}>
                {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="pend-resp">Responsable</Label>
            <ResponsableCombobox
              id="pend-resp"
              value={watch("responsable") ?? ""}
              options={responsables}
              disabled={!canEdit}
              onChange={(v) => setValue("responsable", v, { shouldDirty: true })} />
            {errors.responsable && <p className="text-xs text-destructive mt-1">{errors.responsable.message}</p>}
          </div>

          {/* La bitácora existe desde que existe el pendiente: en el alta no hay de qué colgarla. */}
          {pendiente && (
            <div className="rounded-lg border bg-secondary/20 p-3 space-y-3">
              <div className="text-sm font-semibold">
                Historial {ordenadas.length > 0 && (
                  <span className="text-muted-foreground">({ordenadas.length})</span>
                )}
              </div>

              {ordenadas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay notas.</p>
              ) : (
                <ol className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {ordenadas.map((n) => (
                    <li key={n.hist_id} className="border-l-2 border-border pl-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs text-muted-foreground">
                          {n.fecha ?? "sin fecha"}
                          {n.autor ? ` · ${n.autor}` : ""}
                        </div>
                        {canEdit && (
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                            aria-label="Eliminar nota" onClick={() => borrarNota(n.hist_id)}>
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
                  <Textarea value={nota} onChange={(e) => setNota(e.target.value)}
                    placeholder="Nueva nota…" aria-label="Nueva nota" rows={3} />
                  {/* type="button": está dentro del form y sin esto Agregar nota lo enviaría. */}
                  <Button type="button" size="sm" onClick={agregarNota}
                    disabled={guardandoNota || !nota.trim()}>
                    Agregar nota
                  </Button>
                </div>
              )}
            </div>
          )}

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrar}>
              {canEdit ? "Cancelar" : "Cerrar"}
            </Button>
            {canEdit && <Button type="submit" disabled={isSubmitting}>Guardar</Button>}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
