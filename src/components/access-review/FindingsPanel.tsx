import { useState } from "react";
import { ChevronDown, ChevronRight, CircleCheck, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { severityChip, severityLabel, findingIsOpen } from "@/lib/accessReview";
import type { AccessFinding } from "@/types";

/**
 * Cola de trabajo del módulo: qué está mal, con la cifra de esta corrida y qué hacer.
 * Tres grupos, en este orden: hallazgos abiertos (por severidad), no evaluables (falta el dato) y
 * evaluados sin hallazgos. Los dos últimos van colapsados: son información, no trabajo pendiente.
 */
export default function FindingsPanel({ findings, onDrillDown }: {
  findings: AccessFinding[];
  onDrillDown: (finding: AccessFinding) => void;
}) {
  const abiertos = findings.filter(findingIsOpen);
  const noEvaluables = findings.filter((f) => !f.evaluable);
  const limpios = findings.filter((f) => f.evaluable && !findingIsOpen(f));

  // El primer crítico arranca abierto: es lo que hay que leer hoy.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(abiertos.length > 0 ? [abiertos[0].key] : []),
  );
  const [showOtros, setShowOtros] = useState(false);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
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

      {(noEvaluables.length > 0 || limpios.length > 0) && (
        <div className="px-4 py-2.5">
          <button type="button" onClick={() => setShowOtros((v) => !v)} aria-expanded={showOtros}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1.5">
            {showOtros ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {noEvaluables.length > 0 && `${noEvaluables.length} sin datos para evaluar`}
            {noEvaluables.length > 0 && limpios.length > 0 && " · "}
            {limpios.length > 0 && `${limpios.length} evaluadas sin hallazgos`}
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
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
