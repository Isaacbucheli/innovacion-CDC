import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AssignmentFormDialog from "@/components/consultants/AssignmentFormDialog";
import * as api from "@/lib/api";
import type { Person } from "@/types";

afterEach(() => vi.restoreAllMocks());

// ⚠️ Datos inventados (nunca clientes ni personas reales).
const people: Person[] = [
  { person_id: 1, name: "Ana Pérez", email: null, person_type: "consultor", is_active: true },
  { person_id: 2, name: "Luis Gómez", email: null, person_type: "consultor", is_active: true },
  { person_id: 3, name: "Carla Ruiz", email: null, person_type: "coordinador", is_active: true },
];

test("exige al menos un consultor principal y no llama a la API", async () => {
  const create = vi.spyOn(api, "createAssignment");
  render(<AssignmentFormDialog open assignment={null} people={people} onOpenChange={() => {}} onSaved={() => {}} />);
  fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "Cliente Uno" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
  await waitFor(() => expect(screen.getByText(/al menos un consultor principal/i)).toBeInTheDocument());
  expect(create).not.toHaveBeenCalled();
});

test("crea la asignación con principal seleccionado y llama onSaved", async () => {
  const create = vi.spyOn(api, "createAssignment").mockResolvedValue({ assignment_id: 5 });
  const onSaved = vi.fn();
  render(<AssignmentFormDialog open assignment={null} people={people} onOpenChange={() => {}} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "Cliente Uno" } });
  // Multi-select de principales: abrir el popover y marcar a Ana.
  fireEvent.click(screen.getByRole("button", { name: /seleccionar principales/i }));
  fireEvent.click(screen.getByLabelText("Ana Pérez"));
  fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
  await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({
    client_name: "Cliente Uno",
    principal_ids: [1],
    backup_ids: [],
  })));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
});

test("muestra error cuando la API falla y no llama onSaved", async () => {
  vi.spyOn(api, "createAssignment").mockRejectedValue(new Error("Sin permiso"));
  const onSaved = vi.fn();
  render(<AssignmentFormDialog open assignment={null} people={people} onOpenChange={() => {}} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "Cliente Uno" } });
  fireEvent.click(screen.getByRole("button", { name: /seleccionar principales/i }));
  fireEvent.click(screen.getByLabelText("Ana Pérez"));
  fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
  await waitFor(() => expect(screen.getByText(/sin permiso/i)).toBeInTheDocument());
  expect(onSaved).not.toHaveBeenCalled();
});
