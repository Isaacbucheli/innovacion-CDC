import { useCallback, useEffect, useRef, useState } from "react";
import { getPendientes } from "@/lib/api";
import type { PendienteCliente, PendienteItem } from "@/types";

/**
 * Carga el payload de un área del tablero (clientes + pendientes con su historial) en una sola
 * llamada, igual que hacía la SWA original. Mismo patrón que useConsultants.
 *
 * `reload` se usa además tras cada mutación y tras un 409 (alguien más cambió el dato desde la SWA
 * o desde otra pestaña).
 */
export function usePendientes(area: string) {
  const [clientes, setClientes] = useState<PendienteCliente[]>([]);
  const [pendientes, setPendientes] = useState<PendienteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const payload = await getPendientes(area);
      if (!mountedRef.current) return;
      setClientes(payload.clientes);
      setPendientes(payload.pendientes);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [area]);

  useEffect(() => {
    mountedRef.current = true;
    reload();
    return () => { mountedRef.current = false; };
  }, [reload]);

  return { clientes, pendientes, loading, error, reload };
}
