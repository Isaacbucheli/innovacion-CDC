import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import type { Alert } from "@/types";
import { createAlert, updateAlert } from "@/lib/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  alert_number: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().optional(),
  ),
  resource: z.string().nullish(),
  alert_type: z.string().nullish(),
  severity: z.string().nullish(),
  origin: z.string().nullish(),
  description: z.string().nullish(),
  detail: z.string().nullish(),
  action_group: z.string().nullish(),
  technical_requirement: z.string().nullish(),
  kql_code: z.string().nullish(),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export default function AlertFormDialog({ open, alert, onOpenChange, onSaved }: {
  open: boolean; alert: Alert | null; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema) });
  const [submitError, setSubmitError] = useState("");
  useEffect(() => { setSubmitError(""); reset((alert ?? { name: "" }) as FormInput); }, [alert, open, reset]);

  async function onSubmit(v: FormValues) {
    setSubmitError("");
    const payload = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val === "" ? null : val]));
    try {
      if (alert) await updateAlert(alert.alert_id, payload as Partial<Alert>);
      else await createAlert(payload as Partial<Alert>);
      onSaved(); onOpenChange(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Error al guardar");
    }
  }

  const field = (name: keyof FormInput, label: string, area = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {area ? <Textarea id={name} {...register(name)} rows={2} /> : <Input id={name} {...register(name)} />}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" busy={isSubmitting}>
        <DialogHeader><DialogTitle>{alert ? "Editar alerta" : "Nueva alerta"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="alert_number">N° de alerta</Label>
            <Input type="number" id="alert_number" {...register("alert_number")} />
          </div>
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
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
