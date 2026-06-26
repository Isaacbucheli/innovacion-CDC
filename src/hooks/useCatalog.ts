import { useCallback, useEffect, useState } from "react";
import { listAlerts, listKql } from "@/lib/api";
import type { Alert, KqlQuery } from "@/types";

export function useCatalog() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [kql, setKql] = useState<KqlQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [a, k] = await Promise.all([listAlerts(), listKql()]);
      setAlerts(a); setKql(k);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { alerts, kql, loading, error, reload };
}
