import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import type { Alert } from "@/types";
import { createAlert, updateAlert } from "@/lib/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  resource: z.string().optional(),
  alert_type: z.string().optional(),
  severity: z.string().optional(),
  origin: z.string().optional(),
  description: z.string().optional(),
  detail: z.string().optional(),
  action_group: z.string().optional(),
  technical_requirement: z.string().optional(),
  kql_code: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function AlertFormDialog({ open, alert, onOpenChange, onSaved }: {
  open: boolean; alert: Alert | null; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  useEffect(() => { reset((alert ?? { name: "" }) as FormValues); }, [alert, open, reset]);

  async function onSubmit(v: FormValues) {
    const payload = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val === "" ? null : val]));
    if (alert) await updateAlert(alert.alert_id, payload as Partial<Alert>);
    else await createAlert(payload as Partial<Alert>);
    onSaved(); onOpenChange(false);
  }

  const field = (name: keyof FormValues, label: string, area = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {area ? <Textarea id={name} {...register(name)} rows={2} /> : <Input id={name} {...register(name)} />}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{alert ? "Editar alerta" : "Nueva alerta"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {field("name", "Nombre")}
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          <div className="grid grid-cols-2 gap-3">
            {field("resource", "Recurso")}{field("alert_type", "Tipo")}
            {field("severity", "Severidad")}{field("origin", "Origen")}
          </div>
          {field("description", "Descripción", true)}
          {field("detail", "Detalle", true)}
          {field("action_group", "Action Group")}
          {field("technical_requirement", "Requisito técnico", true)}
          {field("kql_code", "Código KQL", true)}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
