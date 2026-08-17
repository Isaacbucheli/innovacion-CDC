import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtDateOnly } from "@/lib/dates";
import {
  BLOQUES_ECONOMICOS, FUERA_DE_LOS_OCHO, etiquetaMes, mismoCuerpo, resumenBloques,
  type BloqueEconomico,
} from "@/lib/informeValor";
import type { InformeValorEntrega, InformeValorModelo, InformeValorPreviewRequest, VarianteInforme } from "@/types";
import { Aviso, Dato, SinMedir } from "../informe/Piezas";

/**
 * La pestaña de entrega: qué se va a publicar, los ocho interruptores y las dos descargas.
 *
 * **Los ocho bloques nacen apagados y apagar no es publicar un cero.** Un bloque apagado se OMITE:
 * la sección sigue apareciendo en el artefacto con su relato en conteos y porcentajes, y donde iría
 * el monto la capa de dibujo escribe "No publicado". Es la diferencia entre no decir una cifra y
 * afirmarle a quien paga la factura que vale cero, y es el defecto que más veces apareció en este
 * módulo. Por eso la pantalla lo dice con palabras y cada interruptor apagado muestra qué deja de
 * viajar en vez de un espacio en blanco.
 *
 * **`ahorroEjecutado` es distinto a los otros siete**: desde la entrega 7 es el titular del informe
 * (la sección que abre el relato). Apagarlo no es un interruptor más de la lista: el resumen previo
 * a generar lo dice con todas las letras, no como la séptima casilla entre ocho.
 *
 * Dos cosas que la pantalla no deja hacer:
 *
 * - Generar sin haber calculado el informe. El artefacto no se dibuja acá (la CSP del SWA no lo
 *   permite), así que lo único que garantiza que alguien miró estas cifras es haber pasado por la
 *   pestaña del informe.
 * - Generar con parámetros distintos a los que se revisaron. El formulario del período se puede
 *   seguir tocando después de calcular; si eso llegara al artefacto, el archivo saldría de una
 *   ventana que nadie aprobó. Con el cuerpo cambiado, las descargas se bloquean y se pide recalcular.
 */
export default function PanelEntrega({
  modelo, cuerpoRevisado, cuerpoActual, aprobados, onAprobados, canEdit, generando, onGenerar,
  ultima,
}: {
  modelo: InformeValorModelo | null;
  /** Cuerpo con el que se calculó lo que está en pantalla. `null` = todavía no se calculó nada. */
  cuerpoRevisado: InformeValorPreviewRequest | null;
  /** Cuerpo que produciría el formulario del período tal como está ahora. */
  cuerpoActual: InformeValorPreviewRequest;
  aprobados: BloqueEconomico[];
  onAprobados: (b: BloqueEconomico[]) => void;
  canEdit: boolean;
  /** Variante que se está generando en este momento, o null. */
  generando: string | null;
  onGenerar: (v: VarianteInforme) => void;
  /** La última entrega generada en esta sesión, para decir qué publicó de verdad. */
  ultima: InformeValorEntrega | null;
}) {
  if (!modelo || !cuerpoRevisado) {
    return (
      <div className="rounded-xl border border-dashed bg-card/50 p-4">
        <h3 className="text-base font-semibold">Todavía no hay nada que entregar</h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Calcula el informe en la pestaña <strong>Informe</strong> y revísalo. El artefacto se genera
          con los mismos parámetros que se revisaron, así que la revisión va primero.
        </p>
      </div>
    );
  }

  const revisadoVigente = mismoCuerpo(cuerpoRevisado, cuerpoActual);
  const filas = resumenBloques(modelo, aprobados);
  // Las secciones que el artefacto va a publicar declaradas ausentes. Se dicen acá porque el
  // consultor decide si el informe sale así o si primero carga el insumo que falta.
  const ausentes = [
    modelo.fact ? null : "consumo",
    modelo.tickets ? null : "operación",
    modelo.rbac ? null : "seguridad",
    modelo.advisor ? null : "postura",
    modelo.matriz ? null : "roadmap",
  ].filter((s): s is string => s !== null);
  const n = aprobados.length;
  const bloqueado = !canEdit || !revisadoVigente || generando !== null;

  function alternar(clave: BloqueEconomico, marcado: boolean) {
    onAprobados(marcado
      ? BLOQUES_ECONOMICOS.filter((b) => b.clave === clave || aprobados.includes(b.clave)).map((b) => b.clave)
      : aprobados.filter((b) => b !== clave));
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Qué se va a publicar</h3>
        <div className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-4 md:grid-cols-4">
          <Dato label="Cliente">{modelo.meta.cliente}</Dato>
          <Dato label="Período">{modelo.meta.periodo}</Dato>
          <Dato label="Fecha de corte">{fmtDateOnly(modelo.meta.corte)}</Dato>
          <Dato label="Meses parciales">
            {cuerpoRevisado.meses_parciales_forzados === null
              ? "Los decide la heurística"
              : cuerpoRevisado.meses_parciales_forzados.length === 0
                ? "Ninguno (declarado)"
                : cuerpoRevisado.meses_parciales_forzados.map(etiquetaMes).join(", ")}
          </Dato>
          <Dato label="Origen de los permisos">
            {modelo.meta.rbacOrigen === "base" ? "Revisión de accesos"
              : modelo.meta.rbacOrigen === "archivo" ? "Archivo subido"
                : <span className="text-muted-foreground">Sin insumo de permisos</span>}
          </Dato>
        </div>

        <p className="max-w-3xl text-xs text-muted-foreground">
          {ausentes.length === 0
            ? "Las cinco secciones del informe tienen datos. Las no económicas viajan siempre, con sus conteos y porcentajes."
            : `Sin insumo para ${ausentes.join(", ")}: esas secciones van declaradas ausentes, con el motivo a la vista, no en cero.`}
        </p>

        {!revisadoVigente && (
          <Aviso>
            El período, el corte o los meses parciales del formulario ya no son los del informe que
            está en pantalla. Vuelve a la pestaña <strong>Informe</strong> y calcúlalo de nuevo: el
            artefacto tiene que salir de la misma ventana que se revisó.
          </Aviso>
        )}
        {!canEdit && (
          <Aviso tono="info">
            Generar archiva una entrega, así que necesita permiso de edición en este módulo. Puedes
            revisar el informe y el historial, pero no descargar una versión nueva.
          </Aviso>
        )}
        {!aprobados.includes("ahorroEjecutado") && (
          <Aviso>
            <strong>
              El bloque de ahorro ejecutado nace apagado como los demás, pero hoy es el titular del
              informe: sin aprobarlo, la sección de ahorro ejecutado va a salir sin montos.
            </strong>{" "}
            El informe conserva su relato y sus conteos igual que con cualquier otro bloque apagado;
            donde iría cada cifra, el informe del cliente dice “No publicado”.
          </Aviso>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">
            Bloques económicos: {n} de {BLOQUES_ECONOMICOS.length} aprobados
          </h3>
          <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">
            Los ocho nacen apagados y se aprueban uno por uno. Que estén apagados no es un paso
            pendiente: es el informe sin montos, que es una entrega válida.
          </p>
        </div>

        <Aviso>
          <strong>Un bloque apagado no publica un cero: lo omite.</strong> La sección aparece igual,
          con su relato en conteos y porcentajes, y donde iría el monto el informe dice
          “No publicado”. Nunca “$0.00”: decirle cero a quien paga la factura es afirmarle algo falso.
        </Aviso>

        <div className="divide-y rounded-xl border bg-card">
          {filas.map((f) => (
            <label key={f.clave} className="flex cursor-pointer items-start gap-3 p-4">
              <input
                type="checkbox"
                className="accent-primary mt-0.5 h-4 w-4 cursor-pointer"
                checked={f.aprobado}
                disabled={!canEdit}
                aria-label={`Publicar ${f.etiqueta}`}
                onChange={(e) => alternar(f.clave, e.target.checked)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-medium">{f.etiqueta}</span>
                  <span className="text-sm tabular-nums">
                    {f.valor !== null
                      ? f.valor
                      : <SinMedir motivo={f.motivo ?? ""} etiqueta="Sin cifra" />}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{f.publica}.</p>
                {f.valor === null && f.motivo && (
                  <p className="mt-1 text-xs text-muted-foreground">{f.motivo}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {f.aprobado
                    ? "Aprobado: viaja al informe del cliente."
                    : `Apagado: el informe del cliente omite ${minuscula(f.apagado)}, y dice “No publicado” en su lugar.`}
                </p>
              </div>
            </label>
          ))}
        </div>

        <Aviso tono="info">{FUERA_DE_LOS_OCHO}</Aviso>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">Descargas</h3>
          <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">
            Las dos variantes salen del mismo cálculo, así que son comparables entre sí. Cada descarga
            queda archivada en el historial con sus parámetros y sus bloques.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" disabled={bloqueado} onClick={() => onGenerar("interna")}>
            {generando === "interna"
              ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              : <Download className="mr-1 h-4 w-4" />}
            Informe interno (todo)
          </Button>
          <Button disabled={bloqueado} onClick={() => onGenerar("cliente")}>
            {generando === "cliente"
              ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              : <Download className="mr-1 h-4 w-4" />}
            Informe del cliente ({n} de {BLOQUES_ECONOMICOS.length})
          </Button>
        </div>

        <p className="max-w-3xl text-xs text-muted-foreground">
          El informe interno lleva los ocho bloques <strong>sin mirar los interruptores</strong>:
          pedirlo es pedir el informe completo. Los interruptores solo gobiernan el informe del cliente.
        </p>

        {n === 0 && (
          <Aviso tono="info">
            Con los ocho apagados, el informe del cliente sale sin ningún monto: todas las secciones
            con sus conteos y porcentajes, y “No publicado” donde iría cada cifra. Es el default y es
            una entrega válida, no un informe a medias.
          </Aviso>
        )}

        {ultima && <UltimaEntrega entrega={ultima} pedidos={aprobados} />}
      </section>
    </div>
  );
}

/**
 * Qué publicó de verdad la última descarga. Sale de lo que la API archivó y no de lo que esta
 * pantalla pidió: la variante interna publica los ocho aunque los interruptores estén apagados, y si
 * alguna vez las dos listas dejaran de coincidir en la variante del cliente, acá se ve.
 */
function UltimaEntrega({ entrega, pedidos }: { entrega: InformeValorEntrega; pedidos: BloqueEconomico[] }) {
  const publicados = entrega.bloques_publicados;
  const discrepa = entrega.variante === "cliente"
    && (publicados.length !== pedidos.length || pedidos.some((p) => !publicados.includes(p)));

  return (
    <div className="space-y-2 rounded-xl border bg-card p-4 text-sm">
      <p>
        Última descarga: <strong>{entrega.file_name}</strong> · variante {entrega.variante} ·
        {" "}{publicados.length === 0
          ? "sin ningún monto publicado"
          : `${publicados.length} bloque(s) con monto`}.
      </p>
      {discrepa && (
        <Aviso>
          El artefacto archivó bloques distintos a los aprobados en esta pantalla
          ({publicados.join(", ") || "ninguno"}). Lo que vale es lo archivado: es lo que el archivo
          hace. Hay que revisar la generación antes de mandarlo.
        </Aviso>
      )}
    </div>
  );
}

/** Baja la inicial para poder incrustar el texto del bloque en una frase. */
function minuscula(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
