import { calculateCosts, recalcScenarios, refreshPowerHistory, refreshRiCoverage } from "@/lib/api";
import { serviceName } from "@/lib/costs";

/** Tamaño de lote del cálculo de costos (igual que el front vanilla). */
export const COST_CALCULATION_BATCH_SIZE = 20;

export interface CalcProgress {
  service: string;
  index: number;
  total: number;
  batch: number;
}

/**
 * Ejecuta el cálculo de costos por servicio y por lotes (resource_offset/limit),
 * iterando mientras summary[serviceKey].has_more. replace_existing solo en el primer
 * lote de cada servicio. Opcionalmente arma escenarios al final. Port de calculateCosts().
 */
export async function runCalculation(
  analysisId: number,
  serviceKeys: string[],
  opts: { autoBuildScenarios: boolean },
  onProgress?: (p: CalcProgress) => void,
): Promise<void> {
  for (let index = 0; index < serviceKeys.length; index += 1) {
    const serviceKey = serviceKeys[index];
    let offset = 0;
    let batch = 1;
    let hasMore = true;
    while (hasMore) {
      onProgress?.({ service: serviceName(serviceKey), index, total: serviceKeys.length, batch });
      const result = await calculateCosts(analysisId, {
        service_keys: [serviceKey],
        auto_build_scenarios: false,
        resource_offset: offset,
        resource_limit: COST_CALCULATION_BATCH_SIZE,
        replace_existing: offset === 0,
      });
      hasMore = Boolean(result.summary?.[serviceKey]?.has_more);
      offset += COST_CALCULATION_BATCH_SIZE;
      batch += 1;
    }
  }
  if (opts.autoBuildScenarios) {
    await recalcScenarios(analysisId);
  }
}

/**
 * Tras un cálculo, recruza cobertura RI y refresca encendido/apagado. Best-effort:
 * cada paso es silencioso si falla (se reintenta a mano desde Opciones).
 */
export async function bestEffortRefresh(analysisId: number): Promise<void> {
  try {
    await refreshRiCoverage(analysisId);
  } catch {
    /* reintentable manual: "Actualizar cobertura RI" */
  }
  try {
    await refreshPowerHistory(analysisId);
  } catch {
    /* reintentable manual: "Actualizar encendido/apagado" */
  }
}
