import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { KqlQuery } from "@/types";
import SearchInput from "@/components/SearchInput";
import DataTablePagination from "@/components/DataTablePagination";
import { usePagedRows } from "@/hooks/usePagedRows";
import { Button } from "@/components/ui/button";

export default function KqlView({ kql, canEdit, onOpen, onNew, onEdit, onDelete }: {
  kql: KqlQuery[]; canEdit: boolean;
  onOpen: (k: KqlQuery) => void; onNew: () => void; onEdit: (k: KqlQuery) => void; onDelete: (k: KqlQuery) => void;
}) {
  const [q, setQ] = useState("");
  const rows = kql.filter((k) => `${k.name} ${k.description ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  const { table, pageRows } = usePagedRows(rows);
  return (
    <div className="py-4">
      <div className="flex gap-2 items-center mb-4">
        <SearchInput className="max-w-sm" placeholder="Buscar consulta…" value={q} onChange={setQ} />
        {canEdit && <Button onClick={onNew} className="ml-auto"><Plus className="w-4 h-4 mr-1" />Nueva consulta</Button>}
      </div>
      <div className="flex flex-col gap-2">
        {pageRows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sin consultas que coincidan.</p>
        ) : pageRows.map((k) => (
          <div key={k.kql_id} className="flex items-center gap-2 bg-background border rounded-lg p-3">
            <button className="flex-1 text-left min-w-0" onClick={() => onOpen(k)}>
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
      <DataTablePagination table={table} />
    </div>
  );
}
