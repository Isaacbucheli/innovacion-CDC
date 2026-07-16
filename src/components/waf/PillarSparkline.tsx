import { sparklinePoints, lastDelta } from "@/lib/scoreHistory";

// Mini-tendencia del score de un pilar dentro de su tarjeta. SVG liviano (no recharts).
export default function PillarSparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const W = 96;
  const H = 24;
  const pts = sparklinePoints(values, W, H);
  if (!pts) return null;
  const delta = lastDelta(values);
  return (
    <div data-testid="pillar-sparkline" className="mt-2 pt-2 border-t border-dashed border-border flex items-center gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden className="overflow-visible">
        <polyline fill="none" stroke={color} strokeWidth={1.6} points={pts} />
      </svg>
      {delta != null && (
        <span className={`text-[10px] font-semibold tabular-nums ${delta >= 0 ? "text-[#5a7016] dark:text-[#a9c46a]" : "text-red-600 dark:text-red-400"}`}>
          {delta >= 0 ? "▲" : "▼"} {delta >= 0 ? "+" : ""}{delta}
        </span>
      )}
    </div>
  );
}
