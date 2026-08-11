import { useCallback, useEffect, useRef, useState } from "react";
import { getInformeValorEstado, listClients } from "@/lib/api";
import { resolveInitialClient, writeActiveClient } from "@/lib/clientSelection";
import type { ClientSummary, EstadoRbacInfo, InformeValorEstado } from "@/types";

export function useInformeValor() {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [clientId, setClientIdState] = useState<number | null>(null);
  const [estado, setEstado] = useState<InformeValorEstado | null>(null);
  // Condicional de RBAC: viaja DENTRO de `estado` (estado_rbac, resuelta por el camino liviano --
  // ver InformeValorController.Estado en la API), pero se guarda en su propio estado para que la
  // tarjeta de RBAC no tenga que cambiar cómo lee este dato. Hasta la entrega 2b salía de su
  // propio GET (/insumos-bd, el endpoint de diagnóstico) y se pedía en paralelo con `estado`; ese
  // endpoint paga Advisor/Matriz/Retiros completos y esta pantalla no necesita nada de eso.
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
      const e = await getInformeValorEstado(id);
      if (mounted.current) { setEstado(e); setEstadoRbac(e.estado_rbac); }
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
