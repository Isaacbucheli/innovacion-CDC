import { useState } from "react";
import { CircleCheck, CircleHelp, MoreHorizontal, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmDelete from "@/components/ConfirmDelete";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fmtDateTime } from "@/lib/dates";
import type { EstadoRbacInfo, InsumoEstado, InsumoKind } from "@/types";

// Partial (no Record<InsumoKind, ...>) a propósito: el lookup de abajo tiene que poder devolver
// undefined de verdad, no solo aparentarlo, para que el fallback defensivo (tolerancia de deploy
// ante un kind que la API ya anuncia y este front todavía no conoce) no sea un `??` que el tipado
// vuelve inalcanzable. "rbac" no entra acá: tiene su propia tarjeta (RbacInsumoCard) con título fijo.
const ETIQUETAS: Partial<Record<InsumoKind, { titulo: string; detalle: string }>> = {
  facturacion: {
    titulo: "BITCOST: facturación e inventario",
    detalle: "Export \"tabla de hechos\" del Power BI. Alimenta eficiencia financiera, cobertura y altas y bajas.",
  },
  evolucion: {
    titulo: "Evolución por recurso (BITCOST)",
    detalle:
      "Export matriz del Power BI: la serie mensual por recurso con su categoría y el precio facturado de las reservas.",
  },
  casos: {
    titulo: "Requerimientos e incidentes",
    detalle: "Excel de la mesa de servicio con SLA. Alimenta operación, gestión proactiva y ventana de atención.",
  },
};

const OBLIGATORIO_PILL =
  "rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300";
const AMBER_TEXT = "text-amber-700 dark:text-amber-400";

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
 * El insumo de RBAC (`RbacInsumoCard` más abajo) es distinto de los demás (facturación, evolución,
 * casos): no es "cargado o no", son tres presentaciones según `estadoRbac.disponibilidad` -- ver
 * el comentario de esa función para el detalle de cada una.
 */
export default function InsumoCards({
  insumos, estadoRbac = null, canEdit, busy = false, onSubir, onBorrar, onIrARevisionAccesos,
}: {
  insumos: InsumoEstado[];
  /** Condicional de RBAC (GET /estado, bloque `estado_rbac`; ver useInformeValor). Null mientras
   * no haya cargado o si la lectura falló -- la tarjeta de RBAC lo trata igual que "no
   * disponible" pero sin ofrecer nada, el mismo default conservador que usa la API cuando no
   * puede medir un eje. */
  estadoRbac?: EstadoRbacInfo | null;
  canEdit: boolean;
  /** Subida o borrado en curso: deshabilita el disparador del menú de cada tarjeta. */
  busy?: boolean;
  onSubir: (kind: InsumoKind) => void;
  onBorrar: (kind: InsumoKind) => void;
  /** Acceso directo a Revisión de accesos, para la presentación "no disponible" del insumo de
   * RBAC. Opcional: los tests que no ejercitan esa presentación no necesitan pasarlo. */
  onIrARevisionAccesos?: () => void;
}) {
  const [confirmar, setConfirmar] = useState<InsumoEstado | null>(null);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {insumos.map((i) => {
        if (i.kind === "rbac") {
          return (
            <RbacInsumoCard
              key={i.kind}
              insumo={i}
              estado={estadoRbac}
              canEdit={canEdit}
              busy={busy}
              onSubir={() => onSubir(i.kind)}
              onQuitar={() => setConfirmar(i)}
              onIrARevisionAccesos={onIrARevisionAccesos}
            />
          );
        }

        const falta = i.obligatorio && !i.cargado;
        const etiqueta = ETIQUETAS[i.kind] ?? { titulo: i.kind, detalle: "" };
        return (
          <div key={i.kind}
            className={`rounded-xl border bg-card p-4 ${falta ? "border-amber-300 dark:border-amber-800" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-semibold">{etiqueta.titulo}</div>
              <div className="flex shrink-0 items-center gap-1.5">
                {i.obligatorio && <span className={OBLIGATORIO_PILL}>Obligatorio</span>}
                {canEdit && (
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

            <div className={`mt-1 text-xs font-semibold ${i.cargado ? "text-primary" : falta ? AMBER_TEXT : "text-muted-foreground"}`}>
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

/**
 * Tarjeta del insumo de RBAC: tres presentaciones según `estado.disponibilidad` (ver
 * EstadoRbac.Resolver en la API), no un texto fijo.
 *
 * - "completo": la revisión de accesos ya resuelve el insumo, con la fecha de la corrida a la
 *   vista. El archivo no hace falta, y si se sube la API lo descarta ("gana la base" -- ver
 *   InformeValorController.Subir): por eso esta presentación nunca ofrece "Subir", para no
 *   mandar al consultor a un trabajo que se tira. Si queda un archivo viejo cargado de antes de
 *   que la base llegara a completo, sigue pudiendo "Quitar"-lo.
 * - "parcial_falta_identidad": el inventario de permisos está completo pero falta uno de los dos
 *   ejes de identidad (nunca los dos a la vez, ver `EjeIndicador` abajo). El archivo es un
 *   respaldo OPCIONAL: no suma el badge "Obligatorio" ni el borde ámbar de "falta este archivo".
 * - "no_disponible": no hay nada que la plataforma pueda leer sola. El archivo es OBLIGATORIO
 *   (mismo tratamiento que facturación/casos: badge + borde ámbar mientras no esté cargado) más
 *   un acceso directo a Revisión de accesos, por si el camino es sincronizar en vez de subir un
 *   Excel.
 *
 * Los dos ejes de identidad (`estado_cuenta_medido`/`ultimo_login_medido`) son independientes y
 * no se colapsan en un solo indicador: un cliente sin licencia Microsoft Entra ID P1 tiene el
 * estado de cuenta medido y el último inicio de sesión no, y un indicador combinado le
 * escondería al consultor un dato que sí tiene. `estado.motivo` ya lo redactó la API para la
 * combinación exacta -- se muestra tal cual, no se redacta uno nuevo acá.
 *
 * `estado.origen` (de qué fuente salieron las filas que de verdad alimentan el informe) se
 * muestra siempre que la API lo manda, sin importar la presentación: puede discrepar tanto de
 * `disponibilidad` (base parcial + archivo subido = disponibilidad "parcial_falta_identidad"
 * pero origen "archivo") como de si hay un archivo guardado (un Excel sin filas no gana el
 * origen aunque quede cargado). El consultor necesita esto para explicar de dónde salió una
 * cifra del informe.
 */
function RbacInsumoCard({
  insumo, estado, canEdit, busy, onSubir, onQuitar, onIrARevisionAccesos,
}: {
  insumo: InsumoEstado;
  estado: EstadoRbacInfo | null;
  canEdit: boolean;
  busy: boolean;
  onSubir: () => void;
  onQuitar: () => void;
  onIrARevisionAccesos?: () => void;
}) {
  const disponibilidad = estado?.disponibilidad;
  const puedeSubir = disponibilidad != null && disponibilidad !== "completo";
  const obligatorio = disponibilidad === "no_disponible";
  const falta = obligatorio && !insumo.cargado;
  const mostrarOpciones = canEdit && (puedeSubir || insumo.cargado);

  let statusLine: string;
  let statusClass: string;
  if (disponibilidad === "completo") {
    statusLine = "Resuelto desde la base";
    statusClass = "text-primary";
  } else if (insumo.cargado) {
    statusLine = `Cargado · ${insumo.source_file_name ?? "archivo"}`;
    statusClass = "text-primary";
  } else if (disponibilidad === "parcial_falta_identidad") {
    statusLine = "Parcial · falta identidad";
    statusClass = AMBER_TEXT;
  } else if (falta) {
    statusLine = "Falta este archivo";
    statusClass = AMBER_TEXT;
  } else {
    // Sin estadoRbac todavía (loading/error del lado del caller): no se afirma nada.
    statusLine = "Pendiente";
    statusClass = "text-muted-foreground";
  }

  return (
    <div className={`rounded-xl border bg-card p-4 ${falta ? "border-amber-300 dark:border-amber-800" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold">Reporte de RBAC</div>
        <div className="flex shrink-0 items-center gap-1.5">
          {obligatorio && <span className={OBLIGATORIO_PILL}>Obligatorio</span>}
          {mostrarOpciones && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Opciones para Reporte de RBAC"
                  disabled={busy}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {puedeSubir && (
                  <DropdownMenuItem onClick={onSubir}>
                    {insumo.cargado ? "Reemplazar" : "Subir"}
                  </DropdownMenuItem>
                )}
                {insumo.cargado && (
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onQuitar}>
                    Quitar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className={`mt-1 text-xs font-semibold ${statusClass}`}>{statusLine}</div>

      {disponibilidad === "completo" && (
        <div className="mt-1 text-xs text-muted-foreground">Corrida del {fmtDateTime(estado?.fecha_corrida ?? null)}</div>
      )}

      {disponibilidad !== "completo" && insumo.cargado && (
        <div className="mt-1 text-xs text-muted-foreground">
          {insumo.filas.toLocaleString("en-US")} filas
          {insumo.cargado_en ? ` · ${fmtDateTime(insumo.cargado_en)}` : ""}
        </div>
      )}

      {estado?.origen && (
        <div className="mt-1 text-xs text-muted-foreground">
          Fuente: {estado.origen === "base" ? "Revisión de accesos" : "Archivo subido"}
        </div>
      )}

      {disponibilidad === "parcial_falta_identidad" && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <EjeIndicador label="Estado de cuenta" medido={estado?.estado_cuenta_medido ?? false} />
          <EjeIndicador label="Último inicio de sesión" medido={estado?.ultimo_login_medido ?? false} />
        </div>
      )}

      {insumo.warnings.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-400">
          {insumo.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        {estado?.motivo ?? "Todavía no se pudo determinar el estado de RBAC de este cliente."}
      </p>

      {disponibilidad === "no_disponible" && onIrARevisionAccesos && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onIrARevisionAccesos}>
          <ShieldCheck className="h-4 w-4" /> Ir a Revisión de accesos
        </Button>
      )}
    </div>
  );
}

/** Un eje de identidad medido o no, mostrado por separado del otro (ver comentario de
 * RbacInsumoCard). Mismo par de iconos que access-review/FindingsPanel.tsx para "dato disponible"
 * vs "no evaluable". */
function EjeIndicador({ label, medido }: { label: string; medido: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      {medido
        ? <CircleCheck className="h-3.5 w-3.5 text-emerald-600" />
        : <CircleHelp className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}
