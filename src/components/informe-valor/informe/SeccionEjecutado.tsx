import ReportBars from "@/components/reports/ReportBars";
import ReportLine from "@/components/reports/ReportLine";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import { REPORT_COLORS } from "@/lib/report";
import { etiquetaMes, fmtMonto, fmtNum, num, txt } from "@/lib/informeValor";
import type {
  InformeAccionEjecutada, InformeEjecutado, InformeReservaArchivoFila, InformeReservasArchivo,
  InformeReservaVm, InformeReservasFacturadas,
} from "@/types";
import { Aviso, BloqueAusente, Cifra, Kpi, Seccion } from "./Piezas";

const MOTIVO_PROYECCION = "La proyección a fin de año no se pudo calcular para este rango.";

/**
 * Bloque titular del informe (`ejecutado`, decisión 2026-08-13): el acumulado de las acciones de
 * optimización ejecutadas en el período, modelo de la PPT de referencia.
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
    { key: "rec", label: "Recurso", render: (f) => f.rec ?? "" },
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
    <div className="space-y-8">
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
            hint={`${fmtMonto(ej.facturado)} medidos contra la facturación, ${fmtMonto(ej.estimado)} estimados por el catálogo`
              + ` y ${fmtMonto(ej.declarado)} declarados por el consultor`
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

      <SeccionReservas reservas={ej.reservas} />
    </div>
  );
}

/**
 * La tabla de reservas contra la propia factura (bloque `reservasFacturadas`): por cada VM cubierta
 * por una instancia reservada, lo que costaba a tarifa por demanda antes de la compra contra lo que
 * factura la reserva cada mes. Vive en este archivo, no en su propia pestaña, porque es un eje de
 * `ej` igual que el barrido y la matriz -- el mismo dato que resume la fila de la pestaña de entrega.
 *
 * Sin esta tabla el consultor aprobaba `reservasFacturadas` con un solo agregado a la vista (VM y
 * ahorro/mes) y ninguna fila que lo respalde: exactamente el defecto que más se repite en este
 * módulo, alguien aprobando una cifra que nunca pudo revisar.
 */
function SeccionReservas({ reservas }: { reservas: InformeReservasFacturadas }) {
  if (!reservas.medido) {
    return (
      <BloqueAusente
        titulo="Reservas contra la factura"
        motivo={reservas.motivo ?? "No se pudieron leer las reservas del cliente."}
      />
    );
  }

  // Entrega 8, pieza A: modo respaldo. La foto de Azure no midió pero el archivo de evolución
  // trae las líneas de reserva: tabla POR LÍNEA (sin foto no se sabe qué VMs cubre cada reserva,
  // y eso no se inventa), con el cargo facturado y el ahorro estimado por catálogo de precios.
  if (reservas.respaldo) {
    return <SeccionReservasRespaldo reservas={reservas} respaldo={reservas.respaldo} />;
  }

  const cols: SimpleCol<InformeReservaVm>[] = [
    {
      key: "vm", label: "VM",
      render: (f) => <>{f.vm}{f.compartida && <span className="ml-1 text-xs text-muted-foreground">(compartida)</span>}</>,
    },
    { key: "sku", label: "SKU", render: (f) => f.sku ?? "" },
    {
      key: "demanda", label: "Por demanda", align: "right",
      render: (f) => <Cifra valor={f.demanda} formato={fmtMonto}
        motivoSinMedir="Sin mes base en la facturación anterior al inicio de la reserva." />,
    },
    { key: "reserva", label: "Reserva facturada", align: "right", render: (f) => fmtMonto(f.reserva) },
    {
      key: "ahorro", label: "Ahorro", align: "right",
      render: (f) => <Cifra valor={f.ahorro} formato={fmtMonto}
        motivoSinMedir="Sin el mes base no hay contra qué medir el ahorro." />,
    },
    {
      key: "vence", label: "Vence",
      render: (f) => (f.vence
        ? <>{f.vence}{f.porVencer && <span className="ml-1 font-medium text-amber-700 dark:text-amber-400">próxima a vencer</span>}</>
        : ""),
    },
  ];

  return (
    <Seccion
      titulo="Reservas contra la factura"
      bloque="reservasFacturadas"
      descripcion="Por cada VM cubierta por una instancia reservada: lo que costaba a tarifa por demanda antes de comprarla contra lo que factura la reserva cada mes."
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="VM cubiertas" valor={fmtNum(reservas.filas.length)} tono="neutro" />
        <Kpi label="Por demanda (total)" valor={fmtMonto(reservas.totalDemanda)} tono="neutro" />
        <Kpi label="Reserva facturada (total)" valor={fmtMonto(reservas.totalReserva)} tono="neutro" />
        <Kpi label="Ahorro mensual" valor={fmtMonto(reservas.totalAhorro)} hint={`${fmtMonto(reservas.ahorroAnualizado)} anualizado`} />
      </div>

      <SimpleTable cols={cols} rows={reservas.filas} empty="Ninguna VM está cubierta por una instancia reservada en este rango." />

      {reservas.sinLineaEnEvolucion.length > 0 && (
        <Aviso>
          Reservas sin línea en el archivo de evolución: {reservas.sinLineaEnEvolucion.join(", ")}. No
          se les puede calcular el ahorro contra la factura, así que quedan fuera de los totales.
        </Aviso>
      )}
      {reservas.consumidoresNoLeidos > 0 && (
        <Aviso>
          {fmtNum(reservas.consumidoresNoLeidos)} reserva(s) no devolvieron su lista de consumidores;
          su cobertura puede estar incompleta.
        </Aviso>
      )}
    </Seccion>
  );
}

/**
 * El modo respaldo de la tabla de reservas (entrega 8, pieza A): las líneas de reserva del archivo
 * de evolución cuando la foto de Azure no midió. Mismo bloque económico que la tabla por VM
 * (`reservasFacturadas`): son la misma conversación de dinero por otra vía.
 */
function SeccionReservasRespaldo({
  reservas, respaldo,
}: { reservas: InformeReservasFacturadas; respaldo: InformeReservasArchivo }) {
  const cols: SimpleCol<InformeReservaArchivoFila>[] = [
    {
      key: "sku", label: "Reserva",
      render: (f) => (
        <>
          {f.sku}
          {f.heredada && <span className="ml-1 text-xs text-muted-foreground">(desde antes del rango)</span>}
        </>
      ),
    },
    { key: "term", label: "Término", render: (f) => f.term },
    {
      key: "cargo", label: "Cargo mensual", align: "right",
      render: (f) => <Cifra valor={f.cargo} formato={fmtMonto} motivoSinMedir="El cargo no se publicó." />,
    },
    {
      key: "ahorro", label: "Ahorro estimado", align: "right",
      render: (f) => (f.ahorro === null
        ? <span className="text-muted-foreground">{f.sinMonto ?? "sin precio de catálogo"}</span>
        : fmtMonto(f.ahorro)),
    },
    { key: "desde", label: "Desde", render: (f) => etiquetaMes(f.desde) },
    { key: "vence", label: "Vence", render: (f) => (f.vence ? etiquetaMes(f.vence) : "") },
  ];

  return (
    <Seccion
      titulo="Reservas contra la factura"
      bloque="reservasFacturadas"
      descripcion="Reservas leídas desde el archivo de evolución (respaldo): la conexión Azure del cliente no estaba disponible, así que no hay confirmación de cobertura por VM. Por cada línea: el cargo mensual facturado y el ahorro estimado por catálogo de precios."
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Líneas de reserva" valor={fmtNum(respaldo.filas.length)} tono="neutro" />
        <Kpi
          label="Cargo mensual (total)"
          valor={<Cifra valor={respaldo.totalCargo} formato={fmtMonto} motivoSinMedir="El cargo no se publicó." />}
          tono="neutro"
        />
        <Kpi
          label="Ahorro estimado"
          valor={<Cifra valor={respaldo.totalAhorro} formato={fmtMonto} motivoSinMedir="El ahorro no se publicó." />}
          hint="Según el catálogo de precios de Azure"
        />
        <Kpi label="Sin precio de catálogo" valor={fmtNum(respaldo.sinPrecio)} tono="neutro"
          hint={respaldo.sinPrecio > 0 ? "Se publica su cargo, sin ahorro" : undefined} />
      </div>

      <SimpleTable cols={cols} rows={respaldo.filas} empty="El archivo de evolución no trae líneas de reserva en este rango." />

      <Aviso>
        {reservas.motivo ?? "Las reservas se leyeron desde el archivo de evolución, sin confirmación de Azure."}
      </Aviso>
    </Seccion>
  );
}
