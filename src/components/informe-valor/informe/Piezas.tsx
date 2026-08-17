import { CircleHelp, TriangleAlert } from "lucide-react";
import { REPORT_COLORS } from "@/lib/report";
import { BLOQUES_ECONOMICOS, type BloqueEconomico } from "@/lib/informeValor";

/**
 * Piezas compartidas de la vista del informe. La que manda es <SinMedir>: el defecto más repetido
 * de este módulo es el cero ambiguo -- una cifra correcta que se lee al revés porque nadie dijo qué
 * significa el vacío. Ninguna cifra ausente se dibuja como 0 ni como un guion mudo: se dibuja con
 * su motivo, siempre.
 */

/** Un dato que no se pudo medir. `motivo` es obligatorio a propósito. */
export function SinMedir({ motivo, etiqueta = "Sin medir" }: { motivo: string; etiqueta?: string }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle text-base font-medium text-muted-foreground"
      title={motivo}>
      <CircleHelp className="h-4 w-4 shrink-0" aria-hidden />
      {etiqueta}
    </span>
  );
}

/**
 * Una cifra que puede no estar medida. Cuando `valor` es null se muestra <SinMedir> con el motivo,
 * nunca el resultado de formatear un cero.
 */
export function Cifra({ valor, formato, motivoSinMedir, etiquetaSinMedir }: {
  valor: number | null | undefined;
  formato: (n: number) => string;
  motivoSinMedir: string;
  etiquetaSinMedir?: string;
}) {
  if (valor === null || valor === undefined) {
    return <SinMedir motivo={motivoSinMedir} etiqueta={etiquetaSinMedir} />;
  }
  return <>{formato(valor)}</>;
}

export type Tono = "" | "neutro" | "aviso" | "malo" | "bueno";

const ACENTO: Record<Tono, string> = {
  "": REPORT_COLORS.greenDark,
  neutro: REPORT_COLORS.muted,
  aviso: REPORT_COLORS.gold,
  malo: REPORT_COLORS.crit,
  bueno: REPORT_COLORS.greenDark,
};

export function Kpi({ label, valor, hint, tono = "" }: {
  label: string;
  valor: React.ReactNode;
  hint?: React.ReactNode;
  tono?: Tono;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 border-l-[3px]" style={{ borderLeftColor: ACENTO[tono] }}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">{valor}</div>
      {hint && <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</div>}
    </div>
  );
}

/**
 * Una sección del informe. `bloque` marca las secciones cuyo monto se aprueba uno por uno en la
 * pestaña de entrega: acá se ven siempre (esta es la vista interna), la marca solo anticipa cuál va
 * a poder apagarse al publicar.
 *
 * La etiqueta sale de `BLOQUES_ECONOMICOS`, que es la misma lista que va a gobernar los ocho
 * interruptores de la entrega: si esa lista cambia, cambia la marca, y no hay dos vocabularios para
 * los mismos ocho bloques.
 */
export function Seccion({ titulo, descripcion, bloque, acciones, children }: {
  titulo: string;
  descripcion?: React.ReactNode;
  bloque?: BloqueEconomico;
  acciones?: React.ReactNode;
  children: React.ReactNode;
}) {
  const economico = bloque ? BLOQUES_ECONOMICOS.find((b) => b.clave === bloque) : undefined;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            {titulo}
            {economico && (
              <span
                title={`Bloque económico "${economico.etiqueta}": ${economico.publica}. Se aprueba al publicar, no acá.`}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Económico
              </span>
            )}
          </h3>
          {descripcion && <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">{descripcion}</p>}
        </div>
        {acciones}
      </div>
      {children}
    </section>
  );
}

/** Un bloque entero que no se puede mostrar, con el motivo por delante. Nunca una sección vacía. */
export function BloqueAusente({ titulo, motivo }: { titulo: string; motivo: string }) {
  return (
    <section className="rounded-xl border border-dashed bg-card/50 p-4">
      <h3 className="text-base font-semibold text-muted-foreground">{titulo}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{motivo}</p>
    </section>
  );
}

/** Nota al pie de una sección: una advertencia sobre el dato, no un error de la aplicación. */
export function Aviso({ tono = "aviso", children }: { tono?: "aviso" | "info"; children: React.ReactNode }) {
  const clase = tono === "aviso"
    ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
    : "border-border bg-muted/40 text-muted-foreground";
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed ${clase}`}>
      {tono === "aviso" && <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />}
      <div>{children}</div>
    </div>
  );
}

/**
 * Pie de una tabla recortada. Existe para que un recorte de pantalla nunca se confunda con el
 * total: la tabla muestra las primeras filas, y esta línea dice cuántas hay.
 */
export function Recorte({ mostradas, total, que }: { mostradas: number; total: number; que: string }) {
  if (total <= mostradas) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Esta tabla muestra {mostradas.toLocaleString("en-US")} de {total.toLocaleString("en-US")} {que}:
      el recorte es de esta pantalla, el modelo trae la lista completa.
    </p>
  );
}

/** Fila de dato clave/valor para los encabezados. */
export function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}
