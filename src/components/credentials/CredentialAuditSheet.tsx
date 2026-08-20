import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import SimpleTable from "@/components/reports/SimpleTable";
import { getCredentialAudit } from "@/lib/api";
import type { Credential, CredentialAudit } from "@/types";

// Historial de auditoría de una credencial (solo lectura).
export default function CredentialAuditSheet({ credential, open, onOpenChange }: {
  credential: Credential | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [rows, setRows] = useState<CredentialAudit[] | null>(null);

  useEffect(() => {
    if (!open || !credential) return;
    setRows(null);
    getCredentialAudit(credential.credential_id, 50)
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch(() => setRows([]));
  }, [open, credential]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[520px] max-w-full sm:max-w-[520px] overflow-y-auto">
        <SheetHeader><SheetTitle>Historial{credential ? ` · ${credential.credential_name}` : ""}</SheetTitle></SheetHeader>
        <div className="mt-4">
          {rows === null ? (
            <p className="text-sm text-muted-foreground">Cargando historial…</p>
          ) : (
            <SimpleTable
              empty="Sin eventos registrados."
              cols={[
                { key: "action", label: "Acción" },
                { key: "actor", label: "Actor", render: (r: CredentialAudit) => r.actor || "" },
                { key: "details", label: "Detalle", render: (r: CredentialAudit) => r.details || "" },
                { key: "occurred_at", label: "Fecha", render: (r: CredentialAudit) => (r.occurred_at || "").slice(0, 19) },
              ]}
              rows={rows}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
