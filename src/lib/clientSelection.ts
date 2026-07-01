// Cliente activo, compartido por TODAS las vistas por-cliente (Optimización de
// costos, WAF y sus sub-vistas, Reservas por vencer, Informe de gestión): una
// sola clave de localStorage para que el cliente elegido en una vista se
// mantenga al navegar a las demás, en vez de que cada página recuerde el suyo.
//
// Antes de este módulo, Costos usaba su propia clave ("innovacion_cdc_cost_client")
// mientras el resto compartía "innovacion_cdc_waf_client" -> el cliente activo
// quedaba desincronizado entre Costos y todo lo demás. Se conserva ese valor
// (el usado por la mayoría) para no perder la preferencia ya guardada de nadie.
const ACTIVE_CLIENT_KEY = "innovacion_cdc_waf_client";

export function readActiveClient(): number | null {
  const raw = localStorage.getItem(ACTIVE_CLIENT_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function writeActiveClient(id: number): void {
  localStorage.setItem(ACTIVE_CLIENT_KEY, String(id));
}

/** Cliente inicial: el guardado si sigue existiendo en la lista; si no, el primero. */
export function resolveInitialClient<T extends { client_id: number }>(clients: T[]): number | null {
  const stored = readActiveClient();
  return stored != null && clients.some((c) => c.client_id === stored) ? stored : (clients[0]?.client_id ?? null);
}
