import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Person } from "@/types";
import { deletePerson } from "@/lib/api";
import SearchInput from "@/components/SearchInput";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import DataTablePagination from "@/components/DataTablePagination";
import ConfirmDelete from "@/components/ConfirmDelete";
import PersonFormDialog, { personTypeLabel } from "@/components/consultants/PersonFormDialog";
import { usePagedRows } from "@/hooks/usePagedRows";
import { Button } from "@/components/ui/button";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }
const chip = (cls: string, text: React.ReactNode) => <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{text}</span>;
const OK = "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200";
const NEUTRAL = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
const typeChipCls = (t: string) =>
  t === "consultor"
    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
    : t === "coordinador" ? "bg-primary/15 text-primary" : NEUTRAL;

// Directorio de personas BIT (solo admin): CRUD sobre consultores/coordinadores/comerciales.
export default function PeopleView({ people, onChanged }: {
  people: Person[];
  onChanged: () => void;
}) {
  const [q, setQ] = useState("");
  // undefined = diálogo cerrado, null = crear nueva, objeto = editar
  const [editPerson, setEditPerson] = useState<Person | null | undefined>(undefined);
  const [delPerson, setDelPerson] = useState<Person | null>(null);

  const handleDelete = useCallback(async () => {
    if (!delPerson) return;
    try {
      await deletePerson(delPerson.person_id);
      toast.success(`Persona "${delPerson.name}" desactivada.`);
      setDelPerson(null);
      onChanged();
    } catch (e) { toast.error(msg(e)); }
  }, [delPerson, onChanged]);

  const s = q.trim().toLowerCase();
  const rows = s
    ? people.filter((p) => `${p.name} ${p.email ?? ""} ${p.person_type}`.toLowerCase().includes(s))
    : people;
  const { table, pageRows } = usePagedRows(rows);

  const cols: SimpleCol<Person>[] = [
    { key: "name", label: "Nombre", render: (p) => <span className="font-medium">{p.name}</span> },
    { key: "email", label: "Correo", render: (p) => p.email ?? "" },
    { key: "person_type", label: "Tipo", render: (p) => chip(typeChipCls(p.person_type), personTypeLabel(p.person_type)) },
    { key: "is_active", label: "Activo", render: (p) => chip(p.is_active ? OK : NEUTRAL, p.is_active ? "Sí" : "No") },
    { key: "acc", label: "", render: (p) => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Editar" onClick={() => setEditPerson(p)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Eliminar" onClick={() => setDelPerson(p)}>
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>
    ) },
  ];

  return (
    <div>
      <div className="flex gap-2 flex-wrap items-center mb-4">
        <SearchInput
          className="flex-1 min-w-[200px] max-w-sm"
          placeholder="Buscar persona…"
          value={q}
          onChange={setQ}
        />
        <span className="text-sm text-muted-foreground ml-auto">{rows.length} de {people.length}</span>
        <Button size="sm" onClick={() => setEditPerson(null)}><Plus className="w-4 h-4 mr-1" />Nueva persona</Button>
      </div>

      <SimpleTable cols={cols} rows={pageRows} empty="Sin personas en el directorio." />
      <DataTablePagination table={table} />

      <PersonFormDialog
        open={editPerson !== undefined}
        person={editPerson ?? null}
        onOpenChange={(o) => !o && setEditPerson(undefined)}
        onSaved={onChanged}
      />

      <ConfirmDelete
        open={!!delPerson}
        label={delPerson?.name ?? ""}
        title="¿Desactivar del directorio?"
        onOpenChange={(o) => !o && setDelPerson(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
