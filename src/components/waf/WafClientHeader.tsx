import ClientCombobox from "@/components/costs/ClientCombobox";
import ClientLogo from "@/components/clients/ClientLogo";
import type { ClientAdmin } from "@/types";

export default function WafClientHeader({ clients, clientId, onSelect, disabled }: {
  clients: ClientAdmin[]; clientId: number | null; onSelect: (id: number) => void; disabled?: boolean;
}) {
  const active = clients.find((c) => c.client_id === clientId);
  return (
    <div className="flex items-center gap-3">
      {active && <ClientLogo clientId={active.client_id} name={active.client_name} hasLogo={active.has_logo} size={32} />}
      <ClientCombobox clients={clients} value={clientId} onChange={onSelect} disabled={disabled} />
    </div>
  );
}
