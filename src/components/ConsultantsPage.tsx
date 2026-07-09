import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppShell from "@/components/AppShell";
import AssignmentsView from "@/components/consultants/AssignmentsView";
import AssignmentDetailSheet from "@/components/consultants/AssignmentDetailSheet";
import AssignmentFormDialog from "@/components/consultants/AssignmentFormDialog";
import LoadView from "@/components/consultants/LoadView";
import PeopleView from "@/components/consultants/PeopleView";
import ReassignDialog from "@/components/consultants/ReassignDialog";
import ConfirmDelete from "@/components/ConfirmDelete";
import { useConsultants } from "@/hooks/useConsultants";
import { getRole } from "@/lib/auth";
import { deleteAssignment } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import type { ConsultantAssignment } from "@/types";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

// Asignar/reasignar es decisión gerencial: mutaciones y pestañas Carga/Personas
// SOLO para rol admin exacto (no canEdit: consultor y lector solo leen Asignaciones).
export default function ConsultantsPage({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const { assignments, people, loading, error, reload } = useConsultants();
  const isAdmin = getRole() === "admin";
  const [tab, setTab] = useState("assignments");
  const [detail, setDetail] = useState<ConsultantAssignment | null>(null);
  // undefined = diálogo cerrado, null = crear nueva, objeto = editar
  const [editAssignment, setEditAssignment] = useState<ConsultantAssignment | null | undefined>(undefined);
  const [delAssignment, setDelAssignment] = useState<ConsultantAssignment | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!isAdmin || !delAssignment) return;
    try {
      await deleteAssignment(delAssignment.assignment_id);
      toast.success(`Asignación de "${delAssignment.client_name}" eliminada.`);
      setDelAssignment(null);
      reload();
    } catch (e) { toast.error(msg(e)); }
  }, [isAdmin, delAssignment, reload]);

  return (
    <AppShell
      title="Asignación de consultores"
      subtitle="Quién atiende cada cliente y servicio: principales, backups, carga y reasignación."
      active="consultants"
      onNavigate={onNavigate}
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="assignments">Asignaciones</TabsTrigger>
          {isAdmin && <TabsTrigger value="load">Carga</TabsTrigger>}
          {isAdmin && <TabsTrigger value="people">Personas</TabsTrigger>}
        </TabsList>

        <TabsContent value="assignments">
          {loading ? <Skeleton className="h-40 w-full mt-4" />
            : error ? <p className="text-destructive py-6">{error}</p>
            : <AssignmentsView
                assignments={assignments}
                people={people}
                isAdmin={isAdmin}
                onOpen={(a) => setDetail(a)}
                onNew={() => { if (isAdmin) setEditAssignment(null); }}
                onEdit={(a) => { if (isAdmin) setEditAssignment(a); }}
                onDelete={(a) => { if (isAdmin) setDelAssignment(a); }} />}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="load">
            {loading ? <Skeleton className="h-40 w-full mt-4" />
              : error ? <p className="text-destructive py-6">{error}</p>
              : <LoadView assignments={assignments} people={people} onReassign={() => setReassignOpen(true)} />}
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="people">
            {loading ? <Skeleton className="h-40 w-full mt-4" />
              : error ? <p className="text-destructive py-6">{error}</p>
              : <PeopleView people={people} onChanged={reload} />}
          </TabsContent>
        )}
      </Tabs>

      <AssignmentDetailSheet assignment={detail} open={!!detail} onOpenChange={(o) => !o && setDetail(null)} />

      <AssignmentFormDialog
        open={editAssignment !== undefined}
        assignment={editAssignment ?? null}
        people={people}
        onOpenChange={(o) => !o && setEditAssignment(undefined)}
        onSaved={reload} />

      <ConfirmDelete
        open={!!delAssignment}
        label={delAssignment ? `${delAssignment.client_name}${delAssignment.service ? ` · ${delAssignment.service}` : ""}` : ""}
        onOpenChange={(o) => !o && setDelAssignment(null)}
        onConfirm={handleDelete} />

      <ReassignDialog
        open={reassignOpen}
        people={people}
        onOpenChange={setReassignOpen}
        onDone={reload} />
    </AppShell>
  );
}
