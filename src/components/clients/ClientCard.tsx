import { Eraser, Image, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { ClientAdmin } from "@/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ClientLogo from "@/components/clients/ClientLogo";

/** Fila de cliente (vista lista): avatar + nombre + estado + menú de acciones. */
export default function ClientCard({
  client,
  canEdit,
  isAdmin,
  onRename,
  onLogo,
  onPurge,
  onDelete,
}: {
  client: ClientAdmin;
  canEdit: boolean;
  isAdmin: boolean;
  onRename: (c: ClientAdmin) => void;
  onLogo: (c: ClientAdmin) => void;
  onPurge: (c: ClientAdmin) => void;
  onDelete: (c: ClientAdmin) => void;
}) {
  // El menú solo aparece si hay alguna acción permitida: admin tiene todas; consultor solo "Cambiar logo".
  const showMenu = isAdmin || canEdit;

  return (
    <div className="flex items-center gap-3 bg-background border rounded-xl px-3 py-2.5 hover:border-primary/40 transition-colors">
      <ClientLogo clientId={client.client_id} name={client.client_name} hasLogo={!!client.logo_blob_name} size={44} />

      <span className="text-sm font-medium truncate flex-1 min-w-0" title={client.client_name}>
        {client.client_name}
      </span>

      {client.is_active ? (
        <span
          className="text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: "#EAF3DE", color: "#3B6D11" }}
        >
          Activo
        </span>
      ) : (
        <span className="text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap bg-secondary text-muted-foreground">
          Inactivo
        </span>
      )}

      {showMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label={`Acciones para ${client.client_name}`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isAdmin && (
              <DropdownMenuItem onClick={() => onRename(client)}>
                <Pencil className="w-4 h-4" /> Renombrar
              </DropdownMenuItem>
            )}
            {canEdit && (
              <DropdownMenuItem onClick={() => onLogo(client)}>
                <Image className="w-4 h-4" /> Cambiar logo
              </DropdownMenuItem>
            )}
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-amber-600 focus:text-amber-600"
                  onClick={() => onPurge(client)}
                >
                  <Eraser className="w-4 h-4" /> Purgar datos
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(client)}
                >
                  <Trash2 className="w-4 h-4" /> Eliminar cliente
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
