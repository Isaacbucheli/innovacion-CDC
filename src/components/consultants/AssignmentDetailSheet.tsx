import type { ConsultantAssignment, PersonRef } from "@/types";
import { CATEGORY_META, normalizeCategory } from "@/lib/category";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

// Campo de detalle: las celdas del Excel origen son multilínea (contactos, cuentas),
// por eso whitespace-pre-line conserva los saltos de línea.
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-primary mb-1">{label}</div>
      <div className="text-sm whitespace-pre-line leading-relaxed">{value}</div>
    </div>
  );
}

function People({ label, refs }: { label: string; refs: PersonRef[] }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-primary mb-1">{label}</div>
      {refs.length === 0 ? (
        <span className="text-sm text-muted-foreground">—</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {refs.map((r) => (
            <Badge key={r.person_id} variant="outline" className="font-normal">{r.name}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-background p-3 space-y-3">
      <div className="text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
}

export default function AssignmentDetailSheet({ assignment, open, onOpenChange }: {
  assignment: ConsultantAssignment | null; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const meta = assignment ? CATEGORY_META[normalizeCategory(assignment.category)] : null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{assignment?.client_name}</SheetTitle></SheetHeader>
        {assignment && (
          <div className="space-y-4 mt-4">
            <div className="flex gap-2 flex-wrap text-xs">
              {/* Badge con el texto original de la categoría; color según categoría normalizada. */}
              {assignment.category && <span className={`px-2.5 py-0.5 rounded-md ${meta!.badge}`}>{assignment.category}</span>}
              {assignment.service && <span className="px-2 py-0.5 rounded-full bg-secondary">{assignment.service}</span>}
              {assignment.country && <span className="px-2 py-0.5 rounded-full bg-secondary">{assignment.country}</span>}
              {assignment.status && <span className="px-2 py-0.5 rounded-full bg-secondary">{assignment.status}</span>}
            </div>

            <Section title="Servicio">
              <Field label="Servicio" value={assignment.service} />
              <Field label="Categoría" value={assignment.category} />
              <Field label="País" value={assignment.country} />
              <Field label="Estado" value={assignment.status} />
              <Field label="Bases de datos" value={assignment.databases} />
            </Section>

            <Section title="Personas">
              <People label="Principales" refs={assignment.principals} />
              <People label="Backups" refs={assignment.backups} />
              <Field label="Coordinador" value={assignment.coordinator?.name} />
              <Field label="Comercial" value={assignment.comercial?.name} />
            </Section>

            <Section title="Acceso">
              <Field label="Cuentas de acceso" value={assignment.access_accounts} />
              <Field label="Rol de la cuenta" value={assignment.account_role} />
              <Field label="Lighthouse" value={assignment.lighthouse} />
            </Section>

            <Section title="Cliente">
              <Field label="Contacto" value={assignment.client_contact_name} />
              <Field label="Teléfono" value={assignment.client_contact_phone} />
              <Field label="Correo" value={assignment.client_contact_email} />
              <Field label="Fecha fin contrato" value={assignment.contract_end} />
            </Section>

            {assignment.observations && (
              <Section title="Observaciones">
                <div className="text-sm whitespace-pre-line leading-relaxed">{assignment.observations}</div>
              </Section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
