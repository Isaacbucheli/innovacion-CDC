import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, CircleCheck, CircleHelp, Info, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  accountPrivilege, asignacionesLabel, cuentasLabel, externalLabel, findingIsActionable, findingIsOpen,
  roleClassShortLabel, severityChip, severityLabel,
} from "@/lib/accessReview";
import type { AccessAccount, AccessFinding } from "@/types";

/** "1 informativa" / "2 informativas". `alcance_incompleto` es la única regla informativa, así que
 *  ese segmento SIEMPRE decía "1 informativas". */
function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`;
}

function dateOrDash(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("es-EC") : "—";
}

/** Con pocas cuentas afectadas se muestran los nombres en la fila: "Cuenta externa con privilegio
 *  elevado — Juan Pérez" informa, "1 cuenta" obliga a hacer clic para saber de quién se habla. */
const MAX_NOMBRES_EN_FILA = 3;

/** Cifra grande + etiqueta micro: la capa ejecutiva del módulo (números tabulares, sin color salvo
 *  cuando hay algo crítico). */
function Stat({ value, label, note, alarm }: {
  value: string; label: string; note?: string; alarm?: boolean;
}) {
  return (
    <div>
      <div className={`text-2xl font-semibold tabular-nums leading-none ${alarm ? "text-red-700 dark:text-red-400" : ""}`}>
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      {note && <div className="text-[11px] text-muted-foreground leading-tight">{note}</div>}
    </div>
  );
}

/**
 * Cola de trabajo del módulo: qué está mal, con la cifra de esta corrida y qué hacer.
 *
 * Tres alturas, porque doce filas del mismo peso con un botón cada una no dicen qué mirar primero:
 *  1. titular ejecutivo (críticos, accesos sin decidir, cuentas, cobertura de la evaluación);
 *  2. "Requiere acción": los hallazgos con cuentas concretas, por severidad, con las críticas y altas
 *     prominentes y las medias en una línea compacta;
 *  3. "Prácticas de administración": los hallazgos de umbral (sin principals), que son propiedades
 *     estructurales del tenant y proyectos de meses, no alertas — tono neutro, sin severidad.
 *
 * Al final, colapsado: informativas, no evaluables (falta el dato), evaluadas sin hallazgos y
 * aceptadas con justificación. Los cuatro son información, no trabajo pendiente.
 *
 * Las acciones ("Ver cuentas", "Aceptar") aparecen al pasar el mouse o al enfocar la fila, y quedan
 * fijas cuando la fila está expandida: siguen en el DOM (teclado y lectores de pantalla las
 * alcanzan), pero no forman un riel de botones que compite con el contenido.
 *
 * `onAccept` solo se recibe con permiso de edición. La aceptación es únicamente para los hallazgos de
 * umbral, que no tienen accesos individuales que marcar; el resto se resuelve con la decisión por
 * acceso en Asignaciones.
 */
export default function FindingsPanel({
  findings, accounts = [], pendientes = 0, cuentasUnicas = 0, onDrillDown, onAccept,
}: {
  findings: AccessFinding[];
  /** Para resolver los nombres de las cuentas afectadas (viene del mismo response). */
  accounts?: AccessAccount[];
  /** `kpis.pendientes_de_revisar`: accesos elevados que nadie decidió todavía. */
  pendientes?: number;
  /** `kpis.cuentas_unicas`. */
  cuentasUnicas?: number;
  onDrillDown: (finding: AccessFinding) => void;
  onAccept?: (finding: AccessFinding, note: string) => Promise<void>;
}) {
  const aceptados = findings.filter((f) => f.accepted);
  const abiertos = findings.filter((f) => !f.accepted && findingIsOpen(f));
  const noEvaluables = findings.filter((f) => !f.accepted && !f.evaluable);
  const limpios = findings.filter((f) => !f.accepted && f.evaluable && !findingIsOpen(f));

  // Las informativas (alcance de la corrida) no son ninguna de las dos especies: son contexto.
  const informativos = abiertos.filter((f) => f.severity === "informativa");
  const relevantes = abiertos.filter((f) => f.severity !== "informativa");
  const accionables = relevantes.filter(findingIsActionable);
  const practicas = relevantes.filter((f) => !findingIsActionable(f));

  const criticos = accionables.filter((f) => f.severity === "critica").length;
  const altos = accionables.filter((f) => f.severity === "alta").length;
  // Cobertura de la evaluación de ambientes: la cifra la calcula y redacta el backend en el detalle
  // del hallazgo de segregación; acá solo se lee para el titular.
  const cobertura = findings.find((f) => f.key === "sin_segregacion_ambientes")?.coverage_pct ?? null;

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts) m.set(a.principal_object_id, a.display_name || a.login || a.principal_object_id);
    return m;
  }, [accounts]);

  // La cuenta completa por id: la usa el modal de "Ver cuentas" para mostrar origen, privilegio y
  // último acceso sin volver a buscar en el array por cada fila.
  const accountById = useMemo(() => {
    const m = new Map<string, AccessAccount>();
    for (const a of accounts) m.set(a.principal_object_id, a);
    return m;
  }, [accounts]);

  /** Nombres de las cuentas afectadas, solo cuando son pocas (si no, la fila se vuelve un párrafo). */
  function nombresAfectados(f: AccessFinding): string | null {
    if (f.affected_principals.length === 0 || f.affected_principals.length > MAX_NOMBRES_EN_FILA) return null;
    return f.affected_principals.map((id) => nameById.get(id) ?? id).join(", ");
  }

  // El primer hallazgo que requiere acción arranca abierto: es lo que hay que leer hoy.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(accionables.length > 0 ? [accionables[0].key] : []),
  );
  const [showOtros, setShowOtros] = useState(false);

  // "Ver cuentas" abre un modal con las cuentas del hallazgo. Antes filtraba la tabla, que está
  // ~800px más abajo: la acción parecía no hacer nada hasta que bajabas a mirar.
  // El modal es una LISTA compacta, no la tabla de 6 columnas: la tabla en un modal centrado queda
  // apretada y obligaría a anidar diálogos cuando se quiere el detalle de una cuenta. Para trabajar
  // en serio (filtros, decisiones por lote) el botón del pie lleva a la pestaña Cuentas ya filtrada.
  const [verCuentas, setVerCuentas] = useState<AccessFinding | null>(null);
  // Aceptación con nota obligatoria: queda con responsable y fecha (la nota es el precio de bajar
  // un hallazgo de la cola).
  const [acceptTarget, setAcceptTarget] = useState<AccessFinding | null>(null);
  const [acceptNote, setAcceptNote] = useState("");
  const [accepting, setAccepting] = useState(false);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  async function confirmAccept() {
    if (!acceptTarget || !onAccept) return;
    const note = acceptNote.trim();
    if (!note) return;
    setAccepting(true);
    try {
      await onAccept(acceptTarget, note);
      setAcceptTarget(null);
      setAcceptNote("");
    } catch {
      // El error ya se notificó donde se hizo la llamada; el diálogo queda abierto con la nota.
    } finally {
      setAccepting(false);
    }
  }

  if (findings.length === 0) return null;

  /** Detalle + recomendación de un hallazgo expandido. */
  const detalle = (f: AccessFinding, pad = "px-4 pb-3 pl-11") => (
    <div className={`${pad} space-y-2 text-sm`}>
      <p className="text-muted-foreground">{f.detail}</p>
      <p className="rounded-lg bg-muted/60 px-3 py-2 border-l-2 border-primary">
        <span className="font-medium">Recomendación: </span>{f.recommendation}
      </p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Capa ejecutiva: en 30 segundos, cuánto pesa lo de hoy. */}
      <section aria-label="Resumen de la revisión"
        className="rounded-xl border bg-card px-4 py-3.5 flex flex-wrap items-start gap-x-10 gap-y-4">
        <Stat value={String(criticos)} label="Hallazgos críticos" alarm={criticos > 0}
          note={altos > 0 ? `${altos} de severidad alta` : undefined} />
        <Stat value={String(pendientes)} label="Accesos sin decidir"
          note="Elevados, sin decisión registrada" />
        <Stat value={String(cuentasUnicas)} label="Cuentas con acceso" />
        {/* Esta cifra NO es la cobertura de la revisión: es el porcentaje de asignaciones cuya
            suscripción permitió inferir el ambiente, y solo la usa la regla de segregación. Rotularla
            "del tenant evaluado" hacía leer que la revisión alcanzó una quinta parte del tenant. */}
        {cobertura !== null && (
          <Stat value={`${cobertura}%`} label="Asignaciones con ambiente inferido"
            note="Solo afecta a la regla de segregación de ambientes" />
        )}
        <p className="ml-auto text-xs text-muted-foreground max-w-[22ch] text-right">
          {abiertos.length === 0
            ? "Sin hallazgos abiertos en esta corrida"
            : `${abiertos.length} de ${findings.length} reglas con hallazgos`}
        </p>
      </section>

      {accionables.length > 0 && (
        <section aria-label="Requiere acción" className="rounded-xl border bg-card">
          <header className="px-4 py-2.5 border-b flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider">Requiere acción</h3>
            <span className="text-xs text-muted-foreground">
              Cuentas concretas: se corrigen en esta revisión
            </span>
          </header>
          <div className="divide-y">
            {accionables.map((f) => {
              const open = expanded.has(f.key);
              const fuerte = f.severity === "critica" || f.severity === "alta";
              const nombres = nombresAfectados(f);
              return (
                <div key={f.key}>
                  <div className={`group flex items-center gap-3 px-4 hover:bg-muted/40 transition-colors ${fuerte ? "py-3" : "py-1.5"}`}>
                    <button type="button" onClick={() => toggle(f.key)} aria-expanded={open}
                      className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer">
                      <span className="text-muted-foreground shrink-0">
                        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </span>
                      <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${severityChip(f.severity)}`}>
                        {severityLabel(f.severity)}
                      </span>
                      <span className={`truncate ${fuerte ? "text-sm font-semibold" : "text-xs font-medium"}`}>
                        {f.title}
                      </span>
                      {nombres && (
                        <span className="text-xs truncate" title={nombres}>— {nombres}</span>
                      )}
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {f.affected_accounts > 0 && cuentasLabel(f.affected_accounts)}
                        {f.affected_accounts > 0 && f.affected_assignments > 0 && " · "}
                        {f.affected_assignments > 0 && asignacionesLabel(f.affected_assignments)}
                      </span>
                    </button>
                    <div className={`shrink-0 transition-opacity ${open ? "" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100"}`}>
                      <Button variant="outline" size="sm" className="h-7" onClick={() => setVerCuentas(f)}>
                        Ver cuentas
                      </Button>
                    </div>
                  </div>
                  {open && detalle(f)}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {practicas.length > 0 && (
        <section aria-label="Prácticas de administración" className="rounded-xl border bg-card">
          <header className="px-4 py-2.5 border-b flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Prácticas de administración
            </h3>
            <span className="text-xs text-muted-foreground">
              Propiedades del tenant: se corrigen por proyecto, no en esta revisión
            </span>
          </header>
          <div className="divide-y">
            {practicas.map((f) => {
              const open = expanded.has(f.key);
              // El total es lo que falta resolver: el backend cuenta lo que sigue incumpliendo la
              // práctica, así que el avance parte de cero y sube cuando la cifra baja entre corridas.
              const unidad = f.affected_assignments > 0
                ? asignacionesLabel(f.affected_assignments)
                : cuentasLabel(f.affected_accounts);
              return (
                <div key={f.key} className="group px-4 py-2.5 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => toggle(f.key)} aria-expanded={open}
                      className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer">
                      <span className="text-muted-foreground shrink-0">
                        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </span>
                      <span className="truncate text-sm font-medium">{f.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {unidad} por corregir
                      </span>
                    </button>
                    {onAccept && (
                      <div className={`shrink-0 transition-opacity ${open ? "" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100"}`}>
                        <Button variant="outline" size="sm" className="h-7"
                          onClick={() => { setAcceptTarget(f); setAcceptNote(""); }}>
                          Aceptar
                        </Button>
                      </div>
                    )}
                  </div>
                  {open && <div className="mt-2">{detalle(f, "pl-6 pb-1")}</div>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {(informativos.length > 0 || noEvaluables.length > 0 || limpios.length > 0 || aceptados.length > 0) && (
        <div className="rounded-xl border bg-card px-4 py-2.5">
          <button type="button" onClick={() => setShowOtros((v) => !v)} aria-expanded={showOtros}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1.5">
            {showOtros ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {[
              informativos.length > 0 ? plural(informativos.length, "informativa", "informativas") : null,
              noEvaluables.length > 0 ? `${noEvaluables.length} sin datos para evaluar` : null,
              limpios.length > 0
                ? plural(limpios.length, "evaluada sin hallazgos", "evaluadas sin hallazgos") : null,
              aceptados.length > 0
                ? plural(aceptados.length, "aceptada con justificación", "aceptadas con justificación") : null,
            ].filter(Boolean).join(" · ")}
          </button>

          {showOtros && (
            <ul className="mt-2 space-y-1.5">
              {informativos.map((f) => (
                <li key={f.key} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span><span className="font-medium">{f.title}</span> — {f.detail}</span>
                </li>
              ))}
              {noEvaluables.map((f) => (
                <li key={f.key} className="flex items-start gap-2 text-xs text-muted-foreground"
                  title={f.not_evaluable_reason ?? undefined}>
                  <CircleHelp className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span><span className="font-medium">{f.title}</span> — {f.not_evaluable_reason}</span>
                </li>
              ))}
              {limpios.map((f) => (
                <li key={f.key} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CircleCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600" />
                  <span><span className="font-medium">{f.title}</span> — {f.detail}</span>
                </li>
              ))}
              {aceptados.map((f) => (
                <li key={f.key} className="flex items-start gap-2 text-xs text-muted-foreground"
                  title={f.accepted_note ?? undefined}>
                  <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                  <span>
                    <span className="font-medium">{f.title}</span>{" "}
                    {`— aceptado por ${f.accepted_by || "un usuario"} el ${dateOrDash(f.accepted_at)}${f.accepted_note ? `: ${f.accepted_note}` : ""}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Dialog open={verCuentas !== null} onOpenChange={(o) => { if (!o) setVerCuentas(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{verCuentas?.title}</DialogTitle>
          </DialogHeader>
          {verCuentas && (() => {
            const afectadas = verCuentas.affected_principals
              .map((id) => accountById.get(id))
              .filter((a): a is AccessAccount => a !== undefined);
            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{verCuentas.detail}</p>
                {afectadas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Las cuentas de este hallazgo no están en la corrida actual.
                  </p>
                ) : (
                  <div className="rounded-lg border divide-y">
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-3 py-1.5 text-[11px]
                      font-medium uppercase tracking-wide text-muted-foreground">
                      <span>Cuenta</span><span>Origen</span><span>Privilegio</span><span>Último acceso</span>
                    </div>
                    {afectadas.map((a) => (
                      <div key={a.principal_object_id}
                        className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-3 py-2 text-sm items-center">
                        <span className="truncate" title={a.display_name ?? a.principal_object_id}>
                          {a.display_name ?? <span className="font-mono text-xs">{a.principal_object_id}</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">{externalLabel(a.is_external)}</span>
                        <span className="text-xs">{roleClassShortLabel(accountPrivilege(a))}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {dateOrDash(a.last_sign_in)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setVerCuentas(null)}>Cerrar</Button>
                  <Button onClick={() => { onDrillDown(verCuentas); setVerCuentas(null); }}>
                    Abrir en la pestaña Cuentas
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={acceptTarget !== null} onOpenChange={(o) => { if (!o) setAcceptTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Aceptar el hallazgo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">{acceptTarget?.title}</p>
            <p className="text-sm text-muted-foreground">
              La nota es obligatoria: queda registrada con tu usuario y la fecha. El hallazgo sale de
              la lista de abiertos y se muestra como aceptado en las corridas siguientes.
            </p>
            <Textarea value={acceptNote} onChange={(e) => setAcceptNote(e.target.value)} rows={4}
              aria-label="Nota de aceptación"
              placeholder="Por qué este hallazgo es aceptable en este cliente…" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAcceptTarget(null)}>Cancelar</Button>
              <Button disabled={!acceptNote.trim() || accepting} onClick={confirmAccept}>
                Aceptar hallazgo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
