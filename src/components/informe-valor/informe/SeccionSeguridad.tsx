import ReportBars from "@/components/reports/ReportBars";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import { REPORT_COLORS } from "@/lib/report";
import { fmtNum, num, txt } from "@/lib/informeValor";
import type { FilaInforme, InformeSeguridad, InformeSeguridadHallazgo } from "@/types";
import { Aviso, Cifra, Kpi, Seccion } from "./Piezas";

const MOTIVO_LOGIN = "El último inicio de sesión no se pudo leer para este cliente (requiere licencia "
  + "Microsoft Entra ID P1). Un cero acá afirmaría que todas las identidades inician sesión, y eso no se midió.";
const MOTIVO_CUENTA = "El estado de cuenta no se pudo leer desde Microsoft Graph. Un cero acá afirmaría "
  + "que no hay cuentas deshabilitadas, y eso no se midió.";

/**
 * Bloque de seguridad (`rbac`).
 *
 * Los tres conteos que dependen de un eje de identidad -- sin actividad de sesión, cuentas
 * deshabilitadas y nombres sin resolver -- llegan como `null` cuando ese eje no se midió, y acá se
 * dibujan con su motivo. Es el caso que dio origen a la regla: la versión anterior del informe leía
 * el 100% de los últimos inicios de sesión vacíos y emitía un hallazgo Alto pidiendo depurar los
 * accesos de toda la gente del cliente, cuando lo único que había pasado es que el dato no se leyó.
 */
export default function SeccionSeguridad({ rb, origen }: { rb: InformeSeguridad; origen: string | null }) {
  const colsRoles: SimpleCol<FilaInforme>[] = [
    { key: "rol", label: "Rol", render: (r) => txt(r[0]) },
    { key: "n", label: "Asignaciones", align: "right", render: (r) => fmtNum(num(r[1])) },
    {
      key: "priv", label: "Privilegiado",
      render: (r) => (num(r[2]) === 1
        ? <span className="text-amber-700 dark:text-amber-400">Sí</span>
        : <span className="text-muted-foreground">No</span>),
    },
  ];

  const colsHallazgos: SimpleCol<InformeSeguridadHallazgo>[] = [
    { key: "s", label: "Severidad", render: (h) => <span className="font-medium">{h.s}</span> },
    { key: "t", label: "Hallazgo", render: (h) => h.t },
    { key: "a", label: "Alcance", render: (h) => <span className="text-muted-foreground">{h.a}</span> },
    { key: "r", label: "Remediación", render: (h) => <span className="text-muted-foreground">{h.r}</span> },
    { key: "e", label: "Estado", render: (h) => h.e },
  ];

  return (
    <div className="space-y-8">
      <Seccion
        titulo="Seguridad: permisos sobre Azure"
        descripcion={<>Asignaciones de RBAC ya deduplicadas (una asignación heredada de un grupo de
          administración se cuenta una vez, no una por suscripción).
          {origen && <> Fuente: {origen === "base" ? "Revisión de accesos" : "archivo subido"}.</>}</>}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Asignaciones" valor={fmtNum(rb.n)} hint={`${fmtNum(rb.nu)} de usuario · ${fmtNum(rb.ns)} de service principal`} tono="neutro" />
          <Kpi label="Identidades" valor={fmtNum(rb.ids)} hint={`${fmtNum(rb.idsU)} usuarios · ${fmtNum(rb.idsS)} service principals`} tono="neutro" />
          <Kpi label="Privilegiados" valor={fmtNum(rb.priv)} hint={`Owner ${fmtNum(rb.owner)} · UAA ${fmtNum(rb.uaa)} · Contributor ${fmtNum(rb.contrib)}`}
            tono={rb.priv > 0 ? "aviso" : "neutro"} />
          <Kpi
            label="Sin actividad de sesión"
            valor={<Cifra valor={rb.sinLogin} formato={fmtNum} motivoSinMedir={MOTIVO_LOGIN} />}
            hint={rb.ultimoLoginMedido ? "Identidades sin inicio de sesión registrado" : "Eje no medido"}
            tono={rb.ultimoLoginMedido ? "" : "neutro"}
          />
          <Kpi
            label="Cuentas deshabilitadas"
            valor={<Cifra valor={rb.disab} formato={fmtNum} motivoSinMedir={MOTIVO_CUENTA} />}
            hint={rb.estadoCuentaMedido ? "Con asignaciones vigentes" : "Eje no medido"}
            tono={rb.estadoCuentaMedido ? "" : "neutro"}
          />
          <Kpi
            label="Sin nombre resuelto"
            valor={<Cifra valor={rb.sinNombre} formato={fmtNum} motivoSinMedir={MOTIVO_CUENTA} />}
            hint={rb.estadoCuentaMedido ? "Identidades que Graph no resolvió" : "Eje no medido"}
            tono="neutro"
          />
        </div>

        {(!rb.ultimoLoginMedido || !rb.estadoCuentaMedido) && (
          <Aviso>
            {!rb.ultimoLoginMedido && "El último inicio de sesión no se midió para este cliente. "}
            {!rb.estadoCuentaMedido && "El estado de cuenta no se midió para este cliente. "}
            Los hallazgos que dependen de esos ejes no se emiten: en su lugar va esta línea de alcance,
            igual que hace el módulo de Revisión de accesos.
          </Aviso>
        )}
      </Seccion>

      <Seccion titulo="Roles asignados">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ReportBars title="Roles de usuario" color={REPORT_COLORS.greenDark}
            data={rb.roles.slice(0, 12).map((r) => ({ name: txt(r[0]), value: num(r[1]) }))} />
          <ReportBars title="Roles de service principal" color={REPORT_COLORS.muted}
            data={rb.rolesSp.slice(0, 12).map((r) => ({ name: txt(r[0]), value: num(r[1]) }))} />
        </div>
        <SimpleTable cols={colsRoles} rows={rb.roles} empty="Sin roles asignados en el insumo." />
      </Seccion>

      <Seccion titulo="Hallazgos de permisos"
        descripcion={`${fmtNum(rb.crit)} hallazgo(s) crítico(s) sobre ${fmtNum(rb.find.length)} en total.`}>
        <SimpleTable cols={colsHallazgos} rows={rb.find}
          empty="Sin hallazgos de permisos: las reglas corrieron y ninguna disparó." />
      </Seccion>

      <Seccion titulo="Permisos por suscripción">
        <SimpleTable
          cols={[
            { key: "sub", label: "Suscripción", render: (r: FilaInforme) => txt(r[0]) },
            { key: "u", label: "Usuarios", align: "right", render: (r) => fmtNum(num(r[1])) },
            { key: "sp", label: "Service principals", align: "right", render: (r) => fmtNum(num(r[2])) },
          ]}
          rows={rb.subs}
          empty="El insumo de RBAC no alcanza ninguna suscripción."
        />
      </Seccion>
    </div>
  );
}
