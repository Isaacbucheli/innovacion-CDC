import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ReportLine from "@/components/reports/ReportLine";
import { REPORT_COLORS } from "@/lib/report";
import type { ReportVmInventory, ReportPerfVm } from "@/types";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value ?? ""}</div>
    </div>
  );
}

export default function VmDetailDialog({ vm, perf, open, onOpenChange }: {
  vm: ReportVmInventory | null;
  perf: ReportPerfVm | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const daily = perf?.daily;
  const lineData = (daily?.days ?? []).map((d, i) => ({
    x: d.slice(5), CPU: daily?.cpu_avg?.[i] ?? 0, RAM: daily?.ram_avg?.[i] ?? 0,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{vm?.name ?? "Detalle de VM"}</DialogTitle></DialogHeader>
        {vm && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Estado" value={vm.status} />
              <Field label="IP privada" value={vm.ip} />
              <Field label="Sistema operativo" value={vm.os} />
              <Field label="Suscripción" value={vm.subscription} />
              <Field label="Región" value={vm.location} />
              <Field label="Grupo de recursos" value={vm.resource_group} />
              <Field label="Plantilla (SKU)" value={vm.size} />
              <Field label="vCPU" value={vm.vcpu} />
              <Field label="RAM" value={`${vm.ram_gb} GB`} />
              <Field label="Discos" value={vm.disks} />
              <Field label="Backup" value={vm.has_backup ? "Sí" : "No"} />
            </div>
            {perf && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="CPU prom" value={`${Math.round(perf.cpu_avg)}%`} />
                <Field label="CPU máx" value={`${Math.round(perf.cpu_max)}%`} />
                <Field label="RAM prom" value={`${Math.round(perf.ram_avg)}%`} />
                <Field label="RAM máx" value={`${Math.round(perf.ram_max)}%`} />
              </div>
            )}
            {lineData.length > 0 ? (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Performance diaria</div>
                <ReportLine
                  data={lineData}
                  series={[
                    { key: "CPU", name: "CPU prom", color: REPORT_COLORS.greenDark },
                    { key: "RAM", name: "RAM prom", color: REPORT_COLORS.gold },
                  ]}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sin métricas diarias para esta VM.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
