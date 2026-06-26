import { LEYENDA } from "@/data/leyenda";

export default function LeyendaView() {
  return (
    <div className="py-4">
      <div className="bg-background border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr><th className="p-3 font-medium">Columna</th><th className="p-3 font-medium">Significado</th></tr></thead>
          <tbody>
            {LEYENDA.map((r, i) => (
              <tr key={i} className="border-t"><td className="p-3 font-medium align-top">{r.columna}</td><td className="p-3 text-muted-foreground">{r.significado}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
