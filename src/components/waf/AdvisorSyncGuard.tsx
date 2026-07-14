import { useEffect, useState } from "react";
import { toast } from "sonner";
import BusyOverlay from "@/components/BusyOverlay";
import { getWafAdvisorSyncStatus } from "@/lib/api";
import {
  ADVISOR_SYNC_COMPLETED_EVENT,
  ADVISOR_SYNC_STARTED_EVENT,
  ADVISOR_SYNC_STORAGE_KEY,
  readAdvisorSyncTracking,
  type AdvisorSyncTracking,
} from "@/lib/advisorSync";
import type { WafAdvisorSyncResult } from "@/types";

function isTerminal(status: string) {
  return status === "completed" || status === "partial" || status === "failed";
}

function detail(status: WafAdvisorSyncResult | null) {
  if (!status || status.status === "queued") return "Preparando la consulta; las demás acciones están bloqueadas.";
  const progress = `${status.subscriptions_processed} de ${status.subscriptions_total} suscripciones`;
  return status.current_subscription ? `${progress} · ${status.current_subscription}` : progress;
}

function failureDetail(status: WafAdvisorSyncResult) {
  const warning = status.warnings?.find(
    (item): item is { error: string } =>
      typeof item === "object" && item !== null && "error" in item && typeof item.error === "string",
  );
  return warning?.error.replace(/^AdvisorApiException:\s*/, "")
    || status.error
    || "error no especificado";
}

/**
 * Bloqueo global de Advisor. El trabajo vive en backend, pero la UI permanece deliberadamente
 * bloqueada para evitar navegación y consultas paralelas. localStorage restaura el bloqueo al recargar.
 */
export default function AdvisorSyncGuard() {
  const [tracking, setTracking] = useState<AdvisorSyncTracking | null>(readAdvisorSyncTracking);
  const [status, setStatus] = useState<WafAdvisorSyncResult | null>(null);

  useEffect(() => {
    const started = (event: Event) => {
      const next = (event as CustomEvent<AdvisorSyncTracking>).detail;
      setStatus(null);
      setTracking(next);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === ADVISOR_SYNC_STORAGE_KEY) setTracking(readAdvisorSyncTracking());
    };
    window.addEventListener(ADVISOR_SYNC_STARTED_EVENT, started);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(ADVISOR_SYNC_STARTED_EVENT, started);
      window.removeEventListener("storage", storage);
    };
  }, []);

  useEffect(() => {
    if (!tracking) return;
    let cancelled = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const next = await getWafAdvisorSyncStatus(tracking.clientId, tracking.jobId);
        if (cancelled) return;
        failures = 0;
        setStatus(next);
        if (isTerminal(next.status)) {
          localStorage.removeItem(ADVISOR_SYNC_STORAGE_KEY);
          setTracking(null);
          if (next.status === "failed")
            toast.error(`Advisor no pudo completar la consulta: ${failureDetail(next)}`);
          else if (next.status === "partial")
            toast.warning(`Advisor terminó parcialmente: ${next.subscriptions_failed} suscripción(es) con error.`);
          else
            toast.success(`Advisor actualizado · ${next.new_recommendations} recomendaciones nuevas.`);
          window.dispatchEvent(new CustomEvent(ADVISOR_SYNC_COMPLETED_EVENT, { detail: next }));
          return;
        }
        timer = setTimeout(poll, 3000);
      } catch {
        failures++;
        if (!cancelled && failures >= 3) {
          localStorage.removeItem(ADVISOR_SYNC_STORAGE_KEY);
          setTracking(null);
          toast.error("No fue posible consultar el estado de Advisor. El backend mantiene la protección contra consultas duplicadas.");
        } else if (!cancelled) timer = setTimeout(poll, 5000);
      }
    };

    void poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [tracking]);

  return <BusyOverlay show={tracking !== null} title="Consultando Azure Advisor" detail={detail(status)} />;
}
