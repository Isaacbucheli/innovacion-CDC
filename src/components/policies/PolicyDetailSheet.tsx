import { ExternalLink } from "lucide-react";
import type { Policy } from "@/types";
import { EFFECT_META, normalizeEffect } from "@/lib/effect";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import CodeBlock from "@/components/CodeBlock";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-primary mb-1">{label}</div>
      <div className="text-sm whitespace-pre-wrap leading-relaxed">{value}</div>
    </div>
  );
}

function Code({ label, code }: { label: string; code: string | null }) {
  if (!code) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-primary mb-1">{label}</div>
      <CodeBlock code={code} />
    </div>
  );
}

export default function PolicyDetailSheet({ policy, open, onOpenChange }: {
  policy: Policy | null; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const meta = policy ? EFFECT_META[normalizeEffect(policy.recommended_effect)] : null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{policy?.name}</SheetTitle></SheetHeader>
        {policy && (
          <div className="space-y-4 mt-4">
            <div className="flex gap-2 flex-wrap text-xs">
              {/* Badge con el texto original del efecto; color según efecto normalizado. */}
              {policy.recommended_effect && <span className={`px-2.5 py-0.5 rounded-md ${meta!.badge}`}>{policy.recommended_effect}</span>}
              {policy.mode && <span className="px-2 py-0.5 rounded-full bg-secondary">{policy.mode}</span>}
              {policy.category && <span className="px-2 py-0.5 rounded-full bg-secondary">{policy.category}</span>}
              {policy.policy_type && <span className="px-2 py-0.5 rounded-full bg-secondary">{policy.policy_type}</span>}
            </div>
            <Field label="Descripción" value={policy.description} />
            <Field label="Objetivo / beneficio" value={policy.objective} />
            <Field label="Scope recomendado" value={policy.recommended_scope} />
            <Field label="Rollout recomendado" value={policy.rollout} />
            <Field label="Riesgo / impacto" value={policy.risk} />
            <Field label="Parámetros clave" value={policy.key_parameters} />
            <Code label="Parámetros ejemplo" code={policy.example_parameters} />
            <Code label="Azure CLI" code={policy.azure_cli} />
            <Code label="PowerShell" code={policy.powershell} />
            <Field label="Notas de script" value={policy.script_notes} />
            {policy.official_source && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-primary mb-1">Fuente oficial</div>
                <a
                  href={policy.official_source}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary underline underline-offset-2 break-all inline-flex items-center gap-1"
                >
                  {policy.official_source}
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
