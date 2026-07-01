import { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureCurrentAnalysis,
  getCostResults,
  getInventorySummary,
  getScenarios,
  listActiveServices,
  listClients,
} from "@/lib/api";
import type {
  AnalysisSummary,
  ClientSummary,
  CostResult,
  InventoryRow,
  Scenario,
  ServiceCatalogItem,
} from "@/types";
import { resolveInitialClient, writeActiveClient } from "@/lib/clientSelection";

function isNotFound(e: unknown): boolean {
  return /404|not found/i.test(e instanceof Error ? e.message : "");
}

export interface UseCosts {
  clients: ClientSummary[];
  services: ServiceCatalogItem[];
  clientId: number | null;
  analysis: AnalysisSummary | null;
  results: CostResult[];
  scenarios: Scenario[];
  inventory: InventoryRow[];
  loading: boolean; // carga inicial (clientes + servicios)
  dataLoading: boolean; // carga de resultados/escenarios del cliente activo
  error: string;
  selectClient: (id: number) => void;
  reloadData: () => void;
  reloadInventory: () => void;
}

/**
 * Estado del módulo de costos: clientes/servicios (FastAPI) una vez, y por cliente
 * resuelve el análisis actual y carga resultados + escenarios (lecturas del backend .NET)
 * y el resumen de inventario (FastAPI).
 */
export function useCosts(): UseCosts {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisSummary | null>(null);
  const [results, setResults] = useState<CostResult[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Carga inicial: clientes + catálogo de servicios.
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [cs, sv] = await Promise.all([listClients(), listActiveServices()]);
        if (!mountedRef.current) return;
        setClients(cs);
        setServices(sv.filter((s) => !s.is_internal && s.service_key !== "sql_vm"));
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
      let an: AnalysisSummary | null = null;
      try {
        an = await ensureCurrentAnalysis(cid);
      } catch (e) {
        if (!isNotFound(e)) throw e; // sin evaluación activa: seguimos con datos vacíos
      }
      if (!mountedRef.current) return;
      setAnalysis(an);
      if (an) {
        const [r, s] = await Promise.all([getCostResults(an.analysis_id), getScenarios(an.analysis_id)]);
        let inv: InventoryRow[] = [];
        try {
          inv = await getInventorySummary(an.analysis_id);
        } catch {
          inv = []; // sin inventario importado todavía
        }
        if (!mountedRef.current) return;
        setResults(r);
        setScenarios(s);
        setInventory(inv);
      } else {
        setResults([]);
        setScenarios([]);
        setInventory([]);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setResults([]);
      setScenarios([]);
      setInventory([]);
      setError(e instanceof Error ? e.message : "Error al cargar costos");
    } finally {
      if (mountedRef.current) setDataLoading(false);
    }
  }, []);

  // Al cambiar de cliente, cargar sus datos.
  useEffect(() => {
    if (clientId == null) {
      setAnalysis(null);
      setResults([]);
      setScenarios([]);
      setInventory([]);
      return;
    }
    loadFor(clientId);
  }, [clientId, loadFor]);

  const selectClient = useCallback((id: number) => {
    writeActiveClient(id);
    setClientId(id);
  }, []);

  const reloadData = useCallback(() => {
    if (clientId != null) loadFor(clientId);
  }, [clientId, loadFor]);

  const reloadInventory = useCallback(async () => {
    if (!analysis) return;
    try {
      const inv = await getInventorySummary(analysis.analysis_id);
      if (mountedRef.current) setInventory(inv);
    } catch {
      if (mountedRef.current) setInventory([]);
    }
  }, [analysis]);

  return {
    clients, services, clientId, analysis, results, scenarios, inventory,
    loading, dataLoading, error, selectClient, reloadData, reloadInventory,
  };
}
