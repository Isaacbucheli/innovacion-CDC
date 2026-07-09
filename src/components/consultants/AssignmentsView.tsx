import { useMemo, useState } from "react";
import { Download, Plus } from "lucide-react";
import type { ConsultantAssignment, Person } from "@/types";
import { assignmentsToCsv } from "@/lib/csv";
import { useCountUp } from "@/lib/useCountUp";
import SearchInput from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import AssignmentsDataTable from "@/components/consultants/AssignmentsDataTable";

function downloadCsv(csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "asignacion-consultores.csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function Stat({ label, value }: { label: string; value: number }) {
  const n = useCountUp(value);
  return (
    <div className="rounded-lg bg-background border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{n}</div>
    </div>
  );
}

function filterAssignments(assignments: ConsultantAssignment[], q: string): ConsultantAssignment[] {
  const s = q.trim().toLowerCase();
  if (!s) return assignments;
  return assignments.filter((a) =>
    [
      a.client_name, a.service, a.category, a.country, a.status,
      a.principals.map((p) => p.name).join(" "),
      a.backups.map((p) => p.name).join(" "),
      a.coordinator?.name, a.comercial?.name,
    ].map((v) => v ?? "").join(" ").toLowerCase().includes(s));
}

export default function AssignmentsView({ assignments, people, isAdmin, onOpen, onNew, onEdit, onDelete }: {
  assignments: ConsultantAssignment[]; people: Person[]; isAdmin: boolean;
  onOpen: (a: ConsultantAssignment) => void; onNew: () => void;
  onEdit: (a: ConsultantAssignment) => void; onDelete: (a: ConsultantAssignment) => void;
}) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => filterAssignments(assignments, q), [assignments, q]);

  const clients = new Set(assignments.map((a) => a.client_name)).size;
  const consultants = people.filter((p) => p.person_type === "consultor" && p.is_active).length;
  const services = new Set(assignments.map((a) => a.service).filter(Boolean)).size;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Asignaciones" value={assignments.length} />
        <Stat label="Clientes únicos" value={clients} />
        <Stat label="Consultores activos" value={consultants} />
        <Stat label="Servicios" value={services} />
      </div>
      <div className="flex gap-2 flex-wrap items-center mb-4">
        <SearchInput
          className="flex-1 min-w-[200px] max-w-sm"
          placeholder="Buscar asignación…"
          value={q}
          onChange={setQ}
        />
        <span className="text-sm text-muted-foreground ml-auto">{rows.length} de {assignments.length}</span>
        <Button variant="outline" size="sm" onClick={() => downloadCsv(assignmentsToCsv(rows))}>
          <Download className="w-4 h-4 mr-1" />Exportar CSV
        </Button>
        {isAdmin && <Button size="sm" onClick={onNew}><Plus className="w-4 h-4 mr-1" />Nueva asignación</Button>}
      </div>
      <AssignmentsDataTable assignments={rows} isAdmin={isAdmin} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}
