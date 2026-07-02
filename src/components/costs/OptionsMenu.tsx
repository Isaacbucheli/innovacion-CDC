import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function OptionsMenu({
  disabled,
  isAdmin,
  onRecalcScenarios,
  onRefreshRi,
  onRefreshPower,
  onClearCache,
  onFinOpsRefresh,
}: {
  disabled?: boolean;
  isAdmin?: boolean;
  onRecalcScenarios: () => void;
  onRefreshRi: () => void;
  onRefreshPower: () => void;
  onClearCache: () => void;
  onFinOpsRefresh: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <MoreHorizontal className="w-4 h-4 mr-1" />
          Opciones
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Operaciones</DropdownMenuLabel>
        <DropdownMenuItem onClick={onRecalcScenarios}>Recalcular escenarios</DropdownMenuItem>
        <DropdownMenuItem onClick={onRefreshRi}>Actualizar cobertura RI</DropdownMenuItem>
        <DropdownMenuItem onClick={onRefreshPower}>Actualizar encendido/apagado</DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onClearCache}>Limpiar caché de precios</DropdownMenuItem>
            <DropdownMenuItem onClick={onFinOpsRefresh}>Actualizar datos FinOps</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
