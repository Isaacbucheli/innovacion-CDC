import type { ImportInventoryResult } from "@/lib/api";
import { serviceName } from "@/lib/costs";

/**
 * Un error o warning de importación ya resuelto para mostrar: con el servicio de origen y su
 * etiqueta visible. Un warning significa que ese recurso (p. ej. una cuenta de storage) NO entró
 * al análisis — no es un detalle menor, es la única señal de un "cero silencioso".
 */
export interface ImportIssue {
  service: string;
  serviceLabel: string;
  credentialId?: number;
  message: string;
}

/** Resultado agregado de una importación: total de recursos importados + errores/warnings de todos los servicios. */
export interface ImportSummary {
  totalImported: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

/**
 * Agrega el resumen por-servicio de una importación de inventario en un solo total + listas planas
 * de errores/warnings (cada uno con el servicio de origen resuelto). Tolera campos ausentes:
 * `summary`, `errors` y `warnings` pueden faltar en respuestas antiguas o en servicios sin novedades.
 */
export function summarizeImportResult(result: Pick<ImportInventoryResult, "summary">): ImportSummary {
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  let totalImported = 0;

  for (const [service, s] of Object.entries(result.summary ?? {})) {
    totalImported += s?.imported ?? 0;
    const serviceLabel = serviceName(service);
    for (const e of s?.errors ?? []) {
      errors.push({ service, serviceLabel, credentialId: e.credential_id, message: e.error ?? "Error sin detalle." });
    }
    for (const w of s?.warnings ?? []) {
      warnings.push({ service, serviceLabel, credentialId: w.credential_id, message: w.warning ?? "Advertencia sin detalle." });
    }
  }

  return { totalImported, errors, warnings };
}

/** true si hay algo que el consultor deba revisar (recursos que quedaron fuera del análisis). */
export function hasImportIssues(summary: ImportSummary): boolean {
  return summary.errors.length > 0 || summary.warnings.length > 0;
}
