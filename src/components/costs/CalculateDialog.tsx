import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { serviceIcon, serviceName } from "@/lib/costs";
import type { ServiceCatalogItem } from "@/types";

export default function CalculateDialog({
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
  onConfirm: (
    serviceKeys: string[],
    autoBuildScenarios: boolean,
    extras: { uptime: boolean; reservas: boolean },
  ) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [autoBuild, setAutoBuild] = useState(true);
  // Pasos lentos/opcionales (apagados por defecto): al marcarlos, el cálculo ADEMÁS espera el job
  // de encendido/apagado y/o cruza la cobertura de reservas con feedback. Ver notas en la UI.
  const [uptime, setUptime] = useState(false);
  const [reservas, setReservas] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(services.map((s) => s.service_key));
      setUptime(false);
      setReservas(false);
    }
  }, [open, services]);

  const toggle = (key: string) =>
    setSelected((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calcular costos</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Seleccione servicios a calcular</span>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(services.map((s) => s.service_key))}>
              Todos
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected([])}>
              Limpiar
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 my-2">
          {services.map((s) => (
            <label
              key={s.service_key}
              className="flex items-center gap-2 text-sm cursor-pointer rounded-md border p-2 hover:bg-secondary"
            >
              <input type="checkbox" checked={selected.includes(s.service_key)} onChange={() => toggle(s.service_key)} />
              <img src={serviceIcon(s.service_key)} alt="" aria-hidden className="w-4 h-4" />
              <span className="truncate">{serviceName(s.service_key)}</span>
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={autoBuild} onChange={(e) => setAutoBuild(e.target.checked)} />
          Recalcular escenarios con los costos
        </label>

        {/* Pasos opcionales más lentos (apagados por defecto). */}
        <div className="mt-1 space-y-2 rounded-md border bg-muted/30 p-2">
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={uptime} onChange={(e) => setUptime(e.target.checked)} />
            <span>
              Calcular encendido/apagado (uptime)
              <span className="block text-xs text-muted-foreground">
                Usa el Activity Log del mes anterior. Tarda unos minutos.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={reservas} onChange={(e) => setReservas(e.target.checked)} />
            <span>
              Actualizar cobertura de reservas (RI)
              <span className="block text-xs text-muted-foreground">
                Cruza las reservas activas contra los recursos. Requiere permiso de lectura de reservas.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={busy || selected.length === 0}
            onClick={() => onConfirm(selected, autoBuild, { uptime, reservas })}
          >
            {busy ? "Calculando…" : `Calcular (${selected.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
