import { alertsToCsv, policiesToCsv } from "@/lib/csv";
import type { Alert, Policy } from "@/types";

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

test("genera CSV de políticas con cabecera y escapa comillas", () => {
  const policy: Policy = {
    policy_id: 1, policy_number: 1, name: 'Policy "X"', category: "Gobierno", policy_type: "Built-in Azure Policy",
    recommended_effect: "Deny o Audit", mode: "Indexed", key_parameters: "effect", description: "Desc",
    objective: "Obj", recommended_scope: "Subscription", rollout: null, risk: null,
    example_parameters: null, azure_cli: null, powershell: null, script_notes: null,
    official_source: "https://learn.microsoft.com", is_active: true,
  };
  const csv = policiesToCsv([policy]);
  const lines = csv.split("\r\n");
  expect(lines[0]).toContain("Política");
  expect(lines[0]).toContain("Efecto recomendado");
  expect(lines[1]).toContain('"Policy ""X"""');
  expect(lines[1]).toContain('"Deny o Audit"');
  expect(lines[1]).toContain('"https://learn.microsoft.com"');
});
