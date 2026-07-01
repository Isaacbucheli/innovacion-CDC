import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ClientLogo from "@/components/clients/ClientLogo";
import CredentialsManager from "@/components/credentials/CredentialsManager";
import type { ClientAdmin } from "@/types";

/**
 * Detalle de credenciales + suscripciones de un cliente, en un diálogo centrado.
 * Se abre desde el menú de acciones de la fila del cliente (Clientes).
 */
export default function ClientCredentialsDialog({ client, open, onOpenChange }: {
  client: ClientAdmin | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const contact = client ? [client.tax_id, client.contact_name, client.contact_email].filter(Boolean).join(" · ") : "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 pr-8">
            {client && <ClientLogo clientId={client.client_id} name={client.client_name} hasLogo={client.has_logo} size={40} />}
            <div className="min-w-0">
              <DialogTitle className="truncate">{client?.client_name ?? ""}</DialogTitle>
              <p className="text-xs text-muted-foreground truncate">
                Credenciales Azure y suscripciones{contact ? ` · ${contact}` : ""}
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="mt-2">
          {client && <CredentialsManager key={client.client_id} clientId={client.client_id} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
