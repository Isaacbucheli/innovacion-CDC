import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import ReassignDialog from "@/components/consultants/ReassignDialog";
import * as api from "@/lib/api";
import type { Person } from "@/types";

afterEach(() => vi.restoreAllMocks());

// ⚠️ Datos inventados (nunca clientes ni personas reales).
const people: Person[] = [
  { person_id: 1, name: "Ana Pérez", email: null, person_type: "consultor", is_active: true },
  { person_id: 2, name: "Luis Gómez", email: null, person_type: "consultor", is_active: true },
  { person_id: 3, name: "Carla Ruiz", email: null, person_type: "coordinador", is_active: true },
  { person_id: 4, name: "Pedro Salas", email: null, person_type: "consultor", is_active: false },
];

test("llama a la API con todos los scopes por defecto y recarga", async () => {
  const reassign = vi.spyOn(api, "reassignPerson")
    .mockResolvedValue({ message: "Reasignación aplicada", changed_assignments: 3 });
  const onDone = vi.fn();
  render(<ReassignDialog open people={people} onOpenChange={() => {}} onDone={onDone} />);

  fireEvent.change(screen.getByLabelText("Persona origen"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Persona destino"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: /^reasignar$/i }));

  await waitFor(() => expect(reassign).toHaveBeenCalledWith(1, {
    to_person_id: 2,
    scopes: ["principal", "backup", "coordinador", "comercial"],
  }));
  await waitFor(() => expect(onDone).toHaveBeenCalled());
});

test("permite acotar el alcance desmarcando checkboxes", async () => {
  const reassign = vi.spyOn(api, "reassignPerson")
    .mockResolvedValue({ message: "Reasignación aplicada", changed_assignments: 1 });
  render(<ReassignDialog open people={people} onOpenChange={() => {}} onDone={() => {}} />);

  fireEvent.change(screen.getByLabelText("Persona origen"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Persona destino"), { target: { value: "2" } });
  fireEvent.click(screen.getByLabelText("Backup"));
  fireEvent.click(screen.getByLabelText("Coordinador"));
  fireEvent.click(screen.getByLabelText("Comercial"));
  fireEvent.click(screen.getByRole("button", { name: /^reasignar$/i }));

  await waitFor(() => expect(reassign).toHaveBeenCalledWith(1, {
    to_person_id: 2,
    scopes: ["principal"],
  }));
});

test("el destino solo ofrece personas activas del mismo tipo distintas del origen", () => {
  render(<ReassignDialog open people={people} onOpenChange={() => {}} onDone={() => {}} />);
  fireEvent.change(screen.getByLabelText("Persona origen"), { target: { value: "1" } });
  const destino = screen.getByLabelText("Persona destino") as HTMLSelectElement;
  const options = within(destino).getAllByRole("option").map((o) => o.textContent);
  // Sin la coordinadora (otro tipo), sin el inactivo y sin la propia persona origen.
  expect(options).toEqual(["Seleccionar…", "Luis Gómez"]);
});
