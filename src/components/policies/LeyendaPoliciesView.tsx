import { FASES_IMPLEMENTACION, LEYENDA_POLICIES, PARAMETROS_SUGERIDOS } from "@/data/leyendaPolicies";

// Leyenda del Catálogo de políticas: significado de columnas + fases de implementación +
// parámetros sugeridos (hojas "Resumen" y "Parámetros sugeridos" del Excel de línea base).
// Mismo markup/estilo que LeyendaView del Catálogo de alertas.
export default function LeyendaPoliciesView() {
  return (
    <div className="py-4 space-y-6">
      <section>
        <h3 className="text-sm font-semibold mb-2">Significado de columnas</h3>
        <div className="bg-background border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left"><tr><th className="p-3 font-medium">Columna</th><th className="p-3 font-medium">Significado</th></tr></thead>
            <tbody>
              {LEYENDA_POLICIES.map((r, i) => (
                <tr key={i} className="border-t"><td className="p-3 font-medium align-top">{r.columna}</td><td className="p-3 text-muted-foreground">{r.significado}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Fases de implementación</h3>
        <div className="bg-background border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left"><tr><th className="p-3 font-medium">Fase</th><th className="p-3 font-medium">Acción</th><th className="p-3 font-medium">Resultado esperado</th></tr></thead>
            <tbody>
              {FASES_IMPLEMENTACION.map((r) => (
                <tr key={r.fase} className="border-t">
                  <td className="p-3 font-medium align-top tabular-nums">{r.fase}</td>
                  <td className="p-3 align-top">{r.accion}</td>
                  <td className="p-3 text-muted-foreground">{r.resultado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Parámetros sugeridos</h3>
        <div className="bg-background border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3 font-medium">Parámetro</th>
                <th className="p-3 font-medium">Valor sugerido</th>
                <th className="p-3 font-medium">Aplica a</th>
                <th className="p-3 font-medium">Notas</th>
                <th className="p-3 font-medium">Prioridad</th>
                <th className="p-3 font-medium">Ejemplo</th>
              </tr>
            </thead>
            <tbody>
              {PARAMETROS_SUGERIDOS.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="p-3 font-medium align-top">{r.parametro}</td>
                  <td className="p-3 align-top">{r.valorSugerido}</td>
                  <td className="p-3 align-top">{r.aplicaA}</td>
                  <td className="p-3 text-muted-foreground align-top">{r.notas}</td>
                  <td className="p-3 align-top">{r.prioridad}</td>
                  <td className="p-3 align-top font-mono text-xs">{r.ejemplo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
