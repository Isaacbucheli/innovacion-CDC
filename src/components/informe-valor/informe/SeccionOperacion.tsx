import ReportBars from "@/components/reports/ReportBars";
import ReportLine from "@/components/reports/ReportLine";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import { REPORT_COLORS } from "@/lib/report";
import { etiquetaMes, fmtHoras, fmtNum, fmtPct, num, txt } from "@/lib/informeValor";
import type { FilaInforme, InformeOperacion, InformeOperacionCategoria } from "@/types";
import { Aviso, Kpi, Recorte, Seccion, SinMedir } from "./Piezas";

/** Tope de filas por tabla en esta pantalla. Va con <Recorte>, nunca en silencio. */
const TOPE_FILAS = 50;

/**
 * Bloque de operación (`tickets`): mesa de servicio.
 *
 * El cumplimiento de SLA tiene TRES estados, no dos. Los casos sin evaluar no se cuentan como
 * cumplidos ni como incumplidos: quedan aparte, y el porcentaje se calcula sobre el denominador que
 * el propio modelo declara (`denominadorPct` = cumple + noCumple). Con ese denominador en cero el
 * porcentaje no se dibuja: un 0% ahí diría que la mesa incumplió todo, cuando nadie evaluó nada.
 */
export default function SeccionOperacion({ t }: { t: InformeOperacion }) {
  const serie = t.meses.map((m) => ({
    x: etiquetaMes(txt(m[0])),
    Casos: num(m[1]),
    "Fuera de SLA": num(m[2]),
  }));
  const maxSerie = serie.reduce((m, s) => Math.max(m, s.Casos), 0);
  const proactivos = t.n - t.casosR - t.casosSinSubcategoria;
  // El denominador de la proporción por frentes son los CLASIFICADOS: el frente residual "(sin
  // subcategoría)" no es reactivo, pero tampoco proactivo, y contarlo del lado proactivo (que es lo
  // que hace `nFrentes - nFrentesR`) publicaba 100 % de trabajo proactivo con un export sin
  // subcategorías.
  const frentesClasificados = t.nFrentesP + t.nFrentesR;
  const frentesResiduales = t.nFrentes - frentesClasificados;

  const colsFuera: SimpleCol<FilaInforme>[] = [
    { key: "caso", label: "Caso", render: (r) => txt(r[0]) },
    { key: "fecha", label: "Fecha", render: (r) => (txt(r[1]) ? txt(r[1]).slice(0, 10) : "") },
    { key: "cat", label: "Categoría", render: (r) => txt(r[2]) || "(sin categoría)" },
    { key: "sub", label: "Subcategoría", render: (r) => txt(r[3]) || "(sin subcategoría)" },
    { key: "sla", label: "SLA", align: "right", render: (r) => fmtHoras(num(r[4])) },
    { key: "dur", label: "Duración", align: "right", render: (r) => fmtHoras(num(r[5])) },
  ];

  // El detalle completo (`lista`) es la tabla que el artefacto sí publica, con los tres estados de
  // SLA en la séptima posición. Sin ella acá, el consultor aprobaba una entrega sin haber visto la
  // tabla más larga que el cliente recibe.
  const colsLista: SimpleCol<FilaInforme>[] = [
    ...colsFuera,
    {
      key: "sla-estado", label: "Cumple SLA",
      render: (r) => (txt(r[6]) === "SI"
        ? <span className="text-primary">Sí</span>
        : txt(r[6]) === "NO"
          ? <span className="text-red-700 dark:text-red-400">No</span>
          : <SinMedir motivo="La celda de cumplimiento llegó vacía: no cuenta ni a favor ni en contra." etiqueta="Sin evaluar" />),
    },
    { key: "horario", label: "Horario", render: (r) => txt(r[7]) || "(sin horario)" },
  ];

  // `f` y `med` por categoría: son las dos cifras que el artefacto rotula en su gráfico de
  // categorías, y un gráfico de barras acá solo puede llevar una.
  const colsCats: SimpleCol<InformeOperacionCategoria>[] = [
    { key: "n", label: "Categoría", render: (c) => c.n },
    { key: "c", label: "Casos", align: "right", render: (c) => fmtNum(c.c) },
    {
      key: "f", label: "Fuera de SLA", align: "right",
      render: (c) => (c.f > 0 ? <span className="text-red-700 dark:text-red-400">{fmtNum(c.f)}</span> : ""),
    },
    { key: "med", label: "Mediana de atención", align: "right", render: (c) => fmtHoras(c.med) },
  ];

  return (
    <div className="space-y-8">
      <Seccion
        titulo="Operación de la mesa de servicio"
        descripcion={<>Casos del período{t.desde && t.hasta ? ` (${t.desde.slice(0, 10)} a ${t.hasta.slice(0, 10)})` : ""}.
          {t.enDias && " Las duraciones venían en días en el archivo y se convirtieron a horas."}</>}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Casos" valor={fmtNum(t.n)} hint={`${fmtNum(t.cerrados)} cerrados`} tono="neutro" />
          <Kpi
            label="Cumplimiento de SLA"
            valor={t.denominadorPct === 0
              ? <SinMedir motivo="Ningún caso tiene el SLA evaluado: no hay denominador que dividir. Un 0% acá diría que se incumplió todo." />
              : fmtPct(t.pct)}
            hint={`Sobre ${fmtNum(t.denominadorPct)} caso(s) evaluado(s), no sobre los ${fmtNum(t.n)} del período`}
            tono={t.denominadorPct > 0 && t.pct < 90 ? "aviso" : ""}
          />
          <Kpi label="Cumple" valor={fmtNum(t.cumple)} tono="bueno" />
          <Kpi label="No cumple" valor={fmtNum(t.noCumple)} tono={t.noCumple > 0 ? "malo" : "neutro"} />
          <Kpi label="Sin evaluar" valor={fmtNum(t.sinEvaluar)}
            hint="No se cuentan como cumplidos: la celda de SLA llegó vacía" tono={t.sinEvaluar > 0 ? "aviso" : "neutro"} />
          <Kpi label="Racha" valor={fmtNum(t.racha)}
            hint={`Mes(es) seguidos sin incumplir · ${fmtNum(t.rachaCasos)} caso(s)`} tono="neutro" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Media" valor={fmtHoras(t.media)} tono="neutro" />
          <Kpi label="Mediana" valor={fmtHoras(t.mediana)} tono="neutro" />
          <Kpi label="Percentil 90" valor={fmtHoras(t.p90)} tono="neutro" />
          <Kpi label="Media dentro de SLA" valor={fmtHoras(t.mediaOk)} tono="neutro" />
        </div>
      </Seccion>

      <Seccion titulo="Casos por mes" descripcion="Total del mes y cuántos quedaron fuera de SLA.">
        {serie.length > 0 ? (
          <div className="rounded-xl border bg-card p-4">
            <ReportLine
              data={serie}
              series={[
                { key: "Casos", name: "Casos", color: REPORT_COLORS.greenDark },
                { key: "Fuera de SLA", name: "Fuera de SLA", color: REPORT_COLORS.crit },
              ]}
              yDomain={[0, maxSerie > 0 ? Math.ceil(maxSerie * 1.1) : 1]}
              height={220}
            />
          </div>
        ) : <p className="text-sm text-muted-foreground">Sin casos en el período.</p>}
      </Seccion>

      <Seccion titulo="Categorías y frentes de trabajo"
        descripcion="Cada porcentaje de esta sección se calcula sobre su propio denominador; las categorías vacías se agrupan en una entrada explícita, no se descartan.">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ReportBars title="Casos por categoría" color={REPORT_COLORS.greenDark}
            data={t.cats.slice(0, 12).map((c) => ({ name: c.n, value: c.c }))} />
          <ReportBars title="Casos por horario de atención" color={REPORT_COLORS.gold}
            data={t.hor.slice(0, 12).map((h) => ({ name: txt(h[0]), value: num(h[1]) }))} />
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ReportBars title="Frentes de trabajo por volumen" color={REPORT_COLORS.muted}
            data={t.frentes.slice(0, 13).map((fr) => ({
              name: `${fr.n}${fr.r ? " (reactivo)" : ""}`, value: fr.c,
            }))} />
          <SimpleTable cols={colsCats} rows={t.cats.slice(0, 12)}
            empty="El insumo no trae categorías para este período." />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi label="Frentes" valor={fmtNum(t.nFrentes)}
            hint={`${fmtNum(t.nFrentesP)} proactivos · ${fmtNum(t.nFrentesR)} reactivos${frentesResiduales > 0 ? " · 1 sin clasificar" : ""}`}
            tono="neutro" />
          <Kpi label="Trabajo proactivo"
            valor={t.n - t.casosSinSubcategoria > 0
              ? fmtPct((Math.max(proactivos, 0) / t.n) * 100, 1)
              : <SinMedir motivo="Ningún caso trae subcategoría: no hay nada que clasificar entre proactivo y reactivo. Un 0% acá diría que todo el trabajo nació de un incidente." />}
            hint={`En volumen de casos, sobre los ${fmtNum(t.n)} del período. Por frentes clasificados: ${frentesClasificados > 0 ? fmtPct((t.nFrentesP / frentesClasificados) * 100, 1) : "sin medir"}`}
            tono="neutro" />
          <Kpi label="Casos reactivos" valor={fmtNum(t.casosR)} tono="neutro" />
          <Kpi label="Casos proactivos" valor={fmtNum(Math.max(proactivos, 0))}
            hint="Sin contar los casos sin subcategoría" tono="neutro" />
          <Kpi label="Sin subcategoría" valor={fmtNum(t.casosSinSubcategoria)}
            hint="No se cuentan como proactivos por omisión" tono={t.casosSinSubcategoria > 0 ? "aviso" : "neutro"} />
        </div>
        {t.casosSinSubcategoria > 0 && (
          <Aviso>
            {fmtNum(t.casosSinSubcategoria)} caso(s) no traen subcategoría. Quedan fuera del conteo
            proactivo en vez de caer ahí por descarte, que es lo que hacía la versión anterior del informe.
            {frentesResiduales > 0 && " Los agrupa un frente residual que tampoco cuenta como proactivo: "
              + "el porcentaje por frentes se calcula solo sobre los frentes clasificados."}
          </Aviso>
        )}
      </Seccion>

      <Seccion titulo="Casos fuera de SLA" descripcion="El detalle que sostiene el porcentaje de cumplimiento.">
        <SimpleTable cols={colsFuera} rows={t.fuera.slice(0, TOPE_FILAS)}
          empty={t.denominadorPct === 0
            ? "Ningún caso tiene el SLA evaluado en este período."
            : "Ningún caso quedó fuera de SLA en este período."} />
        <Recorte mostradas={TOPE_FILAS} total={t.fuera.length} que="casos fuera de SLA" />
      </Seccion>

      <Seccion titulo="Detalle de todos los casos"
        descripcion="La misma tabla que publica el informe entregado, con los tres estados de cumplimiento tal como los va a leer el cliente.">
        <SimpleTable cols={colsLista} rows={t.lista.slice(0, TOPE_FILAS)}
          empty="El insumo no trae casos para este período." />
        <Recorte mostradas={TOPE_FILAS} total={t.lista.length} que="casos" />
      </Seccion>
    </div>
  );
}
