import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { useConsultants } from "@/hooks/useConsultants";
import * as api from "@/lib/api";
import type { ConsultantAssignment, Person } from "@/types";

vi.mock("@/lib/api");

// ⚠️ Datos inventados (nunca clientes ni personas reales).
const assignment: ConsultantAssignment = {
  assignment_id: 1, client_name: "Cliente Uno", service: "Infraestructura", category: "ALTO",
  databases: null, country: "QUITO", status: "ACTIVO", access_accounts: null, account_role: null,
  lighthouse: null, client_contact_name: null, client_contact_phone: null, client_contact_email: null,
  contract_end: null, observations: null, is_active: true,
  principals: [{ person_id: 1, name: "Ana Pérez" }], backups: [], coordinator: null, comercial: null,
};
const person: Person = { person_id: 1, name: "Ana Pérez", email: null, person_type: "consultor", is_active: true };

beforeEach(() => {
  vi.mocked(api.listAssignments).mockReset();
  vi.mocked(api.listPeople).mockReset();
});

test("carga inicial puebla assignments y people en paralelo", async () => {
  vi.mocked(api.listAssignments).mockResolvedValue([assignment]);
  vi.mocked(api.listPeople).mockResolvedValue([person]);

  const { result } = renderHook(() => useConsultants());
  expect(result.current.loading).toBe(true);

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.assignments).toEqual([assignment]);
  expect(result.current.people).toEqual([person]);
  expect(result.current.error).toBe("");
});

test("error en cualquiera de las cargas expone el mensaje", async () => {
  vi.mocked(api.listAssignments).mockResolvedValue([assignment]);
  vi.mocked(api.listPeople).mockRejectedValue(new Error("boom"));

  const { result } = renderHook(() => useConsultants());

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe("boom");
  expect(result.current.assignments).toEqual([]);
});

test("reload vuelve a invocar ambas cargas", async () => {
  vi.mocked(api.listAssignments).mockResolvedValue([assignment]);
  vi.mocked(api.listPeople).mockResolvedValue([person]);

  const { result } = renderHook(() => useConsultants());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(api.listAssignments).toHaveBeenCalledTimes(1);
  expect(api.listPeople).toHaveBeenCalledTimes(1);

  await result.current.reload();
  expect(api.listAssignments).toHaveBeenCalledTimes(2);
  expect(api.listPeople).toHaveBeenCalledTimes(2);
});
