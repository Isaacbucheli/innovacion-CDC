import { alertsToCsv } from "@/lib/csv";
import type { Alert } from "@/types";

test("genera CSV con cabecera y escapa comillas", () => {
  const alert: Alert = {
    alert_id: 1, alert_number: 1, name: 'Dice "hola"', resource: "Sub", alert_type: "Seg",
    description: null, severity: "ALTA", origin: "AM", detail: null, action_group: null,
    kql_code: null, technical_requirement: null, is_active: true,
  };
  const csv = alertsToCsv([alert]);
  const lines = csv.split("\r\n");
  expect(lines[0]).toContain("Alerta");
  expect(lines[1]).toContain('"Dice ""hola"""');
});
