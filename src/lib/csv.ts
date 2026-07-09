import type { Alert, Policy } from "@/types";

const HEADER = ["N°", "Alerta", "Recurso", "Tipo", "Severidad", "Origen", "Descripción", "Detalle", "Action Group", "Requisito técnico", "KQL"];

function cell(v: unknown): string {
  return `"${String(v ?? "").replaceAll('"', '""')}"`;
}

export function alertsToCsv(alerts: Alert[]): string {
  const rows = alerts.map((a) => [
    a.alert_number, a.name, a.resource, a.alert_type, a.severity, a.origin,
    a.description, a.detail, a.action_group, a.technical_requirement, a.kql_code,
  ].map(cell).join(","));
  return [HEADER.map(cell).join(","), ...rows].join("\r\n");
}

const POLICY_HEADER = [
  "N°", "Política", "Categoría", "Tipo", "Efecto recomendado", "Modo", "Parámetros clave",
  "Descripción", "Objetivo", "Scope recomendado", "Rollout recomendado", "Riesgo / impacto", "Fuente oficial",
];

export function policiesToCsv(policies: Policy[]): string {
  const rows = policies.map((p) => [
    p.policy_number, p.name, p.category, p.policy_type, p.recommended_effect, p.mode, p.key_parameters,
    p.description, p.objective, p.recommended_scope, p.rollout, p.risk, p.official_source,
  ].map(cell).join(","));
  return [POLICY_HEADER.map(cell).join(","), ...rows].join("\r\n");
}
