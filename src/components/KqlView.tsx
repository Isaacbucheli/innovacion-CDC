import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { KqlQuery } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import CodeBlock from "@/components/CodeBlock";

export default function KqlView({ kql, canEdit, onNew, onEdit, onDelete }: {
  kql: KqlQuery[]; canEdit: boolean; onNew: () => void; onEdit: (k: KqlQuery) => void; onDelete: (k: KqlQuery) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<KqlQuery | null>(null);
  const rows = kql.filter((k) => `${k.name} ${k.description ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="py-4">
      <div className="flex gap-2 items-center mb-4">
        <Input className="max-w-sm" placeholder="Buscar consulta…" value={q} onChange={(e) => setQ(e.target.value)} />
        {canEdit && <Button onClick={onNew} className="ml-auto"><Plus className="w-4 h-4 mr-1" />Nueva consulta</Button>}
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((k) => (
          <div key={k.kql_id} className="flex items-center gap-2 bg-background border rounded-lg p-3">
            <button className="flex-1 text-left min-w-0" onClick={() => setOpen(k)}>
              <div className="text-sm font-medium">{k.name}</div>
              <div className="text-xs text-muted-foreground truncate">{k.description}</div>
            </button>
            {canEdit && (<>
              <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => onEdit(k)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" aria-label="Eliminar" onClick={() => onDelete(k)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </>)}
          </div>
        ))}
      </div>
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{open?.name}</SheetTitle></SheetHeader>
          {open && <div className="space-y-3 mt-4">
            {open.description && <p className="text-sm text-muted-foreground">{open.description}</p>}
            {open.kql_query && <CodeBlock code={open.kql_query} />}
          </div>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
