import { useState } from "react";
import { ChevronDown, ChevronRight, CircleCheck, CircleHelp, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { severityChip, severityLabel, findingIsOpen } from "@/lib/accessReview";
import type { AccessFinding } from "@/types";

function dateOrDash(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("es-EC") : "—";
}

/**
 * Cola de trabajo del módulo: qué está mal, con la cifra de esta corrida y qué hacer.
 * Cuatro grupos, en este orden: hallazgos abiertos (por severidad), y colapsados los no evaluables
 * (falta el dato), los evaluados sin hallazgos y los aceptados con justificación. Los tres últimos
 * son información, no trabajo pendiente.
 *
 * `onAccept` solo se recibe con permiso de edición: sin él no se ofrece aceptar nada. La aceptación
 * es únicamente para los hallazgos de umbral (sin principals afectados), que no tienen accesos
 * individuales que marcar; el resto se resuelve con la decisión por acceso en Asignaciones.
 */
export default function FindingsPanel({ findings, onDrillDown, onAccept }: {
  findings: AccessFinding[];
  onDrillDown: (finding: AccessFinding) => void;
  onAccept?: (finding: AccessFinding, note: string) => Promise<void>;
}) {
  const aceptados = findings.filter((f) => f.accepted);
  const abiertos = findings.filter((f) => !f.accepted && findingIsOpen(f));
  const noEvaluables = findings.filter((f) => !f.accepted && !f.evaluable);
  const limpios = findings.filter((f) => !f.accepted && f.evaluable && !findingIsOpen(f));

  // El primer crítico arranca abierto: es lo que hay que leer hoy.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(abiertos.length > 0 ? [abiertos[0].key] : []),
  );
  const [showOtros, setShowOtros] = useState(false);

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

  return (
    <div className="rounded-xl border bg-card divide-y">
      <div className="px-4 py-2.5 flex items-center gap-2">
        <span className="text-sm font-semibold">Hallazgos</span>
        <span className="text-xs text-muted-foreground">
          {abiertos.length === 0
            ? "Sin hallazgos abiertos en esta corrida"
            : `${abiertos.length} de ${findings.length} reglas con hallazgos`}
        </span>
      </div>

      {abiertos.map((f) => {
        const open = expanded.has(f.key);
        // Los hallazgos de umbral no tienen accesos individuales que marcar: su salida es aceptarlos.
        const canAccept = !!onAccept && f.affected_principals.length === 0;
        return (
          <div key={f.key} className="px-4 py-3">
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={() => toggle(f.key)} aria-expanded={open}
                aria-label={open ? `Ocultar detalle de ${f.title}` : `Ver detalle de ${f.title}`}
                className="text-muted-foreground hover:text-foreground cursor-pointer">
                {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${severityChip(f.severity)}`}>
                {severityLabel(f.severity)}
              </span>
              <button type="button" onClick={() => toggle(f.key)}
                className="text-sm font-medium text-left hover:underline cursor-pointer">
                {f.title}
              </button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {f.affected_accounts > 0 && `${f.affected_accounts} cuentas`}
                {f.affected_accounts > 0 && f.affected_assignments > 0 && " · "}
                {f.affected_assignments > 0 && `${f.affected_assignments} asignaciones`}
              </span>
              {f.affected_principals.length > 0 && (
                <Button variant="outline" size="sm" className="h-7 ml-auto"
                  onClick={() => onDrillDown(f)}>
                  Ver cuentas
                </Button>
              )}
              {canAccept && (
                <Button variant="outline" size="sm" className="h-7 ml-auto"
                  onClick={() => { setAcceptTarget(f); setAcceptNote(""); }}>
                  Aceptar
                </Button>
              )}
            </div>
            {open && (
              <div className="mt-2 ml-7 space-y-2 text-sm">
                <p className="text-muted-foreground">{f.detail}</p>
                <p className="rounded-lg bg-muted/60 px-3 py-2 border-l-2 border-primary">
                  <span className="font-medium">Recomendación: </span>{f.recommendation}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {(noEvaluables.length > 0 || limpios.length > 0 || aceptados.length > 0) && (
        <div className="px-4 py-2.5">
          <button type="button" onClick={() => setShowOtros((v) => !v)} aria-expanded={showOtros}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1.5">
            {showOtros ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {[
              noEvaluables.length > 0 ? `${noEvaluables.length} sin datos para evaluar` : null,
              limpios.length > 0 ? `${limpios.length} evaluadas sin hallazgos` : null,
              aceptados.length > 0 ? `${aceptados.length} aceptadas con justificación` : null,
            ].filter(Boolean).join(" · ")}
          </button>

          {showOtros && (
            <ul className="mt-2 space-y-1.5">
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
