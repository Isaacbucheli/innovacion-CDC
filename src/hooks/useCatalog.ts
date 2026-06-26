import { useCallback, useEffect, useRef, useState } from "react";
import { listAlerts, listKql } from "@/lib/api";
import type { Alert, KqlQuery } from "@/types";

export function useCatalog() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [kql, setKql] = useState<KqlQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [a, k] = await Promise.all([listAlerts(), listKql()]);
      if (!mountedRef.current) return;
      setAlerts(a); setKql(k);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    reload();
    return () => { mountedRef.current = false; };
  }, [reload]);

  return { alerts, kql, loading, error, reload };
}
