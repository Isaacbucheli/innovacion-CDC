import { useCallback, useEffect, useRef, useState } from "react";
import { getOptimizationAccess, getScanFindings, listClients, listOptimizationScans } from "@/lib/api";
import type { ClientSummary, OptFinding, OptScan } from "@/types";
import { resolveInitialClient, writeActiveClient } from "@/lib/clientSelection";

export interface UseOptimization {
  clients: ClientSummary[];
  clientId: number | null;
  allowed: boolean | null; // null = aún resolviendo el gating
  scans: OptScan[];
  latestScan: OptScan | null;
  findings: OptFinding[];
  loading: boolean; // carga inicial (acceso + clientes)
  dataLoading: boolean; // scans/findings del cliente activo
  error: string;
  selectClient: (id: number) => void;
  reload: () => void;
}

/** Barrido más reciente con resultados (completed); si no hay, el más reciente que sea. */
function pickLatest(scans: OptScan[]): OptScan | null {
  return scans.find((s) => s.status === "completed") ?? scans[0] ?? null;
}

/**
 * Estado del módulo de Optimización Azure: chequea el gating (rol+email vía backend),
 * lista clientes y, por cliente, carga el historial de barridos y los hallazgos del último.
 * Espejo de useCosts.
 */
export function useOptimization(): UseOptimization {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [scans, setScans] = useState<OptScan[]>([]);
  const [latestScan, setLatestScan] = useState<OptScan | null>(null);
  const [findings, setFindings] = useState<OptFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Inicial: gating + clientes.
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const access = await getOptimizationAccess().catch(() => ({ allowed: false }));
        if (!mountedRef.current) return;
        setAllowed(access.allowed);
        if (access.allowed) {
          const cs = await listClients();
          if (!mountedRef.current) return;
          setClients(cs);
          setClientId(resolveInitialClient(cs));
        }
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
      const list = await listOptimizationScans(cid);
      if (!mountedRef.current) return;
      setScans(list);
      const latest = pickLatest(list);
      setLatestScan(latest);
      if (latest) {
        const f = await getScanFindings(latest.scan_id);
        if (!mountedRef.current) return;
        setFindings(f);
      } else {
        setFindings([]);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setScans([]);
      setLatestScan(null);
      setFindings([]);
      setError(e instanceof Error ? e.message : "Error al cargar el barrido");
    } finally {
      if (mountedRef.current) setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed !== true || clientId == null) {
      setScans([]);
      setLatestScan(null);
      setFindings([]);
      return;
    }
    loadFor(clientId);
  }, [allowed, clientId, loadFor]);

  const selectClient = useCallback((id: number) => {
    writeActiveClient(id);
    setClientId(id);
  }, []);

  const reload = useCallback(() => {
    if (clientId != null) loadFor(clientId);
  }, [clientId, loadFor]);

  return {
    clients, clientId, allowed, scans, latestScan, findings,
    loading, dataLoading, error, selectClient, reload,
  };
}
