import { ArrowLeftRight } from "lucide-react";
import type { AccessReviewDelta } from "@/types";

function accesos(n: number): string {
  return n === 1 ? "1 acceso" : `${n} accesos`;
}

/**
 * Qué cambió respecto de la corrida anterior. El delta lo calcula el backend comparando snapshots
 * completos: acá solo se presenta.
 *
 * Tres estados distintos, y la diferencia importa:
 *  - sin corrida anterior (primera revisión del cliente): no hay novedad que mostrar, y decirlo con
 *    "+0 / −0" haría leer "no cambió nada", que es una afirmación que no se puede hacer;
 *  - corrida anterior sin diferencias: eso sí se afirma, con texto explícito;
 *  - con diferencias: los conteos, la fecha de la corrida comparada y —arriba de todo— los Global
 *    Admins que aparecieron o desaparecieron, que es lo más grave que puede traer un delta.
 *
 * `onShowNew` lleva a Asignaciones filtrado por lo nuevo (solo si hay accesos nuevos que ver).
 */
export default function DeltaStrip({ delta, onShowNew }: {
  delta?: AccessReviewDelta;
  onShowNew?: () => void;
}) {
  // Corrida servida por una API anterior a este bloque (ventana de deploy): sin dato, sin franja.
  if (!delta) return null;

  if (!delta.has_previous) {
    return (
      <p className="text-xs text-muted-foreground rounded-lg border border-border px-3 py-2">
        Primera revisión de este cliente: no hay corrida anterior con la que comparar.
      </p>
    );
  }

  const fecha = delta.previous_finished_at
    ? new Date(delta.previous_finished_at).toLocaleDateString("es-EC")
    : null;
  const gaNuevos = delta.nuevos_global_admins ?? [];
  const gaRemovidos = delta.global_admins_removidos ?? [];
  const sinCambios = delta.nuevos_accesos === 0 && delta.accesos_removidos === 0
    && gaNuevos.length === 0 && gaRemovidos.length === 0
    && delta.nuevos_guests === 0 && delta.guests_removidos === 0;

  return (
    <div className="rounded-xl border bg-card px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="text-sm font-semibold inline-flex items-center gap-1.5">
        <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
        Cambios desde la corrida anterior
      </span>

      {sinCambios ? (
        <span className="text-xs text-muted-foreground">Sin cambios respecto de la corrida anterior.</span>
      ) : (
        <span className="text-xs inline-flex items-center gap-2 flex-wrap tabular-nums">
          {onShowNew && delta.nuevos_accesos > 0 ? (
            <button type="button" onClick={onShowNew}
              title="Clic para ver los accesos nuevos en Asignaciones"
              className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900 cursor-pointer">
              +{accesos(delta.nuevos_accesos)}
            </button>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              +{accesos(delta.nuevos_accesos)}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            −{accesos(delta.accesos_removidos)}
          </span>
          {(delta.nuevos_guests > 0 || delta.guests_removidos > 0) && (
            <span className="text-muted-foreground">
              Invitados: +{delta.nuevos_guests} · −{delta.guests_removidos}
            </span>
          )}
        </span>
      )}

      {fecha && (
        <span className="text-xs text-muted-foreground ml-auto">
          Comparado con la corrida del {fecha}
        </span>
      )}

      {(gaNuevos.length > 0 || gaRemovidos.length > 0) && (
        <div className="basis-full text-xs space-y-0.5">
          {gaNuevos.length > 0 && (
            <p className="text-red-700 dark:text-red-400 font-medium">
              Global Admins nuevos: {gaNuevos.join(", ")}
            </p>
          )}
          {gaRemovidos.length > 0 && (
            <p className="text-muted-foreground">
              Global Admins removidos: {gaRemovidos.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
