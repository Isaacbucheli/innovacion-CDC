import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export interface DonutDatum { name: string; value: number; color: string }

// Dona reutilizable para el informe (estado de VMs, SO, salud de recursos).
export default function ReportDonut({ title, data }: { title: string; data: DonutDatum[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      {total === 0 ? (
        <p className="text-xs text-muted-foreground py-10 text-center">Sin datos.</p>
      ) : (
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2} strokeWidth={0}>
                {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(value, name) => {
                const v = Number(value);
                return [`${v} (${total ? Math.round((v / total) * 100) : 0}%)`, name];
              }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
