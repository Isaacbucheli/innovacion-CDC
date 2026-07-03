import { getPowerHistoryStatus as apiGetStatus } from "@/lib/api";
import type { PowerHistoryJobStatus } from "@/types";

const POWER_SOURCE_LABELS: Record<string, string> = {
  activity_log: "Activity Log de Azure",
  no_events: "sin eventos de encendido/apagado en el periodo",
  no_vms: "sin VMs en el análisis",
  no_analysis: "sin análisis",
};

export interface PollOptions {
  intervalMs?: number;
  maxAttempts?: number;
  getStatus?: (analysisId: number) => Promise<PowerHistoryJobStatus>;
  delay?: (ms: number) => Promise<void>;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Sondea el estado del job de encendido/apagado hasta 'completed'/'failed' o el tope de intentos.
 * Devuelve el último estado observado (puede quedar 'running' si se agotan los intentos).
 */
export async function pollPowerHistory(analysisId: number, opts: PollOptions = {}): Promise<PowerHistoryJobStatus> {
  const intervalMs = opts.intervalMs ?? 5000;
  const maxAttempts = opts.maxAttempts ?? 60;
  const getStatus = opts.getStatus ?? apiGetStatus;
  const delay = opts.delay ?? wait;

  let last: PowerHistoryJobStatus = { status: "running" };
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    last = await getStatus(analysisId);
    if (last.status === "completed" || last.status === "failed") return last;
    if (attempt < maxAttempts - 1) await delay(intervalMs);
  }
  return last;
}

/** Convierte el estado final del job en un mensaje de toast (ok = éxito). */
export function powerToastMessage(status: PowerHistoryJobStatus): { ok: boolean; text: string } {
  if (status.status === "completed") {
    const s = status.summary ?? {};
    const period = (s.period_start ?? "").slice(0, 7);
    const src = POWER_SOURCE_LABELS[s.source ?? ""] ?? s.source ?? "";
    return {
      ok: true,
      text: `Encendido/apagado: ${s.updated_count ?? 0} VM(s) actualizadas${period ? ` (periodo ${period})` : ""}${src ? `. Fuente: ${src}` : ""}.`,
    };
  }
  if (status.status === "failed") {
    return { ok: false, text: `Error actualizando encendido/apagado: ${status.error ?? "error desconocido"}.` };
  }
  return { ok: false, text: "El refresh de encendido/apagado sigue en proceso. Vuelve a consultar en unos minutos." };
}
