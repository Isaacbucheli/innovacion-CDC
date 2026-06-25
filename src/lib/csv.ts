import type { Alert } from "@/types";

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
