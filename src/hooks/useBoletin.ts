import { useCallback, useEffect, useRef, useState } from "react";
import { getBoletin, listClients, syncBoletin } from "@/lib/api";
import type { BoletinView, ClientSummary } from "@/types";
import { resolveInitialClient, writeActiveClient } from "@/lib/clientSelection";

export interface UseBoletin {
  clients: ClientSummary[];
  clientId: number | null;
  view: BoletinView | null;
  loading: boolean;      // carga inicial (clientes)
  dataLoading: boolean;  // vista del cliente activo
  syncing: boolean;
  error: string;
  selectClient: (id: number) => void;
  sync: () => Promise<void>;
}

/** Estado del Boletín Azure: clientes + vista persistida del cliente activo. Espejo de useOptimization. */
export function useBoletin(): UseBoletin {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [view, setView] = useState<BoletinView | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const cs = await listClients();
        if (!mountedRef.current) return;
        setClients(cs);
        setClientId(resolveInitialClient(cs));
      } catch (e) {
        if (mountedRef.current) setError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, []);

  const loadFor = useCallback(async (cid: number) => {
    setDataLoading(true);
    setError("");
    try {
      const v = await getBoletin(cid);
      if (mountedRef.current) setView(v);
    } catch (e) {
      if (!mountedRef.current) return;
      setView(null);
      setError(e instanceof Error ? e.message : "Error al cargar el boletín");
    } finally {
      if (mountedRef.current) setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clientId == null) { setView(null); return; }
    loadFor(clientId);
  }, [clientId, loadFor]);

  const selectClient = useCallback((id: number) => {
    writeActiveClient(id);
    setClientId(id);
  }, []);

  const sync = useCallback(async () => {
    if (clientId == null) return;
    setSyncing(true);
    setError("");
    try {
      await syncBoletin(clientId);
      await loadFor(clientId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "La sincronización falló");
    } finally {
      if (mountedRef.current) setSyncing(false);
    }
  }, [clientId, loadFor]);

  return { clients, clientId, view, loading, dataLoading, syncing, error, selectClient, sync };
}
