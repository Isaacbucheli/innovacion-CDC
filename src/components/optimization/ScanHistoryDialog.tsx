import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/costs";
import type { OptScan } from "@/types";

const STATUS_LABEL: Record<string, string> = { completed: "Completado", running: "En curso", failed: "Con error" };

function fmt(when: string): string {
  const d = new Date(when);
  return Number.isNaN(d.getTime()) ? when : d.toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });
}

export default function ScanHistoryDialog({ scans, open, onOpenChange }: {
  scans: OptScan[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Historial de barridos</DialogTitle></DialogHeader>
        {scans.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Aún no hay barridos para este cliente.</p>
        ) : (
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left font-medium py-2 px-2">Fecha</th>
                  <th className="text-left font-medium py-2 px-2">Estado</th>
                  <th className="text-right font-medium py-2 px-2">Subs</th>
                  <th className="text-right font-medium py-2 px-2">Hallazgos</th>
                  <th className="text-right font-medium py-2 px-2">Ahorro/mes</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((s) => (
                  <tr key={s.scan_id} className="border-b last:border-0">
                    <td className="py-2 px-2 whitespace-nowrap">{fmt(s.finished_at ?? s.started_at)}</td>
                    <td className="py-2 px-2">{STATUS_LABEL[s.status] ?? s.status}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{s.subscriptions_scanned}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{s.findings_count}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold text-[#5a7016] dark:text-[#a9c46a]">
                      {s.total_estimated_monthly_savings ? formatMoney(s.total_estimated_monthly_savings) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
