import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { PendienteCliente, PendienteItem } from "@/types";
import { createPendiente, updatePendiente } from "@/lib/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ESTADO_LABEL, TIPO_LABEL } from "@/lib/pendientes";

// Select nativo con el estilo del app (mismo patrón que AssignmentFormDialog).
const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const schema = z.object({
  cliente_num: z.preprocess((v) => Number(v), z.number().int().positive("Seleccione el cliente")),
  descripcion: z.string().trim().min(1, "Escriba la descripción"),
  titulo: z.string().nullish(),
  tipo: z.string(),
  prioridad: z.string(),
  estado: z.string(),
  responsable: z.string().nullish(),
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
 * Alta y edición. En la edición se reenvía el `actualizado` que traía la fila: si la SWA del tablero
 * (o otra pestaña) tocó ese pendiente antes, el backend responde 409 y acá se muestra el mensaje en
 * vez de sobrescribir a ciegas.
 */
export default function PendienteFormDialog({
  area, open, pendiente, clientes, onOpenChange, onSaved,
}: {
  area: string;
  open: boolean;
  pendiente: PendienteItem | null; // null = crear
  clientes: PendienteCliente[];
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema) });
  const [submitError, setSubmitError] = useState("");

  useEffect(() => { setSubmitError(""); reset(defaults(pendiente, clientes)); }, [pendiente, clientes, open, reset]);

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
      setSubmitError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pendiente ? "Editar pendiente" : "Nuevo pendiente"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label htmlFor="pend-cliente">Cliente</Label>
            <select id="pend-cliente" className={selectClass} {...register("cliente_num")}>
              {clientes.map((c) => (
                <option key={c.num} value={c.num}>{c.cliente}</option>
              ))}
            </select>
            {errors.cliente_num && <p className="text-xs text-destructive mt-1">{errors.cliente_num.message}</p>}
          </div>

          <div>
            <Label htmlFor="pend-desc">Descripción</Label>
            <Textarea id="pend-desc" rows={4} {...register("descripcion")} />
            {errors.descripcion && <p className="text-xs text-destructive mt-1">{errors.descripcion.message}</p>}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="pend-tipo">Tipo</Label>
              <select id="pend-tipo" className={selectClass} {...register("tipo")}>
                {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="pend-prio">Prioridad</Label>
              <select id="pend-prio" className={selectClass} {...register("prioridad")}>
                {["ALTA", "MEDIA", "BAJA"].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="pend-estado">Estado</Label>
              <select id="pend-estado" className={selectClass} {...register("estado")}>
                {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="pend-resp">Responsable</Label>
            <Input id="pend-resp" {...register("responsable")} />
          </div>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
