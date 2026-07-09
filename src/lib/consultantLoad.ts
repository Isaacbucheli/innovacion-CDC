// Cálculo PURO (sin React) de la carga por consultor para la vista "Carga".
// Solo cuenta personas tipo "consultor" activas y asignaciones activas.
// La carga ponderada suma el peso de la categoría (ALTO=3, MEDIO=2, BAJO=1;
// sin categoría reconocible=1) SOLO en las asignaciones donde la persona es
// PRINCIPAL. En clientes compartidos cada consultor cuenta completo.

import type { ConsultantAssignment, Person } from "@/types";
import { normalizeCategory, type CategoryKey } from "@/lib/category";

export const CATEGORY_WEIGHT: Record<CategoryKey, number> = { alto: 3, medio: 2, bajo: 1, other: 1 };

export interface LoadAssignmentRef {
  assignment_id: number;
  client_name: string;
  service: string | null;
  category: string | null;
  role: "principal" | "backup";
}

export interface ConsultantLoad {
  person_id: number;
  name: string;
  principal_count: number;
  backup_count: number;
  weighted_load: number;
  assignments: LoadAssignmentRef[];
}

export function computeLoads(assignments: ConsultantAssignment[], people: Person[]): ConsultantLoad[] {
  const loads = new Map<number, ConsultantLoad>();
  for (const p of people) {
    if (p.person_type !== "consultor" || !p.is_active) continue;
    loads.set(p.person_id, {
      person_id: p.person_id,
      name: p.name,
      principal_count: 0,
      backup_count: 0,
      weighted_load: 0,
      assignments: [],
    });
  }

  for (const a of assignments) {
    if (!a.is_active) continue;
    const weight = CATEGORY_WEIGHT[normalizeCategory(a.category)];
    const ref = (role: "principal" | "backup"): LoadAssignmentRef => ({
      assignment_id: a.assignment_id,
      client_name: a.client_name,
      service: a.service,
      category: a.category,
      role,
    });
    for (const pr of a.principals) {
      const l = loads.get(pr.person_id);
      if (!l) continue; // no es consultor activo del directorio
      l.principal_count += 1;
      l.weighted_load += weight;
      l.assignments.push(ref("principal"));
    }
    for (const bk of a.backups) {
      const l = loads.get(bk.person_id);
      if (!l) continue;
      l.backup_count += 1;
      l.assignments.push(ref("backup"));
    }
  }

  // Ranking: mayor carga ponderada primero; empates por nombre para orden estable.
  return [...loads.values()].sort(
    (x, y) => y.weighted_load - x.weighted_load || x.name.localeCompare(y.name),
  );
}
