import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import AssignmentsView from "@/components/consultants/AssignmentsView";
import type { ConsultantAssignment, Person } from "@/types";

// ⚠️ Datos inventados (nunca clientes ni personas reales).
const assignments: ConsultantAssignment[] = [{
  assignment_id: 1, client_name: "Cliente Uno", service: "Infraestructura", category: "ALTO",
  databases: null, country: "QUITO", status: "ACTIVO", access_accounts: null, account_role: null,
  lighthouse: null, client_contact_name: null, client_contact_phone: null, client_contact_email: null,
  contract_end: null, observations: null, is_active: true,
  principals: [{ person_id: 1, name: "Ana Pérez" }],
  backups: [{ person_id: 2, name: "Luis Gómez" }],
  coordinator: { person_id: 3, name: "Carla Ruiz" }, comercial: null,
}];

const people: Person[] = [
  { person_id: 1, name: "Ana Pérez", email: null, person_type: "consultor", is_active: true },
  { person_id: 2, name: "Luis Gómez", email: null, person_type: "consultor", is_active: true },
];

const noop = () => {};

test("renderiza KPIs, chips de personas y filtra por búsqueda", () => {
  render(<AssignmentsView assignments={assignments} people={people} isAdmin={false}
    onOpen={noop} onNew={noop} onEdit={noop} onDelete={noop} />);
  expect(screen.getByText("Asignaciones")).toBeInTheDocument();
  expect(screen.getByText("Clientes únicos")).toBeInTheDocument();
  expect(screen.getByText("Consultores activos")).toBeInTheDocument();
  expect(screen.getByText("Servicios")).toBeInTheDocument();
  expect(screen.getByText("Cliente Uno")).toBeInTheDocument();
  expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
  expect(screen.getByText("Luis Gómez")).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: "zzz" } });
  expect(screen.queryByText("Cliente Uno")).not.toBeInTheDocument();
});

test("sin rol admin no muestra Nueva asignación ni editar/eliminar", () => {
  render(<AssignmentsView assignments={assignments} people={people} isAdmin={false}
    onOpen={noop} onNew={noop} onEdit={noop} onDelete={noop} />);
  expect(screen.queryByRole("button", { name: /nueva asignación/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
  // "Ver" queda disponible para todos los roles.
  expect(screen.getByRole("button", { name: "Ver" })).toBeInTheDocument();
});

test("con rol admin muestra Nueva asignación y dispara onNew", () => {
  const onNew = vi.fn();
  render(<AssignmentsView assignments={assignments} people={people} isAdmin
    onOpen={noop} onNew={onNew} onEdit={noop} onDelete={noop} />);
  const btn = screen.getByRole("button", { name: /nueva asignación/i });
  fireEvent.click(btn);
  expect(onNew).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
});
