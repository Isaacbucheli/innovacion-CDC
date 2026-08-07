import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fmtDateTime } from "@/lib/dates";
import type { InsumoEstado, InsumoKind } from "@/types";

const ETIQUETAS: Record<InsumoKind, { titulo: string; detalle: string }> = {
  facturacion: {
    titulo: "BITCOST: facturación e inventario",
    detalle: "Export \"tabla de hechos\" del Power BI. Alimenta eficiencia financiera, cobertura y altas y bajas.",
  },
  casos: {
    titulo: "Requerimientos e incidentes",
    detalle: "Excel de la mesa de servicio con SLA. Alimenta operación, gestión proactiva y ventana de atención.",
  },
  rbac: {
    titulo: "Reporte de RBAC",
    detalle: "Solo si la credencial del cliente no permite leer los accesos. Alimenta seguridad bajo gobierno.",
  },
};

/**
 * Tarjetas de insumo del informe de valor (una por `InsumoKind`).
 *
 * Las acciones de subir/reemplazar/quitar viven en un menú "Opciones" por tarjeta, no como
 * botones sueltos: es la convención del resto de la plataforma (ClientCard.tsx para acciones
 * por tarjeta, WafActions.tsx para el mismo patrón "Opciones -> abre un diálogo de subida") y
 * la que pide el spec del módulo para esta pantalla en particular.
 */
export default function InsumoCards({
  insumos, canEdit, onSubir, onBorrar,
}: {
  insumos: InsumoEstado[];
  canEdit: boolean;
  onSubir: (kind: InsumoKind) => void;
  onBorrar: (kind: InsumoKind) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {insumos.map((i) => {
        const falta = i.obligatorio && !i.cargado;
        const etiqueta = ETIQUETAS[i.kind];
        return (
          <div key={i.kind}
            className={`rounded-xl border bg-card p-4 ${falta ? "border-amber-300 dark:border-amber-800" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-semibold">{etiqueta.titulo}</div>
              <div className="flex shrink-0 items-center gap-1.5">
                {i.obligatorio && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Obligatorio
                  </span>
                )}
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Opciones para ${etiqueta.titulo}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onSubir(i.kind)}>
                        {i.cargado ? "Reemplazar" : "Subir"}
                      </DropdownMenuItem>
                      {i.cargado && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onBorrar(i.kind)}
                        >
                          Quitar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            <div className={`mt-1 text-xs font-semibold ${i.cargado ? "text-primary" : falta ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
              {i.cargado
                ? `Cargado · ${i.source_file_name ?? "archivo"}`
                : falta ? "Falta este archivo" : "Pendiente"}
            </div>

            {i.cargado && (
              <div className="mt-1 text-xs text-muted-foreground">
                {i.filas.toLocaleString("en-US")} filas
                {i.cargado_en ? ` · ${fmtDateTime(i.cargado_en)}` : ""}
              </div>
            )}

            {i.warnings.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-400">
                {i.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}

            <p className="mt-2 text-xs text-muted-foreground">{etiqueta.detalle}</p>
          </div>
        );
      })}
    </div>
  );
}
