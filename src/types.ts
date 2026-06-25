export type Role = "admin" | "consultor" | "lector";

export interface Alert {
  alert_id: number;
  alert_number: number | null;
  name: string;
  resource: string | null;
  alert_type: string | null;
  description: string | null;
  severity: string | null;
  origin: string | null;
  detail: string | null;
  action_group: string | null;
  kql_code: string | null;
  technical_requirement: string | null;
  is_active: boolean;
}

export interface KqlQuery {
  kql_id: number;
  name: string;
  description: string | null;
  kql_query: string | null;
  is_active: boolean;
}
