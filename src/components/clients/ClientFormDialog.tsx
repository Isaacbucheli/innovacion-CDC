import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import type { ClientAdmin } from "@/types";
import { createClient, renameClient } from "@/lib/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const schema = z.object({
  client_name: z.string().trim().min(1, "El nombre es obligatorio"),
});
type FormValues = z.infer<typeof schema>;

export default function ClientFormDialog({
  open,
  client,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  // null = crear nuevo; objeto = renombrar
  client: ClientAdmin | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setSubmitError("");
    reset({ client_name: client?.client_name ?? "" });
  }, [client, open, reset]);

  async function onSubmit(v: FormValues) {
    setSubmitError("");
    try {
      if (client) await renameClient(client.client_id, v.client_name);
      else await createClient(v.client_name);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Error al guardar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" busy={isSubmitting}>
        <DialogHeader>
          <DialogTitle>{client ? "Renombrar cliente" : "Nuevo cliente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="client_name">Nombre del cliente</Label>
            <Input id="client_name" autoFocus {...register("client_name")} />
            {errors.client_name && <p className="text-sm text-destructive">{errors.client_name.message}</p>}
          </div>
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
