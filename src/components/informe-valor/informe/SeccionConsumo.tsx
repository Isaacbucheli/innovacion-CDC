import ReportBars from "@/components/reports/ReportBars";
import ReportLine from "@/components/reports/ReportLine";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import { REPORT_COLORS } from "@/lib/report";
import {
  claveNormalizada, etiquetaMes, fmtMonto, fmtNum, num, porCategoria, txt,
} from "@/lib/informeValor";
import type { FilaInforme, InformeConsumo, InformeValorModelo } from "@/types";
import { Aviso, Cifra, Dato, Kpi, Seccion, SinMedir } from "./Piezas";

/**
 * Dominio del eje Y con algo de aire. El piso baja abajo de cero cuando algún valor es negativo:
 * un mes con notas de crédito factura negativo, y clavar el piso en cero lo dibujaría pegado al eje,
 * indistinguible de un mes sin gasto.
 */
function dominio(valores: number[]): [number, number] {
  const max = valores.reduce((m, v) => (v > m ? v : m), 0);
  const min = valores.reduce((m, v) => (v < m ? v : m), 0);
  return [min < 0 ? Math.floor(min * 1.1) : 0, max > 0 ? Math.ceil(max * 1.1) : 1];
}

/**
 * Bloque de consumo (`fact`): facturación del insumo BITCOST.
 *
 * Tres cosas que esta sección no hace, y no por olvido:
 *
 * - **No calcula un promedio mensual único del período.** El modelo publica el promedio por año
 *   (`prom`, que excluye los meses parciales) y es lo que usa el otro renderizador. Un
 *   total/meses calculado acá sería una segunda definición del mismo concepto, coherente consigo
 *   misma y distinta de la del HTML: el defecto que más caro salió en este módulo.
 * - **No anualiza el ahorro por su cuenta.** Publica `ahorro.anualizada` tal cual, que es `null`
 *   cuando la caída no lleva tres meses cerrados.
 * - **No dibuja los meses parciales como si fueran meses cerrados.** Van marcados en la tabla y
 *   listados debajo del gráfico.
 */
export default function SeccionConsumo({ fact, catSerie }: {
  fact: InformeConsumo;
  catSerie: InformeValorModelo["catSerie"];
}) {
  const parciales = new Set(fact.parciales);
  const serieMensual = fact.meses.map((m) => ({
    x: etiquetaMes(txt(m[0])),
    Facturado: num(m[1]),
  }));
  const categorias = porCategoria(catSerie);
  const categoriasNormalizadas = categorias.some((c) => claveNormalizada(c.name));
  const totalCategorias = categorias.reduce((s, c) => s + c.value, 0);

  const altasBajas = fact.serie.map((s) => ({
    x: etiquetaMes(txt(s[0])),
    Activos: num(s[1]),
    Altas: num(s[2]),
    Bajas: num(s[3]),
  }));

  const colsPromedio: SimpleCol<FilaInforme>[] = [
    { key: "anio", label: "Año", render: (r) => txt(r[0]) },
    { key: "meses", label: "Meses cerrados", align: "right", render: (r) => fmtNum(num(r[1])) },
    { key: "prom", label: "Promedio mensual", align: "right", render: (r) => fmtMonto(num(r[2])) },
    { key: "total", label: "Total del año", align: "right", render: (r) => fmtMonto(num(r[3])) },
  ];

  const colsMeses: SimpleCol<FilaInforme>[] = [
    { key: "mes", label: "Mes", render: (r) => etiquetaMes(txt(r[0])) },
    { key: "monto", label: "Facturado", align: "right", render: (r) => fmtMonto(num(r[1])) },
    {
      key: "estado", label: "Estado",
      render: (r) => (parciales.has(txt(r[0]))
        ? <span className="text-amber-700 dark:text-amber-400">Parcial</span>
        : <span className="text-muted-foreground">Cerrado</span>),
    },
  ];

  const colsSerie: SimpleCol<FilaInforme>[] = [
    { key: "mes", label: "Mes", render: (r) => etiquetaMes(txt(r[0])) },
    { key: "act", label: "Recursos activos", align: "right", render: (r) => fmtNum(num(r[1])) },
    { key: "alt", label: "Altas", align: "right", render: (r) => fmtNum(num(r[2])) },
    {
      key: "baj", label: "Bajas", align: "right",
      // D5: en un mes parcial las bajas no se cuentan (el archivo todavía no las tiene todas), así
      // que el 0 de esa fila no es "no hubo bajas": no se midieron.
      render: (r) => (num(r[6]) === 1
        ? <SinMedir motivo="Mes parcial: las bajas de un mes incompleto no se cuentan." etiqueta="—" />
        : fmtNum(num(r[3]))),
    },
    {
      key: "ret", label: "Monto retirado", align: "right",
      render: (r) => (num(r[6]) === 1
        ? <SinMedir motivo="Mes parcial: no se mide el monto retirado." etiqueta="—" />
        : fmtMonto(num(r[5]))),
    },
  ];

  return (
    <div className="space-y-8">
      <Seccion
        titulo="Gasto del período"
        bloque="gastoTotal"
        descripcion={<>Facturación BITCOST del rango pedido. El promedio mensual se publica por año y
          sobre meses cerrados (tabla de abajo): el modelo no define un promedio único del período, y
          esta vista no lo inventa.</>}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Gasto total" valor={fmtMonto(fact.total)} hint={`Período: ${fact.meses.length} mes(es) con datos`} />
          <Kpi label="Recursos" valor={fmtNum(fact.nRecursos)} hint={`${fmtNum(fact.nRg)} grupos · ${fmtNum(fact.nCats)} categorías`} tono="neutro" />
          <Kpi label="Pico de recursos activos" valor={fmtNum(fact.picoAct)} hint={fact.picoMes ? `En ${etiquetaMes(fact.picoMes)}` : "Sin mes de pico"} tono="neutro" />
          <Kpi label="Bajas definitivas" valor={fmtNum(fact.bajasDef)} hint="Recursos que dejaron de facturar dentro del rango" tono="neutro" />
          <Kpi label="Carga mensual retirada" valor={fmtMonto(fact.cargaRet)} hint={fact.unidadCargaRet} />
          <Kpi
            label="Filas revisadas"
            valor={fmtNum(fact.filasEnRango)}
            hint={<>En el rango, ya fusionadas. De toda la carga: {fmtNum(fact.filas)} filas antes de fusionar.</>}
            tono="neutro"
          />
        </div>
        <SimpleTable cols={colsPromedio} rows={fact.prom} empty="Ningún año cerrado en el rango." />
      </Seccion>

      <Seccion
        titulo="Serie mensual de consumo"
        bloque="serieMensual"
        descripcion="Facturación mes a mes. Los meses parciales se muestran, pero quedan marcados: un mes incompleto leído como cerrado hace parecer que el gasto cayó."
      >
        {serieMensual.length > 0 ? (
          <div className="rounded-xl border bg-card p-4">
            <ReportLine
              data={serieMensual}
              series={[{ key: "Facturado", name: "Facturado (USD)", color: REPORT_COLORS.greenDark }]}
              yDomain={dominio(serieMensual.map((m) => m.Facturado))}
              height={240}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Ningún mes con facturación en el rango.</p>
        )}

        {fact.parciales.length > 0 && (
          <Aviso>
            Mes(es) parcial(es): {fact.parciales.map(etiquetaMes).join(", ")}.
            {fact.autoParciales.length > 0 && <> Detectados por la heurística: {fact.autoParciales.map(etiquetaMes).join(", ")}.</>}
            {" "}Último mes cerrado: {fact.ultCompleto ? etiquetaMes(fact.ultCompleto) : "ninguno"}.
          </Aviso>
        )}
        {fact.parciales.length === 0 && (
          <Aviso tono="info">Ningún mes del rango está marcado como parcial.</Aviso>
        )}
        {fact.parcialesInexistentes.length > 0 && (
          <Aviso>
            Declaraste como parcial(es) {fact.parcialesInexistentes.map(etiquetaMes).join(", ")}, pero
            {fact.parcialesInexistentes.length === 1 ? " ese mes no existe" : " esos meses no existen"} en
            el insumo del rango: no se aplicó nada para {fact.parcialesInexistentes.length === 1 ? "él" : "ellos"}.
          </Aviso>
        )}

        <SimpleTable cols={colsMeses} rows={fact.meses} empty="Ningún mes con facturación en el rango." />
      </Seccion>

      <Seccion
        titulo="Composición por servicio"
        bloque="composicionServicio"
        descripcion="En qué se gasta, sumando la serie mensual de cada categoría dentro del rango."
      >
        {categorias.length > 0 ? (
          <>
            <ReportBars
              title={`Top 12 de ${fmtNum(categorias.length)} categorías`}
              color={REPORT_COLORS.greenDark}
              unit=" USD"
              data={categorias.slice(0, 12).map((c) => ({ name: c.name, value: Math.round(c.value) }))}
            />
            <SimpleTable
              cols={[
                { key: "cat", label: "Categoría", render: (c: { name: string; value: number }) => c.name },
                { key: "monto", label: "Monto", align: "right", render: (c) => fmtMonto(c.value) },
                {
                  key: "pct", label: "% del gasto", align: "right",
                  render: (c) => (totalCategorias > 0 ? `${((c.value / totalCategorias) * 100).toFixed(1)}%` : "n/d"),
                },
              ]}
              rows={categorias}
              empty="Sin categorías en el rango."
            />
            {categoriasNormalizadas && (
              <Aviso>
                Los nombres de categoría llegan normalizados por la API (minúsculas y guiones bajos):
                el endpoint de la vista previa serializa las claves de diccionario con la política
                global del repo, que las transforma. El monto y el porcentaje son correctos; el
                rótulo no es el nombre original de la categoría.
              </Aviso>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            El modelo no trae la serie por categoría para este rango (sin filas de facturación en el período).
          </p>
        )}
      </Seccion>

      <Seccion
        titulo="Reparto por centro de costo"
        bloque="centroCosto"
        descripcion="Gasto asignado a cada área del cliente. Las filas sin centro de costo se agrupan en “(sin asignar)”, no se descartan."
      >
        {fact.cc.length > 0 ? (
          <ReportBars
            title={`Centros de costo (${fmtNum(fact.cc.length)})`}
            color={REPORT_COLORS.gold}
            unit=" USD"
            data={fact.cc.slice(0, 12).map((c) => ({ name: txt(c[0]), value: Math.round(num(c[1])) }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">El insumo no trae centro de costo para ninguna fila del rango.</p>
        )}
      </Seccion>

      <Seccion
        titulo="Ahorro activo"
        bloque="ahorroActivo"
        descripcion="Caída sostenida de una categoría contra su línea base (mediana de los meses previos al quiebre), ya neteada contra las categorías que subieron."
      >
        {fact.ahorro ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Categoría" valor={<span className="text-base">{fact.ahorro.cat}</span>} tono="neutro" />
              <Kpi label="Tasa mensual" valor={fmtMonto(fact.ahorro.dif)} hint={`De ${fmtMonto(fact.ahorro.pico)} (${etiquetaMes(fact.ahorro.picoMes)}) a ${fmtMonto(fact.ahorro.fin)} (${etiquetaMes(fact.ahorro.finMes)})`} />
              <Kpi
                label="Anualizada"
                valor={<Cifra
                  valor={fact.ahorro.anualizada}
                  formato={fmtMonto}
                  etiquetaSinMedir="No se publica"
                  motivoSinMedir={`La caída lleva ${fact.ahorro.mesesSostenido} mes(es) cerrado(s) sostenido(s): se necesitan 3 para anualizar. No es que la cifra anual sea cero.`}
                />}
                hint="Solo con la caída sostenida 3 meses cerrados o más"
              />
              <Kpi label="Meses sostenido" valor={fmtNum(fact.ahorro.mesesSostenido)} tono="neutro" />
            </div>
            <p className="text-xs text-muted-foreground">
              La línea base es la mediana de los meses anteriores al quiebre, no el mes de mayor gasto:
              con un pico de un solo mes cualquier categoría “ahorra” por volatilidad normal.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ninguna categoría muestra una caída sostenida que cumpla la regla en este rango. No es un
            ahorro de cero: es que no hay ninguna caída que se pueda defender como sostenida.
          </p>
        )}
      </Seccion>

      <Seccion
        titulo="Altas y bajas de recursos"
        descripcion="Un recurso existe en un mes si tuvo consumo. La identidad es suscripción + grupo de recursos + nombre."
      >
        {altasBajas.length > 0 && (
          <div className="rounded-xl border bg-card p-4">
            <ReportLine
              data={altasBajas}
              series={[
                { key: "Activos", name: "Recursos activos", color: REPORT_COLORS.greenDark },
                { key: "Altas", name: "Altas", color: REPORT_COLORS.gold },
                { key: "Bajas", name: "Bajas", color: REPORT_COLORS.crit },
              ]}
              yDomain={dominio(altasBajas.flatMap((m) => [m.Activos, m.Altas, m.Bajas]))}
              height={240}
            />
          </div>
        )}
        <SimpleTable cols={colsSerie} rows={fact.serie} empty="Sin serie de altas y bajas en el rango." />
      </Seccion>

      {fact.comp && (
        <Seccion
          titulo={`Comparativa interanual: ${etiquetaMes(fact.comp.a)} contra ${etiquetaMes(fact.comp.b)}`}
          descripcion="Mismo mes de calendario de dos años, por servicio."
        >
          <SimpleTable
            cols={[
              { key: "srv", label: "Servicio", render: (r: FilaInforme) => txt(r[0]) },
              { key: "a", label: etiquetaMes(fact.comp.a), align: "right", render: (r) => fmtMonto(num(r[1])) },
              { key: "b", label: etiquetaMes(fact.comp.b), align: "right", render: (r) => fmtMonto(num(r[2])) },
            ]}
            rows={fact.comp.filas}
            empty="Sin servicios comparables entre los dos meses."
          />
        </Seccion>
      )}

      <Seccion titulo="Cobertura del insumo de facturación">
        <div className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-4 md:grid-cols-4">
          <Dato label="Suscripciones">{fmtNum(fact.subs.length)}</Dato>
          <Dato label="Grupos de recursos">{fmtNum(fact.nRg)}</Dato>
          <Dato label="Identidades de recurso">{fmtNum(fact.nIds)}</Dato>
          <Dato label="Categorías">{fmtNum(fact.nCats)}</Dato>
        </div>
        <SimpleTable
          cols={[
            { key: "sub", label: "Suscripción", render: (r: FilaInforme) => txt(r[0]) },
            { key: "monto", label: "Facturado", align: "right", render: (r) => fmtMonto(num(r[1])) },
          ]}
          rows={fact.subs}
          empty="El insumo no trae suscripciones en el rango."
        />
      </Seccion>
    </div>
  );
}
