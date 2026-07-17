import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ReportLine, { type LineSeries } from "@/components/reports/ReportLine";
import { getWafScoreHistory } from "@/lib/api";
import { formatHistoryLabel } from "@/lib/scoreHistory";
import { AZURE_BLUE, pillarColor } from "@/lib/waf";
import type { WafScoreHistory } from "@/types";

type Gran = "day" | "week" | "month";
const GRANS: { key: Gran; label: string }[] = [
  { key: "day", label: "Diario" }, { key: "week", label: "Semanal" }, { key: "month", label: "Mensual" },
];
const PILLARS = [1, 2, 3, 4, 5];

export default function ScoreHistorySheet({ clientId, open, onOpenChange, pillarNames }: {
  clientId: number; open: boolean; onOpenChange: (o: boolean) => void; pillarNames: Record<number, string>;
}) {
  const [gran, setGran] = useState<Gran>("month");
  const [history, setHistory] = useState<WafScoreHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState<Set<string>>(new Set(["global", "p1", "p2", "p3", "p4", "p5"]));

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    getWafScoreHistory(clientId, gran)
      .then((h) => { if (alive) setHistory(h); })
      .catch(() => { if (alive) setHistory(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, clientId, gran]);

  const allSeries: LineSeries[] = [
    { key: "global", name: "Global", color: AZURE_BLUE },
    ...PILLARS.map((k) => ({ key: `p${k}`, name: pillarNames[k] ?? `Pilar ${k}`, color: pillarColor(k) })),
  ];
  // Cast: los huecos (undefined) son intencionales (pilar/global sin dato ese período no debe
  // graficarse como 0); ReportLine tipa su prop como string|number, pero recharts trata
  // undefined como salto de línea válido.
  const data = (history?.series ?? []).map((p) => ({
    x: formatHistoryLabel(p.date, gran),
    global: p.global ?? undefined,
    p1: p.pillars["1"] ?? undefined, p2: p.pillars["2"] ?? undefined, p3: p.pillars["3"] ?? undefined,
    p4: p.pillars["4"] ?? undefined, p5: p.pillars["5"] ?? undefined,
  })) as Record<string, string | number>[];
  const shown = allSeries.filter((s) => visible.has(s.key));

  function toggle(key: string) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader><SheetTitle>Histórico del Advisor score</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="inline-flex gap-1 rounded-md bg-secondary p-1">
            {GRANS.map((g) => (
              <button key={g.key} type="button" onClick={() => setGran(g.key)}
                className={`text-xs px-3 py-1 rounded ${gran === g.key ? "bg-background font-semibold text-primary shadow-sm" : "text-muted-foreground"}`}>
                {g.label}
              </button>
            ))}
          </div>

          {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!loading && data.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin histórico disponible todavía. Actualiza el Advisor Score para empezar a acumularlo.</p>
          )}
          {!loading && data.length > 0 && (
            <>
              <ReportLine data={data} series={shown} yDomain={[0, 100]} height={260} />
              <div className="flex flex-wrap gap-2">
                {allSeries.map((s) => {
                  const on = visible.has(s.key);
                  return (
                    <button key={s.key} type="button" onClick={() => toggle(s.key)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${on ? "border-border" : "border-border opacity-50 line-through"}`}>
                      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
