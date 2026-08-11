import { useCallback, useEffect, useRef, useState } from "react";
import { getInformeValorEstado, getInformeValorInsumosBd, listClients } from "@/lib/api";
import { resolveInitialClient, writeActiveClient } from "@/lib/clientSelection";
import type { ClientSummary, EstadoRbacInfo, InformeValorEstado } from "@/types";

export function useInformeValor() {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [clientId, setClientIdState] = useState<number | null>(null);
  const [estado, setEstado] = useState<InformeValorEstado | null>(null);
  // Condicional de RBAC (Entrega 2): va en su propio endpoint (/insumos-bd), pero describe la
  // misma pantalla que `estado` -- se piden juntos para que la tarjeta de RBAC nunca muestre uno
  // sin el otro a medio cargar (ver cargar() abajo).
  const [estadoRbac, setEstadoRbac] = useState<EstadoRbacInfo | null>(null);
  const [loading, setLoading] = useState(true);      // catálogo de clientes
  const [dataLoading, setDataLoading] = useState(false); // datos del cliente
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cs = await listClients();
        if (!mounted.current) return;
        setClients(cs);
        setClientIdState(resolveInitialClient(cs));
      } catch (e) {
        if (mounted.current) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();
  }, []);

  const cargar = useCallback(async (id: number) => {
    setDataLoading(true);
    setError(null);
    try {
      const [e, insumosBd] = await Promise.all([getInformeValorEstado(id), getInformeValorInsumosBd(id)]);
      if (mounted.current) { setEstado(e); setEstadoRbac(insumosBd.estado_rbac); }
    } catch (e) {
      if (mounted.current) {
        setEstado(null);
        setEstadoRbac(null);
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (mounted.current) setDataLoading(false);
    }
  }, []);

  useEffect(() => { if (clientId) void cargar(clientId); }, [clientId, cargar]);

  const setClientId = useCallback((id: number | null) => {
    setClientIdState(id);
    if (id) writeActiveClient(id);
  }, []);

  const refresh = useCallback(async () => { if (clientId) await cargar(clientId); }, [clientId, cargar]);

  return { clients, clientId, setClientId, estado, estadoRbac, loading, dataLoading, error, refresh };
}
