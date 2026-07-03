import ClientCombobox from "@/components/costs/ClientCombobox";
import ClientLogo from "@/components/clients/ClientLogo";
import type { ClientSummary } from "@/types";

/**
 * Cabecera de cliente compartida por TODAS las páginas por-cliente: logo del cliente + selector.
 * Mantiene la estética consistente (antes solo la usaban WAF/Reportes/Reservas).
 */
export default function ClientHeader({ clients, clientId, onSelect, disabled }: {
  clients: ClientSummary[]; clientId: number | null; onSelect: (id: number) => void; disabled?: boolean;
}) {
  const active = clients.find((c) => c.client_id === clientId);
  return (
    <div className="flex items-center gap-3">
      {active && <ClientLogo clientId={active.client_id} name={active.client_name} hasLogo={active.has_logo ?? false} size={40} />}
      <ClientCombobox clients={clients} value={clientId} onChange={onSelect} disabled={disabled} />
    </div>
  );
}
