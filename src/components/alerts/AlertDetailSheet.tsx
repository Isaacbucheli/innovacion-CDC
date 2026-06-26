import type { Alert } from "@/types";
import { SEVERITY_META, severityKey } from "@/lib/severity";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import CodeBlock from "@/components/CodeBlock";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-primary mb-1">{label}</div>
      <div className="text-sm whitespace-pre-wrap leading-relaxed">{value}</div>
    </div>
  );
}

export default function AlertDetailSheet({ alert, open, onOpenChange }: {
  alert: Alert | null; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const meta = alert ? SEVERITY_META[severityKey(alert.severity)] : null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{alert?.name}</SheetTitle></SheetHeader>
        {alert && (
          <div className="space-y-4 mt-4">
            <div className="flex gap-2 flex-wrap text-xs">
              <span className={`px-2.5 py-0.5 rounded-md ${meta!.badge}`}>{meta!.label}</span>
              {alert.resource && <span className="px-2 py-0.5 rounded-full bg-secondary">{alert.resource}</span>}
              {alert.alert_type && <span className="px-2 py-0.5 rounded-full bg-secondary">{alert.alert_type}</span>}
              {alert.origin && <span className="px-2 py-0.5 rounded-full bg-secondary">{alert.origin}</span>}
            </div>
            <Field label="Descripción" value={alert.description} />
            <Field label="Detalle" value={alert.detail} />
            <Field label="Action Group" value={alert.action_group} />
            <Field label="Requisito técnico" value={alert.technical_requirement} />
            {alert.kql_code && (<div><div className="text-xs font-medium uppercase tracking-wide text-primary mb-1">Código KQL</div><CodeBlock code={alert.kql_code} /></div>)}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
