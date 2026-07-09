import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import type { Policy } from "@/types";
import { EFFECT_META, normalizeEffect } from "@/lib/effect";
import { Button } from "@/components/ui/button";

export default function PolicyCard({ policy, canEdit, onOpen, onEdit, onDelete }: {
  policy: Policy; canEdit: boolean; onOpen: (p: Policy) => void; onEdit: (p: Policy) => void; onDelete: (p: Policy) => void;
}) {
  const meta = EFFECT_META[normalizeEffect(policy.recommended_effect)];
  const chip = (v: string | null) => v ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{v}</span> : null;
  return (
    <div className="flex bg-background border rounded-lg overflow-hidden hover:border-primary/40 transition-colors">
      <div className="w-1" style={{ background: meta.accent }} />
      <button className="flex-1 text-left p-4 min-w-0" onClick={() => onOpen(policy)}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium flex-1 min-w-0">{policy.name}</span>
          {/* El badge muestra el texto original del efecto (ej. "Deny o Audit"); el color sale del efecto normalizado. */}
          <span className={`text-xs px-2.5 py-0.5 rounded-md ${meta.badge}`}>{policy.recommended_effect || meta.label}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex gap-1.5 flex-wrap mt-2">{chip(policy.category)}{chip(policy.mode)}{chip(policy.recommended_scope)}</div>
      </button>
      {canEdit && (
        <div className="flex items-center gap-1 pr-3">
          <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => onEdit(policy)}><Pencil className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Eliminar" onClick={() => onDelete(policy)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
        </div>
      )}
    </div>
  );
}
