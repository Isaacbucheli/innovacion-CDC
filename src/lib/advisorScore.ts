import { refreshWafAdvisorScore } from "@/lib/api";
import type { ClientAdmin } from "@/types";

export interface AdvisorScoreBatchResult {
  total: number;
  refreshed: number;
  failed: number;
}

/**
 * Orquesta el refresh de Advisor Score CLIENTE POR CLIENTE.
 *
 * Por qué: la ruta única del backend (`POST /waf/admin/advisor-score/refresh` sin
 * client_id → RefreshAllAsync) recorre todos los clientes en UNA petición síncrona que
 * consulta Azure por cada uno; con varios clientes supera el timeout del gateway del
 * App Service (~230s) y el navegador reporta "Failed to fetch". Llamando la ruta por
 * cliente (que ya funciona y responde rápido) evitamos ese límite y damos progreso.
 * El endpoint all-clients del backend se mantiene para el scheduler semanal (job en
 * segundo plano, sin timeout de request).
 *
 * Sólo procesa clientes ACTIVOS. Un fallo por cliente NO aborta el lote: se cuenta y sigue.
 */
export async function refreshAdvisorScoreBatch(
  clients: ClientAdmin[],
  includeInReports: boolean,
  onProgress?: (done: number, total: number, clientName: string) => void,
  refreshOne: (clientId: number, includeInReports: boolean) => Promise<unknown> = refreshWafAdvisorScore,
): Promise<AdvisorScoreBatchResult> {
  const targets = clients.filter((c) => c.is_active);
  let refreshed = 0;
  let failed = 0;
  for (let i = 0; i < targets.length; i++) {
    const c = targets[i];
    onProgress?.(i, targets.length, c.client_name);
    try {
      await refreshOne(c.client_id, includeInReports);
      refreshed++;
    } catch {
      failed++;
    }
  }
  return { total: targets.length, refreshed, failed };
}
