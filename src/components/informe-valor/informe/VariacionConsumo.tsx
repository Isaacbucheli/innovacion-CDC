import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import { fmtMonto, fmtNum, lecturaVariacion } from "@/lib/informeValor";
import type {
  InformeAtribucion, InformeBalde, InformeReservas, InformeVariacionConsumo,
} from "@/types";
import type { FaseReservas } from "@/hooks/useInformePreview";
import { Aviso, Kpi, Seccion, SinMedir } from "./Piezas";

/**
 * Variación del consumo: los tres baldes (reservas, recomendaciones resueltas, mecanismo) y su
 * total. Es la única sección que depende de la FASE 2 de la vista previa.
 *
 * Regla dura de esta sección: **mientras la fase 2 no llegó, acá no se dibuja ninguna cifra.** No
 * es prudencia de más. El balde de reservas le saca recursos a los otros dos ("gana la reserva"),
 * así que en la respuesta de la fase 1 los tres baldes y la variación total están calculados con
 * cero reservas y van a cambiar. Dibujarlos ahora sería publicar números que se mueven solos, y
 * dibujar el eje de reservas en cero diría "este cliente no tiene reservas" cuando lo que pasa es
 * que falta una llamada. El motivo que manda la API para ese caso exacto se muestra tal cual.
 *
 * Cuando la fase 2 sí llegó, "llegó" no es lo mismo que "medido": un cliente sin credenciales
 * activas, sin el rol Reservations Reader o con errores de lectura responde 200 con
 * `reservas.medido: false` y su propio motivo. Ese caso también se declara, con las cifras del eje
 * sin publicar en vez de en cero.
 */
export default function VariacionConsumo({ variacion, fase, error, motivoFase1, onReintentar }: {
  /** El bloque de la FASE 2. `null` mientras no llegó: no se sustituye por el de la fase 1. */
  variacion: InformeVariacionConsumo | null;
  fase: FaseReservas;
  error: string | null;
  /** `fact.variacionConsumo.reservas.motivo` de la fase 1: dice que el dato se pide aparte. */
  motivoFase1: string | null;
  onReintentar: () => void;
}) {
  const titulo = "Variación del consumo";
  const descripcion = "A dónde se movió el gasto del período: lo que explica una reserva, lo que "
    + "explica una recomendación resuelta y lo que queda, abierto por mecanismo. Positivo = el gasto bajó.";

  if (fase === "error") {
    return (
      <Seccion titulo={titulo} descripcion={descripcion}
        acciones={<Button variant="outline" size="sm" onClick={onReintentar}>
          <RefreshCw className="mr-1 h-4 w-4" />Reintentar
        </Button>}>
        <Aviso>
          La lectura de reservas contra Azure falló: {error ?? "error desconocido"}. Esta sección queda
          sin cifras a propósito -- los tres baldes se calculan uno contra otro, así que publicar los
          dos que sí salieron daría una descomposición que no cierra.
        </Aviso>
      </Seccion>
    );
  }

  if (!variacion || fase === "cargando" || fase === "inactiva") {
    return (
      <Seccion titulo={titulo} descripcion={descripcion}>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Leyendo las reservas del cliente contra Azure…
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Es la parte cara del informe: una llamada a Consumption por cada reserva activa, en
            secuencia. Suele tardar entre 10 y 30 segundos. Hasta que vuelva, esta sección no muestra
            ninguna cifra: el balde de reservas le saca recursos a los otros dos, así que todo lo que
            se dibujara ahora cambiaría al llegar la foto.
          </p>
          {motivoFase1 && <p className="mt-2 text-xs italic text-muted-foreground">{motivoFase1}</p>}
        </div>
      </Seccion>
    );
  }

  return (
    <Seccion titulo={titulo} descripcion={descripcion}>
      <PanelReservas reservas={variacion.reservas} />
      <PanelAtribucion atribucion={variacion.atribucion} total={variacion.variacionTotal} />
    </Seccion>
  );
}

/** El eje de reservas ya leído. `medido: false` no publica cifras: publica el motivo. */
function PanelReservas({ reservas }: { reservas: InformeReservas }) {
  const incompleto = reservas.reservasConConsumidoresNoLeidos > 0;

  if (!reservas.medido) {
    return (
      <div className="space-y-3">
        <Aviso>
          <strong>El eje de reservas no se midió.</strong> {reservas.motivo}
          {reservas.errores.length > 0 && <> Se registraron {fmtNum(reservas.errores.length)} error(es) de lectura.</>}
        </Aviso>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Aporte al período" tono="neutro"
            valor={<SinMedir motivo={reservas.motivo} etiqueta="Sin medir" />} />
          <Kpi label="Ahorro confirmado" tono="neutro"
            valor={<SinMedir motivo={reservas.motivo} etiqueta="Sin medir" />} />
          <Kpi label="Recursos confirmados" tono="neutro"
            valor={<SinMedir motivo={reservas.motivo} etiqueta="Sin medir" />} />
          <Kpi label="Reservas por vencer" tono="neutro"
            valor={<SinMedir motivo={reservas.motivo} etiqueta="Sin medir" />} />
        </div>
      </div>
    );
  }

  const porVencer = reservas.confirmados.filter((c) => c.expiring).length;
  const colsConfirmados: SimpleCol<InformeReservas["confirmados"][number]>[] = [
    { key: "rec", label: "Recurso", render: (r) => r.resourceName ?? "(sin nombre)" },
    { key: "res", label: "Reserva", render: (r) => r.reservationName ?? r.reservationId ?? "—" },
    { key: "ini", label: "Inicio", render: (r) => r.inicioReserva ?? "—" },
    { key: "uso", label: "Horas usadas", align: "right", render: (r) => fmtNum(Math.round(r.usedHours)) },
    {
      key: "ahorro", label: "Ahorro", align: "right",
      render: (r) => (r.ahorro === null
        ? <SinMedir motivo={r.motivoSinCalcular ?? "No se pudo calcular."} etiqueta="Sin calcular" />
        : fmtMonto(r.ahorro)),
    },
    {
      key: "periodo", label: "Aporte al período", align: "right",
      render: (r) => (r.aporteAlPeriodo === null
        ? <SinMedir etiqueta="No aplica"
          motivo="La reserva no empezó dentro de la ventana del informe: no explica nada de lo que pasó adentro." />
        : fmtMonto(r.aporteAlPeriodo)),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Aporte al período" valor={fmtMonto(reservas.aporteAlPeriodo)}
          hint="Balde 1: medido sobre la ventana del informe, no desde el inicio de cada reserva" />
        <Kpi label="Ahorro confirmado" valor={fmtMonto(reservas.ahorroConfirmado)}
          hint="Desde el inicio de cada reserva (cifra del panel de reservas)" tono="neutro" />
        <Kpi label="Recursos confirmados" valor={fmtNum(reservas.confirmados.length)}
          hint={`${fmtNum(reservas.estimados.length)} unidad(es) reservada(s) sin consumidor confirmado`} tono="neutro" />
        <Kpi label="Reservas por vencer" valor={fmtNum(porVencer)}
          hint={`Umbral de aviso: ${reservas.alertDays} días`} tono={porVencer > 0 ? "aviso" : "neutro"} />
      </div>

      {incompleto && (
        <Aviso>
          {fmtNum(reservas.reservasConConsumidoresNoLeidos)} reserva(s) no pudieron informar sus
          consumidores: el ahorro confirmado y el aporte al período están <strong>incompletos</strong>,
          no completos en cero. Esas unidades figuran enteras como estimadas.
        </Aviso>
      )}
      {reservas.discrepancias.length > 0 && (
        <Aviso>
          {fmtNum(reservas.discrepancias.length)} recurso(s) con cobertura confirmada por la app cuya
          facturación no muestra la baja de tarifa esperada. El informe no elige la causa, solo la publica.
        </Aviso>
      )}

      <SimpleTable cols={colsConfirmados} rows={reservas.confirmados}
        empty="Ninguna reserva con consumidor confirmado en este cliente." />

      {reservas.estimados.length > 0 && (
        <SimpleTable
          cols={[
            { key: "n", label: "Reserva", render: (r: InformeReservas["estimados"][number]) => r.nombre ?? r.reservationId ?? "—" },
            { key: "p", label: "Producto", render: (r) => r.producto ?? "—" },
            { key: "u", label: "Unidades estimadas", align: "right", render: (r) => fmtNum(r.unidadesEstimadas) },
            {
              key: "m", label: "Por qué es estimada",
              render: (r) => (r.consumidoresNoLeidos
                ? <span className="text-amber-700 dark:text-amber-400">No se pudieron leer sus consumidores</span>
                : <span className="text-muted-foreground">Sin consumidor confirmado todavía</span>),
            },
          ]}
          rows={reservas.estimados}
          empty="Sin unidades estimadas."
        />
      )}
    </div>
  );
}

/** Baldes 2 y 3 más el total de los tres. `null` = la ventana fija no alcanza. */
function PanelAtribucion({ atribucion, total }: { atribucion: InformeAtribucion | null; total: number | null }) {
  if (!atribucion) {
    return (
      <Aviso tono="info">
        La descomposición de la variación necesita una ventana fija de al menos seis meses no
        parciales dentro del rango, y este período no la tiene. Por eso no hay baldes ni variación
        total: no es que la variación haya sido cero.
      </Aviso>
    );
  }

  const lectura = total === null ? null : lecturaVariacion(total);
  const mecanismos: { etiqueta: string; balde: InformeBalde; nota: string }[] = [
    { etiqueta: "Dejó de facturar", balde: atribucion.sinAtribuir.dejoDeFacturar, nota: "Facturaba en la ventana base y no factura en la de cierre" },
    { etiqueta: "Vivo, cuesta menos", balde: atribucion.sinAtribuir.vivoCuestaMenos, nota: "Sigue facturando, pero menos" },
    { etiqueta: "Vivo, cuesta más", balde: atribucion.sinAtribuir.vivoCuestaMas, nota: "Sigue facturando, y más (total negativo por convención)" },
    { etiqueta: "Nuevo", balde: atribucion.sinAtribuir.nuevo, nota: "No facturaba en la ventana base (total negativo por convención)" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Variación total"
          valor={total === null ? <SinMedir motivo="Sin ventana fija no hay total." /> : fmtMonto(total)}
          hint={lectura ? lectura.texto : undefined}
          tono={lectura?.tono === "sube" ? "aviso" : ""}
        />
        <Kpi label="Explicado por recomendaciones" valor={fmtMonto(atribucion.porRecomendacion.total)}
          hint={`${fmtNum(atribucion.porRecomendacion.cantidad)} recurso(s) con hallazgo resuelto`} />
        <Kpi label="Sin atribuir" valor={fmtMonto(atribucion.sinAtribuir.total)}
          hint="Abierto por mecanismo en la tabla de abajo" tono="neutro" />
        <Kpi label="Crecimiento" valor={fmtMonto(atribucion.crecimiento)}
          hint="Cuánto más se está gastando por recursos nuevos o más caros (magnitud positiva)"
          tono={atribucion.crecimiento > 0 ? "aviso" : "neutro"} />
      </div>

      <SimpleTable
        cols={[
          { key: "m", label: "Mecanismo", render: (r: (typeof mecanismos)[number]) => <span className="font-medium">{r.etiqueta}</span> },
          { key: "n", label: "Recursos", align: "right", render: (r) => fmtNum(r.balde.cantidad) },
          { key: "t", label: "Aporte", align: "right", render: (r) => fmtMonto(r.balde.total) },
          { key: "d", label: "Qué significa", render: (r) => <span className="text-muted-foreground">{r.nota}</span> },
        ]}
        rows={mecanismos}
        empty="Sin mecanismos calculados."
      />

      {atribucion.excluidosPorReserva.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {fmtNum(atribucion.excluidosPorReserva.length)} recurso(s) salieron de estos baldes porque su
          variación ya la explica una reserva confirmada dentro del período: se cuentan una sola vez, en
          el balde de reservas.
        </p>
      )}
    </div>
  );
}
