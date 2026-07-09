import { useCallback, useEffect, useRef, useState } from "react";
import { listPolicies } from "@/lib/api";
import type { Policy } from "@/types";

export function usePolicyCatalog() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const p = await listPolicies();
      if (!mountedRef.current) return;
      setPolicies(p);
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

  return { policies, loading, error, reload };
}
