import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmDelete from "@/components/ConfirmDelete";
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
    detalle: "Solo si la credencial del cliente no permite leer los accesos. Por ahora esta tarjeta no "
      + "sube un archivo: el dato se resuelve desde la revisión de accesos del cliente. La carga manual "
      + "llega más adelante. Alimenta seguridad bajo gobierno.",
  },
};

// El insumo de RBAC todavía no admite carga manual: el endpoint de subida lo rechaza (queda para
// una entrega posterior). Hasta que exista esa vía, la tarjeta no ofrece "Opciones" (ni Subir ni
// Quitar) para este kind puntual; ETIQUETAS.rbac.detalle es lo que explica el porqué al consultor.
const PUEDE_SUBIR: Record<InsumoKind, boolean> = {
  facturacion: true,
  casos: true,
  rbac: false,
};

/**
 * Tarjetas de insumo del informe de valor (una por `InsumoKind`).
 *
 * Las acciones de subir/reemplazar/quitar viven en un menú "Opciones" por tarjeta, no como
 * botones sueltos: es la convención del resto de la plataforma (ClientCard.tsx para acciones
 * por tarjeta, WafActions.tsx para el mismo patrón "Opciones -> abre un diálogo de subida") y
 * la que pide el spec del módulo para esta pantalla en particular.
 *
 * "Quitar" pasa primero por ConfirmDelete: el archivo le costó al consultor bajarlo del Power
 * BI y subirlo, y el borrado es irreversible del lado del servidor, así que ni un clic ni un
 * Enter accidental sobre el ítem del menú alcanzan para descartarlo sin aviso.
 *
 * El insumo de RBAC es la excepción (ver PUEDE_SUBIR): no ofrece "Opciones" porque hoy no hay
 * ninguna acción real para ese kind (ni Subir, que el servidor todavía rechaza, ni Quitar, que
 * no tiene nada que borrar). Un menú vacío sería peor que no tener menú.
 */
export default function InsumoCards({
  insumos, canEdit, busy = false, onSubir, onBorrar,
}: {
  insumos: InsumoEstado[];
  canEdit: boolean;
  /** Subida o borrado en curso: deshabilita el disparador del menú de cada tarjeta. */
  busy?: boolean;
  onSubir: (kind: InsumoKind) => void;
  onBorrar: (kind: InsumoKind) => void;
}) {
  const [confirmar, setConfirmar] = useState<InsumoEstado | null>(null);

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
                {canEdit && PUEDE_SUBIR[i.kind] && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Opciones para ${etiqueta.titulo}`}
                        disabled={busy}
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
                          onClick={() => setConfirmar(i)}
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

      <ConfirmDelete
        open={confirmar !== null}
        label={confirmar?.source_file_name ?? "el archivo"}
        title="¿Quitar este insumo?"
        description={
          <>Se va a quitar <strong>{confirmar?.source_file_name ?? "el archivo cargado"}</strong>. Vas a
          tener que volver a subirlo.</>
        }
        confirmLabel="Quitar"
        onOpenChange={(o) => { if (!o) setConfirmar(null); }}
        onConfirm={() => {
          if (confirmar) onBorrar(confirmar.kind);
          setConfirmar(null);
        }}
      />
    </div>
  );
}
