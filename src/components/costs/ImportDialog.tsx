import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { serviceIcon, serviceName } from "@/lib/costs";
import type { ServiceCatalogItem } from "@/types";

export default function ImportDialog({
  open,
  services,
  busy,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  services: ServiceCatalogItem[];
  busy?: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (replaceExisting: boolean) => void;
}) {
  const [replace, setReplace] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importar inventario de Azure</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Se importarán los recursos de todos los servicios activos del cliente desde Azure.
        </p>
        <div className="flex flex-wrap gap-1.5 my-1">
          {services.map((s) => (
            <span key={s.service_key} className="inline-flex items-center gap-1 text-xs rounded-md border px-2 py-1">
              <img src={serviceIcon(s.service_key)} alt="" aria-hidden className="w-3.5 h-3.5" />
              {serviceName(s.service_key)}
            </span>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          Reemplazar inventario existente (en vez de actualizar)
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => onConfirm(replace)} disabled={busy}>
            {busy ? "Importando…" : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
