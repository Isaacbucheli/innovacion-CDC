import { useState } from "react";
import { sparklineCoords, lastDelta } from "@/lib/scoreHistory";

// Mini "Score history" del pilar dentro de su tarjeta: área con relleno tenue + línea + tooltip
// (mes · score) al pasar el mouse. SVG liviano (no recharts); dots/tooltip como overlay HTML para
// no distorsionarse con el escalado horizontal (preserveAspectRatio="none").
const W = 164;
const H = 52;
const PAD = 6;
const BASE = H - PAD; // y del 0%

export default function PillarSparkline({ values, labels, color }: {
  values: (number | null)[];
  labels?: string[];
  color: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const coords = sparklineCoords(values, W, H, PAD);
  if (coords.length < 2) return null;

  const delta = lastDelta(values);
  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const first = coords[0];
  const last = coords[coords.length - 1];
  const area = `M ${coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" L ")} L ${last.x.toFixed(1)},${BASE} L ${first.x.toFixed(1)},${BASE} Z`;
  const gid = `spark-grad-${color.replace(/[^a-z0-9]/gi, "")}`;
  const act = active != null ? coords.find((c) => c.index === active) : undefined;
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  // Chip de tendencia: 3 estados. Un delta 0 se muestra NEUTRO (gris, "±0"), no como una
  // flecha verde de subida — así no engaña al cliente cuando el score quedó igual.
  const trend = delta == null ? null : {
    cls: delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-[#5a7016] dark:text-[#a9c46a]" : "text-red-600 dark:text-red-400",
    label: delta === 0 ? "±0" : `${delta > 0 ? "▲ +" : "▼ "}${delta}`,
  };

  return (
    <div data-testid="pillar-sparkline" className="mt-2 pt-2 border-t border-dashed border-border">
      <div className="flex items-end gap-2">
        <div className="relative flex-1" onMouseLeave={() => setActive(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full h-[52px]" aria-hidden>
            <defs>
              <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity={0.22} />
                <stop offset="1" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <line x1="0" y1={BASE} x2={W} y2={BASE} stroke="currentColor" className="text-border" strokeWidth={1} />
            <path d={area} fill={`url(#${gid})`} />
            <polyline fill="none" stroke={color} strokeWidth={2} points={line} vectorEffect="non-scaling-stroke" />
            {/* zonas de hover transparentes por punto (las transforma el escalado pero el evento no depende del tamaño) */}
            {coords.map((c, i) => (
              <rect
                key={c.index}
                data-testid="spark-hit"
                x={i === 0 ? 0 : (coords[i - 1].x + c.x) / 2}
                y={0}
                width={(i === coords.length - 1 ? W : (coords[i + 1].x + c.x) / 2) - (i === 0 ? 0 : (coords[i - 1].x + c.x) / 2)}
                height={H}
                fill="transparent"
                onMouseEnter={() => setActive(c.index)}
              />
            ))}
          </svg>
          {/* punto final (overlay HTML, sin distorsión) */}
          <span
            className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{ left: pct(last.x, W), top: pct(last.y, H), background: color }}
          />
          {act && (
            <>
              <span
                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-background pointer-events-none"
                style={{ left: pct(act.x, W), top: pct(act.y, H), borderColor: color }}
              />
              <div
                role="tooltip"
                className="absolute z-10 -translate-x-1/2 -translate-y-full rounded bg-foreground px-1.5 py-0.5 text-[9px] font-semibold text-background whitespace-nowrap pointer-events-none"
                style={{ left: pct(act.x, W), top: pct(act.y, H) }}
              >
                {labels?.[act.index] ? `${labels[act.index]} · ` : ""}{Math.round(act.value)}%
              </div>
            </>
          )}
        </div>
        {trend && (
          <span className={`shrink-0 text-[10px] font-semibold tabular-nums ${trend.cls}`}>
            {trend.label}
          </span>
        )}
      </div>
    </div>
  );
}
