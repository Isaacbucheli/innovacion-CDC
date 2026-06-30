import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export interface BarDatum { name: string; value: number }

// Barras horizontales (top-N) para CPU/RAM/plantillas del informe.
export default function ReportBars({ title, data, color, unit = "", onClickBar }: {
  title: string;
  data: BarDatum[];
  color: string;
  unit?: string;
  onClickBar?: (name: string) => void;
}) {
  const height = Math.max(120, data.length * 26 + 20);
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">Sin datos.</p>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }}
              onClick={onClickBar ? (s) => { const l = s?.activeLabel; if (l) onClickBar(String(l)); } : undefined}>
              <XAxis type="number" hide domain={[0, "dataMax"]} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} interval={0} />
              <Tooltip formatter={(v) => [`${v}${unit}`, ""]} cursor={{ fill: "transparent" }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {data.map((d) => <Cell key={d.name} fill={color} cursor={onClickBar ? "pointer" : "default"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
