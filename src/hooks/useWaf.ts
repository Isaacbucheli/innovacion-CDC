import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getWafAdvisorScore, getWafRecommendations, getWafScoreHistory, getWafSections, getWafSubscriptions, getWafSummary, listClientsAdmin, markWafRecommendationRead } from "@/lib/api";
import { resolveInitialClient, writeActiveClient } from "@/lib/clientSelection";
import type { ClientAdmin, WafRecommendation, WafScoreHistory, WafSection, WafSubscriptionOption, WafSummary } from "@/types";

export function useWaf() {
  const [clients, setClients] = useState<ClientAdmin[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [summary, setSummary] = useState<WafSummary | null>(null);
  const [sections, setSections] = useState<WafSection[]>([]);
  const [recommendations, setRecommendations] = useState<WafRecommendation[]>([]);
  const [scores, setScores] = useState<Record<number, number> | null>(null);
  const [scoreFiltered, setScoreFiltered] = useState(true);
  const [history, setHistory] = useState<WafScoreHistory | null>(null);
  const [subscriptionOptions, setSubscriptionOptions] = useState<WafSubscriptionOption[]>([]);
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<string[]>([]);
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

  const loadFor = useCallback(async (cid: number, subs: string[]) => {
    setDataLoading(true); setError("");
    try {
      const [sum, secs, recs] = await Promise.all([
        getWafSummary(cid, subs), getWafSections(cid, subs), getWafRecommendations(cid, undefined, subs),
      ]);
      if (!mountedRef.current) return;
      setSummary(sum); setSections(secs); setRecommendations(recs);
      // Advisor Score: enriquecimiento best-effort; si falla o no hay conexión, no rompe la vista.
      let sc: Record<number, number> | null = null;
      let filtered = true;
      try {
        const a = await getWafAdvisorScore(cid, subs);
        if (a?.has_connection && a.pillars) {
          sc = {};
          for (const [k, v] of Object.entries(a.pillars)) sc[Number(k)] = Math.round(Number(v) || 0);
        }
        // Snapshot viejo sin breakdown: el score mostrado es del cliente completo, no de la selección.
        filtered = subs.length === 0 || a?.filter_applied !== false;
      } catch { sc = null; }
      if (mountedRef.current) { setScores(sc); setScoreFiltered(filtered); }
      // Histórico mensual para las sparklines de las tarjetas; best-effort.
      let hist: WafScoreHistory | null = null;
      try { hist = await getWafScoreHistory(cid, "month"); } catch { hist = null; }
      if (mountedRef.current) setHistory(hist);
    } catch (e) {
      if (!mountedRef.current) return;
      setSummary(null); setSections([]); setRecommendations([]); setScores(null); setHistory(null);
      setError(e instanceof Error ? e.message : "Error al cargar WAF");
    } finally {
      if (mountedRef.current) setDataLoading(false);
    }
  }, []);

  // Al cambiar de cliente se limpia la selección: las suscripciones son de otro.
  useEffect(() => {
    setSelectedSubscriptions([]);
    if (clientId == null) { setSubscriptionOptions([]); return; }
    let cancelled = false;
    getWafSubscriptions(clientId)
      .then((opts) => { if (!cancelled && mountedRef.current) setSubscriptionOptions(opts); })
      .catch(() => { if (!cancelled && mountedRef.current) setSubscriptionOptions([]); });
    return () => { cancelled = true; };
  }, [clientId]);

  // La clave por valor evita recargar cuando el array cambia de identidad pero no de contenido.
  const subsKey = selectedSubscriptions.join(",");
  useEffect(() => {
    if (clientId == null) { setSummary(null); setSections([]); setRecommendations([]); setScores(null); setHistory(null); return; }
    loadFor(clientId, subsKey ? subsKey.split(",") : []);
  }, [clientId, subsKey, loadFor]);

  const pillarNames = useMemo(() => {
    const m: Record<number, string> = {};
    for (const s of sections) m[s.section_num] = s.section_name;
    return m;
  }, [sections]);

  const selectClient = useCallback((id: number) => {
    writeActiveClient(id);
    setClientId(id);
  }, []);

  const reloadData = useCallback(
    () => { if (clientId != null) loadFor(clientId, selectedSubscriptions); },
    [clientId, selectedSubscriptions, loadFor],
  );

  const markRecommendationRead = useCallback((canonicalId: number) => {
    if (clientId == null) return;
    setRecommendations((prev) => prev.map((r) => (r.canonical_id === canonicalId ? { ...r, is_new: false } : r)));
    void markWafRecommendationRead(clientId, canonicalId).catch(() => { /* best-effort: la vista ya se actualizó */ });
  }, [clientId]);

  return {
    clients, clientId, summary, sections, recommendations, scores, scoreFiltered, history, pillarNames,
    subscriptionOptions, selectedSubscriptions, setSelectedSubscriptions,
    loading, dataLoading, error, selectClient, reloadData, markRecommendationRead,
  };
}
