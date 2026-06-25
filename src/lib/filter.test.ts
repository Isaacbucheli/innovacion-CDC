import { filterAlerts, uniqueValues } from "@/lib/filter";
import type { Alert } from "@/types";

const A = (over: Partial<Alert>): Alert => ({
  alert_id: 1, alert_number: 1, name: "", resource: null, alert_type: null,
  description: null, severity: null, origin: null, detail: null,
  action_group: null, kql_code: null, technical_requirement: null, is_active: true, ...over,
});

const data: Alert[] = [
  A({ alert_id: 1, name: "Rol RBAC", resource: "Suscripción", alert_type: "Seguridad", severity: "ALTA", origin: "Activity Log" }),
  A({ alert_id: 2, name: "ASR Critical", resource: "Recovery Services", alert_type: "Disponibilidad", severity: "MEDIA", origin: "Azure Monitor" }),
];

test("filtra por texto libre (nombre)", () => {
  expect(filterAlerts(data, { q: "rbac", resource: "", type: "", severity: "", origin: "" })).toHaveLength(1);
});
test("filtra por recurso exacto", () => {
  expect(filterAlerts(data, { q: "", resource: "Suscripción", type: "", severity: "", origin: "" })).toHaveLength(1);
});
test("uniqueValues devuelve valores distintos ordenados", () => {
  expect(uniqueValues(data, "alert_type")).toEqual(["Disponibilidad", "Seguridad"]);
});
