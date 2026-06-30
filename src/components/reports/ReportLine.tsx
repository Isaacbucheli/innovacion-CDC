import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";

export interface LineSeries { key: string; name: string; color: string }

// Gráfico de línea (serie temporal): performance diaria de VM, Advisor Score por mes, etc.
export default function ReportLine({ data, series, yDomain = [0, 100], height = 220 }: {
  data: Record<string, string | number>[];
  series: LineSeries[];
  yDomain?: [number, number];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -8, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
          <XAxis dataKey="x" tick={{ fontSize: 10 }} minTickGap={20} />
          <YAxis domain={yDomain} tick={{ fontSize: 10 }} width={32} />
          <Tooltip />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} dot={false} strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
