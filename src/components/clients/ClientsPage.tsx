import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/SearchInput";
import { Skeleton } from "@/components/ui/skeleton";
import ClientCard from "@/components/clients/ClientCard";
import ClientFormDialog from "@/components/clients/ClientFormDialog";
import ClientDangerDialog, { type DangerMode } from "@/components/clients/ClientDangerDialog";
import ClientLogoDialog from "@/components/clients/ClientLogoDialog";
import ClientCredentialsDialog from "@/components/clients/ClientCredentialsDialog";
import DataTablePagination from "@/components/DataTablePagination";
import { useClients } from "@/hooks/useClients";
import { usePagedRows } from "@/hooks/usePagedRows";
import { canEdit, getRole } from "@/lib/auth";
import type { ClientAdmin } from "@/types";

export default function ClientsPage({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const { clients, loading, error, reload } = useClients();
  const editable = canEdit();
  const isAdmin = getRole() === "admin";

  const [q, setQ] = useState("");
  // undefined = diálogo cerrado, null = crear, objeto = renombrar
  const [formClient, setFormClient] = useState<ClientAdmin | null | undefined>(undefined);
  const [logoClient, setLogoClient] = useState<ClientAdmin | null>(null);
  const [credClient, setCredClient] = useState<ClientAdmin | null>(null);
  const [danger, setDanger] = useState<{ mode: DangerMode; client: ClientAdmin } | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((c) => c.client_name.toLowerCase().includes(term));
  }, [clients, q]);

  const activeCount = useMemo(() => clients.filter((c) => c.is_active).length, [clients]);

  const { table, pageRows } = usePagedRows(filtered);

  function done(message: string) {
    toast.success(message);
    reload();
  }

  return (
    <AppShell
      title="Clientes"
      subtitle="Portafolio de clientes administrados. Gestiona nombre, logo y datos por cliente."
      active="clientes"
      onNavigate={onNavigate}
    >
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[66px] w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive py-6">{error}</p>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
          <p className="text-muted-foreground">Aún no hay clientes.</p>
          {editable && (
            <Button size="sm" onClick={() => setFormClient(null)}>
              <Plus className="w-4 h-4 mr-1" /> Nuevo cliente
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <span className="text-sm text-muted-foreground">
              {clients.length} {clients.length === 1 ? "cliente" : "clientes"} · {activeCount} {activeCount === 1 ? "activo" : "activos"}
            </span>
            <SearchInput
              className="ml-auto min-w-[200px] max-w-sm flex-1"
              placeholder="Buscar cliente…"
              value={q}
              onChange={setQ}
            />
            {editable && (
              <Button size="sm" onClick={() => setFormClient(null)}>
                <Plus className="w-4 h-4 mr-1" /> Nuevo cliente
              </Button>
            )}
          </div>

          {pageRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin clientes que coincidan.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {pageRows.map((client) => (
                <ClientCard
                  key={client.client_id}
                  client={client}
                  canEdit={editable}
                  isAdmin={isAdmin}
                  onRename={(c) => setFormClient(c)}
                  onLogo={(c) => setLogoClient(c)}
                  onCredentials={(c) => setCredClient(c)}
                  onPurge={(c) => setDanger({ mode: "purge", client: c })}
                  onDelete={(c) => setDanger({ mode: "delete", client: c })}
                />
              ))}
            </div>
          )}

          <DataTablePagination table={table} />
        </>
      )}

      <ClientFormDialog
        open={formClient !== undefined}
        client={formClient ?? null}
        onOpenChange={(o) => !o && setFormClient(undefined)}
        onSaved={() => done(formClient ? "Cliente renombrado correctamente." : "Cliente creado correctamente.")}
      />

      <ClientLogoDialog
        open={logoClient !== null}
        client={logoClient}
        onOpenChange={(o) => !o && setLogoClient(null)}
        onSaved={() => done("Logo actualizado correctamente.")}
      />

      <ClientCredentialsDialog
        open={credClient !== null}
        client={credClient}
        onOpenChange={(o) => !o && setCredClient(null)}
      />

      <ClientDangerDialog
        open={danger !== null}
        mode={danger?.mode ?? "purge"}
        client={danger?.client ?? null}
        onOpenChange={(o) => !o && setDanger(null)}
        onDone={() => done(danger?.mode === "delete" ? "Cliente eliminado correctamente." : "Datos del cliente purgados correctamente.")}
      />
    </AppShell>
  );
}
