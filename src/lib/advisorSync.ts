import { runWafAdvisorSync } from "@/lib/api";

export const ADVISOR_SYNC_STORAGE_KEY = "innovacion_cdc_advisor_sync_job";
export const ADVISOR_SYNC_STARTED_EVENT = "innovacion:advisor-sync-started";
export const ADVISOR_SYNC_COMPLETED_EVENT = "innovacion:advisor-sync-completed";

export type AdvisorSyncTracking = { clientId: number; jobId: number };

export function readAdvisorSyncTracking(): AdvisorSyncTracking | null {
  try {
    const value = JSON.parse(localStorage.getItem(ADVISOR_SYNC_STORAGE_KEY) || "null") as Partial<AdvisorSyncTracking> | null;
    return value && Number.isInteger(value.clientId) && Number.isInteger(value.jobId)
      ? { clientId: value.clientId!, jobId: value.jobId! }
      : null;
  } catch { return null; }
}

export async function startAdvisorSyncJob(clientId: number, subscriptions: string[]) {
  const result = await runWafAdvisorSync(clientId, {
    subscriptions,
    timeout_seconds_per_subscription: 600,
  });
  const tracking = { clientId, jobId: result.job_id };
  localStorage.setItem(ADVISOR_SYNC_STORAGE_KEY, JSON.stringify(tracking));
  window.dispatchEvent(new CustomEvent(ADVISOR_SYNC_STARTED_EVENT, { detail: tracking }));
  return result;
}
