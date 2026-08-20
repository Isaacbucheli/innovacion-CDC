import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import type { AssignmentWrite, ConsultantAssignment, Person } from "@/types";
import { createAssignment, updateAssignment } from "@/lib/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import PersonMultiSelect from "@/components/consultants/PersonMultiSelect";

// Select nativo con el mismo estilo del app (patrón de ColumnFilterPopover):
// se integra directo con react-hook-form y evita portales dentro del diálogo.
const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// "" (opción "Ninguno") → null; el value de <option> siempre es string → number.
const optionalPersonId = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().nullable(),
);

const schema = z.object({
  client_name: z.string().min(1, "El cliente es obligatorio").max(200, "Máximo 200 caracteres"),
  service: z.string().nullish(),
  category: z.string().nullish(),
  databases: z.string().nullish(),
  country: z.string().nullish(),
  status: z.string().nullish(),
  access_accounts: z.string().nullish(),
  account_role: z.string().nullish(),
  lighthouse: z.string().nullish(),
  client_contact_name: z.string().nullish(),
  client_contact_phone: z.string().nullish(),
  client_contact_email: z.string().nullish(),
  contract_end: z.string().nullish(),
  observations: z.string().nullish(),
  principal_ids: z.array(z.number()).min(1, "Selecciona al menos un consultor principal"),
  backup_ids: z.array(z.number()),
  coordinator_id: optionalPersonId,
  comercial_id: optionalPersonId,
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

function defaults(assignment: ConsultantAssignment | null): FormInput {
  if (!assignment) {
    return { client_name: "", status: "ACTIVO", principal_ids: [], backup_ids: [], coordinator_id: null, comercial_id: null };
  }
  return {
    client_name: assignment.client_name,
    service: assignment.service,
    category: assignment.category,
    databases: assignment.databases,
    country: assignment.country,
    status: assignment.status,
    access_accounts: assignment.access_accounts,
    account_role: assignment.account_role,
    lighthouse: assignment.lighthouse,
    client_contact_name: assignment.client_contact_name,
    client_contact_phone: assignment.client_contact_phone,
    client_contact_email: assignment.client_contact_email,
    contract_end: assignment.contract_end,
    observations: assignment.observations,
    principal_ids: assignment.principals.map((p) => p.person_id),
    backup_ids: assignment.backups.map((p) => p.person_id),
    coordinator_id: assignment.coordinator?.person_id ?? null,
    comercial_id: assignment.comercial?.person_id ?? null,
  };
}

export default function AssignmentFormDialog({ open, assignment, people, onOpenChange, onSaved }: {
  open: boolean;
  assignment: ConsultantAssignment | null; // null = crear
  people: Person[];
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema) });
  const [submitError, setSubmitError] = useState("");
  useEffect(() => { setSubmitError(""); reset(defaults(assignment)); }, [assignment, open, reset]);

  // Solo personas activas del tipo que corresponde a cada rol.
  const consultants = people.filter((p) => p.person_type === "consultor" && p.is_active);
  const coordinators = people.filter((p) => p.person_type === "coordinador" && p.is_active);
  const comercials = people.filter((p) => p.person_type === "comercial" && p.is_active);

  const principalIds = (watch("principal_ids") ?? []) as number[];
  const backupIds = (watch("backup_ids") ?? []) as number[];

  async function onSubmit(v: FormValues) {
    setSubmitError("");
    const { principal_ids, backup_ids, coordinator_id, comercial_id, ...scalars } = v;
    const payload: AssignmentWrite = {
      ...Object.fromEntries(Object.entries(scalars).map(([k, val]) => [k, val === "" ? null : val])),
      principal_ids,
      backup_ids,
      coordinator_id,
      comercial_id,
    };
    try {
      if (assignment) await updateAssignment(assignment.assignment_id, payload);
      else await createAssignment(payload);
      onSaved(); onOpenChange(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Error al guardar");
    }
  }

  const field = (name: keyof FormInput, label: string, area = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {area ? <Textarea id={name} {...register(name)} rows={2} /> : <Input id={name} {...register(name)} />}
    </div>
  );

  const personSelect = (name: "coordinator_id" | "comercial_id", label: string, options: Person[]) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} className={selectClass} {...register(name)}>
        <option value="">Ninguno</option>
        {options.map((p) => <option key={p.person_id} value={p.person_id}>{p.name}</option>)}
      </select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" busy={isSubmitting}>
        <DialogHeader><DialogTitle>{assignment ? "Editar asignación" : "Nueva asignación"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {field("client_name", "Cliente")}
          {errors.client_name && <p className="text-sm text-destructive">{errors.client_name.message}</p>}
          <div className="grid grid-cols-2 gap-3">
            {field("service", "Servicio")}{field("category", "Categoría (ALTO/MEDIO/BAJO)")}
            {field("country", "País")}{field("status", "Estado")}
          </div>
          {field("databases", "Bases de datos")}

          <div className="space-y-1.5">
            <Label>Consultores principales</Label>
            <PersonMultiSelect
              label="Seleccionar principales…"
              people={consultants}
              selected={principalIds}
              onChange={(ids) => setValue("principal_ids", ids, { shouldValidate: true })}
            />
            {errors.principal_ids && <p className="text-sm text-destructive">{errors.principal_ids.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Consultores backup</Label>
            <PersonMultiSelect
              label="Seleccionar backups…"
              people={consultants}
              selected={backupIds}
              onChange={(ids) => setValue("backup_ids", ids, { shouldValidate: true })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {personSelect("coordinator_id", "Coordinador", coordinators)}
            {personSelect("comercial_id", "Comercial", comercials)}
          </div>

          {field("access_accounts", "Cuentas de acceso", true)}
          <div className="grid grid-cols-2 gap-3">
            {field("account_role", "Rol de la cuenta")}{field("lighthouse", "Lighthouse")}
          </div>
          {field("client_contact_name", "Contacto del cliente", true)}
          <div className="grid grid-cols-2 gap-3">
            {field("client_contact_phone", "Teléfono contacto")}
            <div className="space-y-1.5">
              <Label htmlFor="contract_end">Fecha fin contrato</Label>
              <Input type="date" id="contract_end" {...register("contract_end")} />
            </div>
          </div>
          {field("client_contact_email", "Correo contacto", true)}
          {field("observations", "Observaciones", true)}
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
