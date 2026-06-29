import { useState } from "react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import WafClientHeader from "@/components/waf/WafClientHeader";
import WafKpis from "@/components/waf/WafKpis";
import PillarCards from "@/components/waf/PillarCards";
import WafDataTable from "@/components/waf/WafDataTable";
import WafDetailDialog from "@/components/waf/WafDetailDialog";
import { useWaf } from "@/hooks/useWaf";
import { filterRecommendations } from "@/lib/waf";

export default function WafPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const waf = useWaf();
  const [pillar, setPillar] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = filterRecommendations(waf.recommendations, { pillar });
  const avgProgress = waf.recommendations.length
    ? Math.round(waf.recommendations.reduce((s, r) => s + r.completion_pct, 0) / waf.recommendations.length)
    : 0;

  function open(canonicalId: number) { setOpenId(canonicalId); setDialogOpen(true); }

  return (
    <AppShell title="Recomendaciones" subtitle="Matriz mejoras Azure · Well-Architected" active="waf" onNavigate={onNavigate}
      headerRight={<WafClientHeader clients={waf.clients} clientId={waf.clientId} onSelect={waf.selectClient} />}>
      <BusyOverlay show={waf.loading || waf.dataLoading} title="Cargando recomendaciones" />
      <div className="space-y-5">
        <WafKpis summary={waf.summary} avgProgress={avgProgress} />
        <PillarCards sections={waf.sections} activePillar={pillar} onPick={setPillar} scores={waf.scores} />
        {waf.error && <p className="text-sm text-destructive">{waf.error}</p>}
        <WafDataTable recommendations={filtered} pillarNames={waf.pillarNames} minPct={0} maxPct={100} onOpen={open} />
      </div>
      <WafDetailDialog
        clientId={waf.clientId ?? 0}
        canonicalId={openId}
        pillarName={openId != null ? (waf.pillarNames[waf.recommendations.find((r) => r.canonical_id === openId)?.pillar_number ?? 0] ?? "") : ""}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onChanged={waf.reloadData}
      />
    </AppShell>
  );
}
