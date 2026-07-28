import { useState } from "react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import ClientHeader from "@/components/ClientHeader";
import WafKpis from "@/components/waf/WafKpis";
import PillarCards from "@/components/waf/PillarCards";
import WafDataTable from "@/components/waf/WafDataTable";
import WafDetailDialog from "@/components/waf/WafDetailDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWaf } from "@/hooks/useWaf";
import { filterRecommendations } from "@/lib/waf";
import WafActions from "@/components/waf/WafActions";

// Buckets de avance para el filtro (min/max %). Espejo del patrón de Reservas.
const AVANCE: Record<string, [number, number]> = {
  all: [0, 100], none: [0, 0], wip: [1, 99], done: [100, 100],
};

export default function WafPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const waf = useWaf();
  const [pillar, setPillar] = useState<number | null>(null);
  const [avance, setAvance] = useState("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [english, setEnglish] = useState(false);

  const [minPct, maxPct] = AVANCE[avance] ?? AVANCE.all;
  const filtered = filterRecommendations(waf.recommendations, { pillar });
  const avgProgress = waf.recommendations.length
    ? Math.round(waf.recommendations.reduce((s, r) => s + r.completion_pct, 0) / waf.recommendations.length)
    : 0;
  const highImpact = waf.sections.reduce((s, x) => s + (x.high_recs ?? 0), 0);
  // Fila abierta (de la lista): permite mostrar el título del detalle al instante, sin esperar la carga.
  const openRec = openId != null ? waf.recommendations.find((r) => r.canonical_id === openId) : undefined;
  // En inglés el provisional usa el original de Azure si existe: si no, se vería español por un
  // instante en una tabla que ya está en inglés.
  const fallbackTitle = openRec
    ? `${openRec.matrix_code} · ${(english ? openRec.advisor_name_en : null) ?? openRec.review_scope_es ?? "Recomendación"}`
    : undefined;

  function open(canonicalId: number) { setOpenId(canonicalId); setDialogOpen(true); waf.markRecommendationRead(canonicalId); }

  return (
    <AppShell title="Recomendaciones" subtitle="Matriz mejoras Azure · Well-Architected" active="waf" onNavigate={onNavigate}
      headerRight={<ClientHeader clients={waf.clients} clientId={waf.clientId} onSelect={waf.selectClient} />}>
      <BusyOverlay show={waf.loading || waf.dataLoading} title="Cargando recomendaciones" />
      <div className="space-y-5">
        {waf.clientId != null && <WafActions clientId={waf.clientId} onChanged={waf.reloadData} pillarNames={waf.pillarNames} />}
        <WafKpis summary={waf.summary} avgProgress={avgProgress} highImpact={highImpact} />
        <PillarCards sections={waf.sections} activePillar={pillar} onPick={setPillar} scores={waf.scores} history={waf.history} />
        {waf.error && <p className="text-sm text-destructive">{waf.error}</p>}
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">Avance</span>
          <Select value={avance} onValueChange={setAvance}>
            <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Avance: todos</SelectItem>
              <SelectItem value="none">Sin iniciar (0%)</SelectItem>
              <SelectItem value="wip">En curso (1–99%)</SelectItem>
              <SelectItem value="done">Completado (100%)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <WafDataTable recommendations={filtered} pillarNames={waf.pillarNames} minPct={minPct} maxPct={maxPct} onOpen={open} english={english} onEnglishChange={setEnglish} />
      </div>
      <WafDetailDialog
        clientId={waf.clientId ?? 0}
        canonicalId={openId}
        pillarName={openRec ? (waf.pillarNames[openRec.pillar_number] ?? "") : ""}
        fallbackTitle={fallbackTitle}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onChanged={waf.reloadData}
        english={english}
      />
    </AppShell>
  );
}
