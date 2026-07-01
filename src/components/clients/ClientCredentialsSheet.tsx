import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ClientLogo from "@/components/clients/ClientLogo";
import CredentialsManager from "@/components/credentials/CredentialsManager";
import type { ClientAdmin } from "@/types";

/**
 * Detalle de credenciales + suscripciones de un cliente, en un panel lateral.
 * Se abre desde el menú de acciones de la fila del cliente (Clientes).
 */
export default function ClientCredentialsSheet({ client, open, onOpenChange }: {
  client: ClientAdmin | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const contact = client ? [client.tax_id, client.contact_name, client.contact_email].filter(Boolean).join(" · ") : "";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3 pr-8">
            {client && <ClientLogo clientId={client.client_id} name={client.client_name} hasLogo={client.has_logo} size={40} />}
            <div className="min-w-0">
              <SheetTitle className="truncate">{client?.client_name ?? ""}</SheetTitle>
              <p className="text-xs text-muted-foreground truncate">
                Credenciales Azure y suscripciones{contact ? ` · ${contact}` : ""}
              </p>
            </div>
          </div>
        </SheetHeader>
        <div className="mt-6">
          {client && <CredentialsManager key={client.client_id} clientId={client.client_id} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
