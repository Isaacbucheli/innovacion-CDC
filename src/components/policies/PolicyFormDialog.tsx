import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import type { Policy } from "@/types";
import { createPolicy, updatePolicy } from "@/lib/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(300, "Máximo 300 caracteres"),
  policy_number: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().optional(),
  ),
  category: z.string().nullish(),
  policy_type: z.string().nullish(),
  recommended_effect: z.string().nullish(),
  mode: z.string().nullish(),
  key_parameters: z.string().nullish(),
  description: z.string().nullish(),
  objective: z.string().nullish(),
  recommended_scope: z.string().nullish(),
  rollout: z.string().nullish(),
  risk: z.string().nullish(),
  example_parameters: z.string().nullish(),
  azure_cli: z.string().nullish(),
  powershell: z.string().nullish(),
  script_notes: z.string().nullish(),
  official_source: z.string().nullish(),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export default function PolicyFormDialog({ open, policy, onOpenChange, onSaved }: {
  open: boolean; policy: Policy | null; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema) });
  const [submitError, setSubmitError] = useState("");
  useEffect(() => { setSubmitError(""); reset((policy ?? { name: "" }) as FormInput); }, [policy, open, reset]);

  async function onSubmit(v: FormValues) {
    setSubmitError("");
    const payload = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val === "" ? null : val]));
    try {
      if (policy) await updatePolicy(policy.policy_id, payload as Partial<Policy>);
      else await createPolicy(payload as Partial<Policy>);
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
        <DialogHeader><DialogTitle>{policy ? "Editar política" : "Nueva política"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="policy_number">N° de política</Label>
            <Input type="number" id="policy_number" {...register("policy_number")} />
          </div>
          {field("name", "Nombre")}
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          <div className="grid grid-cols-2 gap-3">
            {field("category", "Categoría")}{field("policy_type", "Tipo")}
            {field("recommended_effect", "Efecto recomendado")}{field("mode", "Modo")}
            {field("key_parameters", "Parámetros clave")}{field("recommended_scope", "Scope recomendado")}
          </div>
          {field("description", "Descripción", true)}
          {field("objective", "Objetivo / beneficio", true)}
          {field("rollout", "Rollout recomendado", true)}
          {field("risk", "Riesgo / impacto", true)}
          {field("example_parameters", "Parámetros ejemplo (JSON)", true)}
          {field("azure_cli", "Azure CLI", true)}
          {field("powershell", "PowerShell", true)}
          {field("script_notes", "Notas de script", true)}
          {field("official_source", "Fuente oficial (URL)")}
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
