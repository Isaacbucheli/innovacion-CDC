import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getWafAdvisorScore, getWafRecommendations, getWafSections, getWafSummary, listClientsAdmin } from "@/lib/api";
import { resolveInitialClient, writeActiveClient } from "@/lib/clientSelection";
import type { ClientAdmin, WafRecommendation, WafSection, WafSummary } from "@/types";

export function useWaf() {
  const [clients, setClients] = useState<ClientAdmin[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [summary, setSummary] = useState<WafSummary | null>(null);
  const [sections, setSections] = useState<WafSection[]>([]);
  const [recommendations, setRecommendations] = useState<WafRecommendation[]>([]);
  const [scores, setScores] = useState<Record<number, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    (async () => {
      setLoading(true); setError("");
      try {
        const cs = await listClientsAdmin();
        if (!mountedRef.current) return;
        setClients(cs);
        setClientId(resolveInitialClient(cs));
      } catch (e) {
        if (mountedRef.current) setError(e instanceof Error ? e.message : "Error al cargar clientes");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, []);

  const loadFor = useCallback(async (cid: number) => {
    setDataLoading(true); setError("");
    try {
      const [sum, secs, recs] = await Promise.all([
        getWafSummary(cid), getWafSections(cid), getWafRecommendations(cid),
      ]);
      if (!mountedRef.current) return;
      setSummary(sum); setSections(secs); setRecommendations(recs);
      // Advisor Score: enriquecimiento best-effort; si falla o no hay conexión, no rompe la vista.
      let sc: Record<number, number> | null = null;
      try {
        const a = await getWafAdvisorScore(cid);
        if (a?.has_connection && a.pillars) {
          sc = {};
          for (const [k, v] of Object.entries(a.pillars)) sc[Number(k)] = Math.round(Number(v) || 0);
        }
      } catch { sc = null; }
      if (mountedRef.current) setScores(sc);
    } catch (e) {
      if (!mountedRef.current) return;
      setSummary(null); setSections([]); setRecommendations([]); setScores(null);
      setError(e instanceof Error ? e.message : "Error al cargar WAF");
    } finally {
      if (mountedRef.current) setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clientId == null) { setSummary(null); setSections([]); setRecommendations([]); setScores(null); return; }
    loadFor(clientId);
  }, [clientId, loadFor]);

  const pillarNames = useMemo(() => {
    const m: Record<number, string> = {};
    for (const s of sections) m[s.section_num] = s.section_name;
    return m;
  }, [sections]);

  const selectClient = useCallback((id: number) => {
    writeActiveClient(id);
    setClientId(id);
  }, []);

  const reloadData = useCallback(() => { if (clientId != null) loadFor(clientId); }, [clientId, loadFor]);

  return { clients, clientId, summary, sections, recommendations, scores, pillarNames, loading, dataLoading, error, selectClient, reloadData };
}
