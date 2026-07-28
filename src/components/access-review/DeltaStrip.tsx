import { ArrowLeftRight } from "lucide-react";
import type { AccessReviewDelta } from "@/types";

function accesos(n: number): string {
  return n === 1 ? "1 acceso" : `${n} accesos`;
}

/**
 * Qué cambió respecto de la corrida anterior. El delta lo calcula el backend comparando snapshots
 * completos: acá solo se presenta.
 *
 * Cuatro estados distintos, y la diferencia importa:
 *  - sin corrida anterior (primera revisión del cliente): no hay novedad que mostrar, y decirlo con
 *    "+0 / −0" haría leer "no cambió nada", que es una afirmación que no se puede hacer;
 *  - eje no comparable: alguna de las dos corridas leyó su insumo a medias, así que el eje va en
 *    "n/d". Es el caso que más daño hacía: con la corrida anterior parcial y la actual completa, la
 *    franja imprimía en rojo "Global Admins nuevos: <todos los del tenant>" cuando nadie recibió
 *    nada — el eje estaba vacío antes porque no se pudo leer el directorio, no porque no existieran;
 *  - corrida anterior sin diferencias: eso sí se afirma, con texto explícito, y solo sobre los ejes
 *    que efectivamente se midieron;
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
  // La comparabilidad se lee del backend, con el valor del campo como respaldo para respuestas de la
  // API anterior a este cambio (que nunca mandaban null en un eje).
  const accesosOk = delta.accesos_comparables ?? delta.nuevos_accesos !== null;
  const dirOk = delta.directorio_comparable ?? delta.nuevos_global_admins !== null;
  const nuevos = delta.nuevos_accesos ?? 0;
  const removidos = delta.accesos_removidos ?? 0;
  const gaNuevos = delta.nuevos_global_admins ?? [];
  const gaRemovidos = delta.global_admins_removidos ?? [];
  const guestsNuevos = delta.nuevos_guests ?? 0;
  const guestsRemovidos = delta.guests_removidos ?? 0;

  // "Sin cambios" solo se puede afirmar sobre ejes medidos, y solo si hay al menos uno: si ninguno lo
  // está, no hay nada que afirmar.
  const sinCambios = (accesosOk || dirOk)
    && (!accesosOk || (nuevos === 0 && removidos === 0))
    && (!dirOk || (gaNuevos.length === 0 && gaRemovidos.length === 0
      && guestsNuevos === 0 && guestsRemovidos === 0));

  const noComparable = !accesosOk && !dirOk
    ? "No comparable: alguna de las dos corridas quedó incompleta."
    : !accesosOk
      ? "Accesos: n/d (el inventario de asignaciones quedó incompleto en alguna de las dos corridas)."
      : !dirOk
        ? "Entra ID: n/d (el directorio quedó incompleto en alguna de las dos corridas)."
        : null;

  return (
    <div className="rounded-xl border bg-card px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="text-sm font-semibold inline-flex items-center gap-1.5">
        <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
        Cambios desde la corrida anterior
      </span>

      {sinCambios ? (
        <span className="text-xs text-muted-foreground">
          {accesosOk && dirOk
            ? "Sin cambios respecto de la corrida anterior."
            : accesosOk
              ? "Sin cambios en los accesos respecto de la corrida anterior."
              : "Sin cambios en Entra ID respecto de la corrida anterior."}
        </span>
      ) : accesosOk || dirOk ? (
        <span className="text-xs inline-flex items-center gap-2 flex-wrap tabular-nums">
          {accesosOk && (
            <>
              {onShowNew && nuevos > 0 ? (
                <button type="button" onClick={onShowNew}
                  title="Clic para ver los accesos nuevos en Asignaciones"
                  className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900 cursor-pointer">
                  +{accesos(nuevos)}
                </button>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  +{accesos(nuevos)}
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                −{accesos(removidos)}
              </span>
            </>
          )}
          {dirOk && (guestsNuevos > 0 || guestsRemovidos > 0) && (
            <span className="text-muted-foreground">
              Invitados: +{guestsNuevos} · −{guestsRemovidos}
            </span>
          )}
        </span>
      ) : null}

      {fecha && (
        <span className="text-xs text-muted-foreground ml-auto">
          Comparado con la corrida del {fecha}
        </span>
      )}

      {noComparable && (
        <p className="basis-full text-xs text-muted-foreground">{noComparable}</p>
      )}

      {dirOk && (gaNuevos.length > 0 || gaRemovidos.length > 0) && (
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
