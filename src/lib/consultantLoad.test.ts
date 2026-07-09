import { expect, test } from "vitest";
import { computeLoads } from "@/lib/consultantLoad";
import type { ConsultantAssignment, Person, PersonType } from "@/types";

// ⚠️ Datos 100% inventados (nunca clientes ni personas reales).
const person = (id: number, name: string, type: PersonType = "consultor", active = true): Person =>
  ({ person_id: id, name, email: null, person_type: type, is_active: active });

const assignment = (over: Partial<ConsultantAssignment>): ConsultantAssignment => ({
  assignment_id: 1, client_name: "Cliente Uno", service: "Infraestructura", category: "ALTO",
  databases: null, country: "QUITO", status: "ACTIVO", access_accounts: null, account_role: null,
  lighthouse: null, client_contact_name: null, client_contact_phone: null, client_contact_email: null,
  contract_end: null, observations: null, is_active: true,
  principals: [], backups: [], coordinator: null, comercial: null, ...over,
});

const ana = person(1, "Ana Pérez");
const luis = person(2, "Luis Gómez");

test("cuenta asignaciones como principal y como backup por separado", () => {
  const assignments = [
    assignment({ assignment_id: 1, client_name: "Cliente Uno", principals: [{ person_id: 1, name: "Ana Pérez" }] }),
    assignment({ assignment_id: 2, client_name: "Cliente Dos", principals: [{ person_id: 1, name: "Ana Pérez" }], backups: [{ person_id: 2, name: "Luis Gómez" }] }),
    assignment({ assignment_id: 3, client_name: "Cliente Tres", principals: [{ person_id: 2, name: "Luis Gómez" }], backups: [{ person_id: 1, name: "Ana Pérez" }] }),
  ];
  const loads = computeLoads(assignments, [ana, luis]);
  const anaLoad = loads.find((l) => l.person_id === 1)!;
  expect(anaLoad.principal_count).toBe(2);
  expect(anaLoad.backup_count).toBe(1);
  expect(anaLoad.assignments).toHaveLength(3);
  const luisLoad = loads.find((l) => l.person_id === 2)!;
  expect(luisLoad.principal_count).toBe(1);
  expect(luisLoad.backup_count).toBe(1);
});

test("pondera ALTO=3, MEDIO=2, BAJO=1 y categoría desconocida=1 (case-insensitive)", () => {
  const assignments = [
    assignment({ assignment_id: 1, category: "ALTO", principals: [{ person_id: 1, name: "Ana Pérez" }] }),
    assignment({ assignment_id: 2, category: "Medio", principals: [{ person_id: 1, name: "Ana Pérez" }] }),
    assignment({ assignment_id: 3, category: "bajo", principals: [{ person_id: 1, name: "Ana Pérez" }] }),
    assignment({ assignment_id: 4, category: null, principals: [{ person_id: 1, name: "Ana Pérez" }] }),
  ];
  const [anaLoad] = computeLoads(assignments, [ana]);
  expect(anaLoad.weighted_load).toBe(3 + 2 + 1 + 1);
});

test("en clientes compartidos cada consultor principal cuenta completo", () => {
  const shared = assignment({
    assignment_id: 1, category: "ALTO",
    principals: [{ person_id: 1, name: "Ana Pérez" }, { person_id: 2, name: "Luis Gómez" }],
  });
  const loads = computeLoads([shared], [ana, luis]);
  expect(loads.find((l) => l.person_id === 1)!.weighted_load).toBe(3);
  expect(loads.find((l) => l.person_id === 2)!.weighted_load).toBe(3);
});

test("ser backup no suma carga ponderada", () => {
  const assignments = [
    assignment({ assignment_id: 1, category: "ALTO", principals: [{ person_id: 2, name: "Luis Gómez" }], backups: [{ person_id: 1, name: "Ana Pérez" }] }),
  ];
  const loads = computeLoads(assignments, [ana, luis]);
  const anaLoad = loads.find((l) => l.person_id === 1)!;
  expect(anaLoad.backup_count).toBe(1);
  expect(anaLoad.weighted_load).toBe(0);
});

test("ignora asignaciones inactivas y solo incluye consultores activos", () => {
  const coordinadora = person(3, "Carla Ruiz", "coordinador");
  const inactivo = person(4, "Pedro Salas", "consultor", false);
  const assignments = [
    assignment({ assignment_id: 1, is_active: false, principals: [{ person_id: 1, name: "Ana Pérez" }] }),
    assignment({ assignment_id: 2, principals: [{ person_id: 4, name: "Pedro Salas" }] }),
  ];
  const loads = computeLoads(assignments, [ana, coordinadora, inactivo]);
  // Solo Ana (consultora activa) aparece; sin carga porque su única asignación está inactiva.
  expect(loads).toHaveLength(1);
  expect(loads[0].person_id).toBe(1);
  expect(loads[0].principal_count).toBe(0);
  expect(loads[0].weighted_load).toBe(0);
});

test("ordena por carga ponderada descendente", () => {
  const assignments = [
    assignment({ assignment_id: 1, category: "BAJO", principals: [{ person_id: 1, name: "Ana Pérez" }] }),
    assignment({ assignment_id: 2, category: "ALTO", principals: [{ person_id: 2, name: "Luis Gómez" }] }),
  ];
  const loads = computeLoads(assignments, [ana, luis]);
  expect(loads.map((l) => l.person_id)).toEqual([2, 1]);
});
