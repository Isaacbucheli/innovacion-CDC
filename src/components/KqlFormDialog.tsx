import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import type { KqlQuery } from "@/types";
import { createKql, updateKql } from "@/lib/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().nullish(),
  kql_query: z.string().nullish(),
});
type FormValues = z.infer<typeof schema>;

export default function KqlFormDialog({ open, item, onOpenChange, onSaved }: {
  open: boolean; item: KqlQuery | null; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const [submitError, setSubmitError] = useState("");
  useEffect(() => { setSubmitError(""); reset((item ?? { name: "" }) as FormValues); }, [item, open, reset]);
  async function onSubmit(v: FormValues) {
    setSubmitError("");
    const payload = { name: v.name, description: v.description || null, kql_query: v.kql_query || null };
    try {
      if (item) await updateKql(item.kql_id, payload); else await createKql(payload);
      onSaved(); onOpenChange(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Error al guardar");
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" busy={isSubmitting}>
        <DialogHeader><DialogTitle>{item ? "Editar consulta KQL" : "Nueva consulta KQL"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="kname">Nombre</Label><Input id="kname" {...register("name")} /></div>
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          <div className="space-y-1.5"><Label htmlFor="kdesc">Descripción</Label><Textarea id="kdesc" rows={2} {...register("description")} /></div>
          <div className="space-y-1.5"><Label htmlFor="kq">Consulta KQL</Label><Textarea id="kq" rows={4} {...register("kql_query")} /></div>
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
