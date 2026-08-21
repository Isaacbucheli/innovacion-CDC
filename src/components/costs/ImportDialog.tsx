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
  // Arranca marcada. Antes venía desmarcada y su etiqueta ofrecía "actualizar", un modo que el
  // backend nunca implementó: importar de nuevo sin reemplazar APENDEABA, así que cada recurso
  // quedaba duplicado y con él cada conteo y cada monto del análisis. Pasó en dos análisis reales.
  // Desde 2026-08-21 el backend además rechaza esa combinación, pero el default seguro va acá.
  const [replace, setReplace] = useState(true);

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
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            Reemplazar el inventario existente
          </label>
          <p className="text-xs text-muted-foreground pl-6">
            {replace
              ? "Se borra el inventario que tenga el análisis y se vuelve a importar desde Azure."
              : "Solo importa si el análisis todavía no tiene esos servicios. Si ya los tiene, la importación se rechaza."}
          </p>
        </div>
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
