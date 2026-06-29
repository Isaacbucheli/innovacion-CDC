import { useCallback, useEffect, useRef, useState } from "react";
import { listClientsAdmin } from "@/lib/api";
import type { ClientAdmin } from "@/types";

export function useClients() {
  const [clients, setClients] = useState<ClientAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await listClientsAdmin();
      if (!mountedRef.current) return;
      setClients(data);
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

  return { clients, loading, error, reload };
}
