import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import { fmtDateOnly } from "@/lib/dates";
import { fmtNum } from "@/lib/informeValor";
import type { InformeCronologia, InformeHito } from "@/types";
import { Aviso, Seccion } from "./Piezas";

/**
 * Traduce el campo trackeado de la bitácora a lenguaje de informe. Espejo TS de `tituloHito` en
 * `Plantilla-Dashboard-BIT.html`: los tres son los únicos que `CronologiaModelo.CamposPublicables`
 * deja pasar (`completion_pct`, `remediation_start_date`, `remediation_end_date`). Cualquier otro
 * valor es un campo nuevo que la lista blanca del modelo todavía no traduce, así que se muestra tal
 * cual en vez de fallar en silencio.
 */
export function tituloHito(h: InformeHito): string {
  if (h.campo === "completion_pct") {
    return `Avance al ${h.despues ?? "?"}%${h.antes ? ` (venía de ${h.antes}%)` : ""}`;
  }
  if (h.campo === "remediation_start_date") {
    return `Inicio de remediación comprometido para el ${h.despues ?? "?"}`;
  }
  if (h.campo === "remediation_end_date") {
    return `Cierre de remediación comprometido para el ${h.despues ?? "?"}`;
  }
  return h.campo;
}

/**
 * Bloque de cronología (`cronologia`): hitos fechados de la bitácora de la matriz de mejoras.
 *
 * El modelo ya filtró por la lista blanca de campos publicables antes de llegar acá (las notas
 * internas y la bitácora de ejecución nunca viajan, ni siquiera en la variante interna): esta
 * sección no vuelve a decidir qué se muestra, solo traduce lo que el modelo ya declaró publicable.
 * `omitidos` se declara para que una cronología corta no se lea como "no pasó nada".
 */
export default function SeccionCronologia({ cr }: { cr: InformeCronologia }) {
  const cols: SimpleCol<InformeHito>[] = [
    { key: "fecha", label: "Fecha", render: (h) => fmtDateOnly(h.fecha) },
    { key: "codigo", label: "Código", render: (h) => h.codigo ?? "—" },
    { key: "hito", label: "Hito", render: (h) => tituloHito(h) },
    { key: "rec", label: "Recomendación", render: (h) => h.rec },
  ];

  return (
    <Seccion
      titulo="Cronología del servicio"
      descripcion="Hitos fechados de la bitácora de la matriz de mejoras. Solo se publican los cambios de avance y las fechas de remediación: las notas internas quedan fuera del informe."
    >
      <SimpleTable cols={cols} rows={cr.hitos}
        empty="La bitácora de la matriz de mejoras no registra hitos en este período." />
      {cr.omitidos > 0 && (
        <Aviso tono="info">
          {fmtNum(cr.omitidos)} entradas de la bitácora quedaron fuera: son notas internas, registros
          de ejecución o cambios fuera del período. La línea de tiempo publica el avance comprometido y
          las fechas de remediación.
        </Aviso>
      )}
    </Seccion>
  );
}
