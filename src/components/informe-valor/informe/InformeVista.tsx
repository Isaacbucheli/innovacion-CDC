import { useState } from "react";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import { fmtNum } from "@/lib/informeValor";
import { fmtDateOnly } from "@/lib/dates";
import type { FaseReservas } from "@/hooks/useInformePreview";
import type { InformeCoberturaSub, InformeValorModelo, InformeVariacionConsumo } from "@/types";
import { BloqueAusente, Dato } from "./Piezas";
import SeccionConsumo from "./SeccionConsumo";
import SeccionOperacion from "./SeccionOperacion";
import SeccionPostura from "./SeccionPostura";
import SeccionRoadmap from "./SeccionRoadmap";
import SeccionSeguridad from "./SeccionSeguridad";
import VariacionConsumo from "./VariacionConsumo";

const SECCIONES = [
  { clave: "consumo", label: "Consumo" },
  { clave: "operacion", label: "Operación" },
  { clave: "seguridad", label: "Seguridad" },
  { clave: "postura", label: "Postura" },
  { clave: "roadmap", label: "Roadmap" },
];

/**
 * La vista de revisión del informe: el modelo dibujado con los componentes de gráficos del repo.
 *
 * Es la vista INTERNA y completa. Los seis bloques económicos se ven todos, con sus montos: la
 * selección de qué se publica es de la pestaña de entrega, no de acá. Los que van a poder apagarse
 * llevan la marca "Económico" para que el consultor sepa cuáles son antes de llegar a esa pantalla.
 *
 * Un bloque en `null` no es un bloque en cero: es un insumo que no está o que no se solapa con el
 * período. Cada uno dice cuál de los dos, en vez de desaparecer de la pantalla.
 */
export default function InformeVista({ modelo, variacion, faseReservas, errorReservas, onReintentarReservas }: {
  modelo: InformeValorModelo;
  variacion: InformeVariacionConsumo | null;
  faseReservas: FaseReservas;
  errorReservas: string | null;
  onReintentarReservas: () => void;
}) {
  const [seccion, setSeccion] = useState("consumo");
  const { meta } = modelo;

  const colsCobertura: SimpleCol<InformeCoberturaSub>[] = [
    { key: "nombre", label: "Suscripción", render: (s) => s.nombre },
    { key: "fact", label: "Facturación", render: (s) => (s.facturacion ? "Sí" : "—") },
    { key: "rbac", label: "Permisos", render: (s) => (s.rbac ? "Sí" : "—") },
    { key: "advisor", label: "Advisor", render: (s) => (s.advisor ? "Sí" : "—") },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Dato label="Cliente">{meta.cliente}</Dato>
          <Dato label="Período">{meta.periodo}</Dato>
          <Dato label="Fecha de corte">
            {fmtDateOnly(meta.corte)}
            <span className="ml-1 text-xs text-muted-foreground">(congelada en el cálculo)</span>
          </Dato>
          <Dato label="Origen de los permisos">
            {meta.rbacOrigen === "base" ? "Revisión de accesos"
              : meta.rbacOrigen === "archivo" ? "Archivo subido"
                : <span className="text-muted-foreground">Sin insumo de permisos</span>}
          </Dato>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {SECCIONES.map((s) => (
          <button key={s.clave} type="button" onClick={() => setSeccion(s.clave)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${seccion === s.clave
              ? "border-primary font-medium text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {seccion === "consumo" && (
        <div className="space-y-8">
          {modelo.fact
            ? <SeccionConsumo fact={modelo.fact} catSerie={modelo.catSerie} />
            : <BloqueAusente titulo="Consumo"
              motivo="No hay facturación en el rango pedido: o el insumo BITCOST no está cargado, o ninguna de sus filas cae en este período. No es un gasto de cero." />}
          <VariacionConsumo
            variacion={variacion}
            fase={faseReservas}
            error={errorReservas}
            motivoFase1={modelo.fact?.variacionConsumo?.reservas.motivo ?? null}
            onReintentar={onReintentarReservas}
          />
        </div>
      )}

      {seccion === "operacion" && (modelo.tickets
        ? <SeccionOperacion t={modelo.tickets} />
        : <BloqueAusente titulo="Operación"
          motivo="Sin casos de la mesa de servicio en el período: o el insumo no está cargado, o ninguno de sus casos cae en este rango. No es una mesa sin trabajo." />)}

      {seccion === "seguridad" && (modelo.rbac
        ? <SeccionSeguridad rb={modelo.rbac} origen={meta.rbacOrigen} />
        : <BloqueAusente titulo="Seguridad"
          motivo="Sin insumo de permisos: ni la Revisión de accesos ni un archivo subido tienen filas para este cliente. No es un cliente sin permisos asignados." />)}

      {seccion === "postura" && (modelo.advisor
        ? <SeccionPostura ad={modelo.advisor} corte={fmtDateOnly(meta.corte)} />
        : <BloqueAusente titulo="Postura"
          motivo="Sin recomendaciones de Advisor para este cliente. Puede ser que la sincronización todavía no haya corrido: no equivale a una postura perfecta." />)}

      {seccion === "roadmap" && (modelo.matriz
        ? <SeccionRoadmap mz={modelo.matriz} />
        : <BloqueAusente titulo="Roadmap"
          motivo="La matriz Well-Architected de este cliente no tiene hallazgos cargados. No es un roadmap terminado." />)}

      <section className="space-y-2">
        <h3 className="text-base font-semibold">Cobertura del informe</h3>
        <p className="max-w-3xl text-xs text-muted-foreground">
          Las {fmtNum(meta.cobertura.total)} suscripción(es) que ve al menos una de las tres fuentes.
          Es la unión, no la intersección: una suscripción que solo aparece en una fuente sigue
          contando, con esa única fuente marcada.
        </p>
        <SimpleTable cols={colsCobertura} rows={meta.cobertura.suscripciones}
          empty="Ninguna de las tres fuentes reporta suscripciones para este cliente." />
      </section>
    </div>
  );
}
