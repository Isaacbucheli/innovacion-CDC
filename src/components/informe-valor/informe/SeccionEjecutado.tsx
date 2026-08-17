import ReportBars from "@/components/reports/ReportBars";
import ReportLine from "@/components/reports/ReportLine";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import { REPORT_COLORS } from "@/lib/report";
import { etiquetaMes, fmtMonto, fmtNum, num, txt } from "@/lib/informeValor";
import type { InformeAccionEjecutada, InformeEjecutado } from "@/types";
import { Aviso, BloqueAusente, Cifra, Kpi, Seccion } from "./Piezas";

const MOTIVO_PROYECCION = "La proyección a fin de año no se pudo calcular para este rango.";

/**
 * Bloque titular del informe (`ejecutado`, decisión 2026-08-13): el acumulado de las acciones de
 * optimización ejecutadas en el período, modelo de la PPT de MERCANTIL.
 *
 * `medido` es independiente de tener filas: es `true` en cuanto CUALQUIER eje (barrido, matriz o
 * reservas) aporta algo que mostrar. Con `medido` en `false` la sección no dibuja una serie de
 * ceros bajo un título que afirma que hubo ahorro: declara el motivo y nada más.
 */
export default function SeccionEjecutado({ ej }: { ej: InformeEjecutado }) {
  if (!ej.medido) {
    return (
      <BloqueAusente
        titulo="Lo ejecutado y lo que acumula"
        motivo={ej.motivo ?? "No hay registro de acciones ejecutadas para este período."}
      />
    );
  }

  const serie = ej.serie.map((r) => ({ x: etiquetaMes(txt(r[0])), Acumulado: num(r[2]) }));
  const maxAcumulado = serie.reduce((m, s) => Math.max(m, s.Acumulado), 0);
  const oportunidades = ej.porOportunidad.slice(0, 11)
    .map((o) => ({ name: txt(o[0]), value: Math.round(num(o[1])) }));

  const cols: SimpleCol<InformeAccionEjecutada>[] = [
    { key: "oportunidad", label: "Acción", render: (f) => f.oportunidad },
    { key: "cat", label: "Categoría", render: (f) => f.cat },
    { key: "rec", label: "Recurso", render: (f) => f.rec ?? "—" },
    { key: "mes", label: "Mes", render: (f) => etiquetaMes(f.mes) },
    {
      key: "monto", label: "Ahorro mensual", align: "right",
      render: (f) => (f.monto === null
        ? <span className="text-muted-foreground">{f.sinMonto ?? "sin monto medible"}</span>
        : fmtMonto(f.monto)),
    },
    { key: "fuenteMonto", label: "Fuente", render: (f) => f.fuenteMonto ?? f.fuente },
  ];

  return (
    <Seccion
      titulo="Lo ejecutado y lo que acumula"
      descripcion="Cada acción de optimización ejecutada genera un ahorro mensual recurrente; el acumulado suma ese ahorro desde el mes en que se ejecutó, dentro de la ventana del informe."
      bloque="ahorroEjecutado"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Ahorro acumulado" valor={fmtMonto(ej.total)} hint="Del período" />
        <Kpi label="Tasa vigente" valor={fmtMonto(ej.tasaVigente)} hint="Por mes, al cierre del rango" />
        <Kpi
          label="Proyectado a fin de año"
          valor={<Cifra valor={ej.proyeccionFin} formato={fmtMonto} motivoSinMedir={MOTIVO_PROYECCION} />}
          hint="Acción por acción hasta diciembre, cortando cada reserva en su vencimiento"
        />
        <Kpi
          label="Acciones ejecutadas"
          valor={fmtNum(ej.filas.length)}
          hint={`${fmtMonto(ej.facturado)} medidos contra la facturación y ${fmtMonto(ej.estimado)} estimados por el catálogo`
            + (ej.sinMonto > 0 ? `, ${fmtNum(ej.sinMonto)} de ellas sin monto medible` : "")}
          tono="neutro"
        />
      </div>

      {serie.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <ReportLine
            data={serie}
            series={[{ key: "Acumulado", name: "Acumulado (USD)", color: REPORT_COLORS.greenDark }]}
            yDomain={[0, maxAcumulado > 0 ? Math.ceil(maxAcumulado * 1.1) : 1]}
            height={240}
          />
        </div>
      )}

      <ReportBars title="Distribución por oportunidad" color={REPORT_COLORS.greenDark} unit=" USD" data={oportunidades} />

      <SimpleTable cols={cols} rows={ej.filas} empty="Ninguna acción ejecutada en este período." />

      {(!ej.ejes.barridoMedido || !ej.ejes.reservasMedidas || ej.ejes.indeterminadas > 0) && (
        <Aviso>
          {!ej.ejes.barridoMedido && `Barrido de optimización: ${ej.ejes.barridoMotivo ?? "no se midió."} `}
          {!ej.ejes.reservasMedidas && `Reservas: ${ej.ejes.reservasMotivo ?? "no se midieron."} `}
          {ej.ejes.indeterminadas > 0 && `${fmtNum(ej.ejes.indeterminadas)} acción(es) tienen autoría `
            + "indeterminada: se resolvieron antes de que el barrido registrara quién las cerró."}
        </Aviso>
      )}
    </Seccion>
  );
}
