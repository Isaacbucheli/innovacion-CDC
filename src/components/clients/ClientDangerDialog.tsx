import { useEffect, useState } from "react";
import type { ClientAdmin } from "@/types";
import { deleteClient, purgeClient } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type DangerMode = "purge" | "delete";

/**
 * Acción destructiva (purgar datos o eliminar cliente). Requiere escribir el nombre exacto:
 * el botón de confirmar queda deshabilitado hasta que coincida con client_name.
 */
export default function ClientDangerDialog({
  open,
  mode,
  client,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  mode: DangerMode;
  client: ClientAdmin | null;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setValue("");
    setSubmitError("");
    setBusy(false);
  }, [client, open]);

  if (!client) return null;

  const matches = value === client.client_name;
  const isDelete = mode === "delete";
  const title = isDelete ? "Eliminar cliente" : "Purgar datos del cliente";

  async function onConfirm() {
    if (!client || !matches) return;
    setBusy(true);
    setSubmitError("");
    try {
      if (isDelete) await deleteClient(client.client_id, value);
      else await purgeClient(client.client_id, value);
      onDone();
      onOpenChange(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Error en la operación");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isDelete
              ? "Se eliminará el cliente y todos sus datos asociados en cascada. Esta acción no se puede deshacer."
              : "Se eliminarán los datos del cliente (inventario, evaluaciones, costos), pero el cliente se conserva. Esta acción no se puede deshacer."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="confirm_client_name">
              Escribe <span className="font-semibold text-foreground">{client.client_name}</span> para confirmar
            </Label>
            <Input
              id="confirm_client_name"
              autoFocus
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={isDelete ? "destructive" : "default"}
            className={isDelete ? "" : "bg-amber-600 hover:bg-amber-600/90 text-white"}
            disabled={!matches || busy}
            onClick={onConfirm}
          >
            {isDelete ? "Eliminar cliente" : "Purgar datos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
