import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import ExecutiveSummary from "@/components/reports/ExecutiveSummary";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import ReportBars from "@/components/reports/ReportBars";
import ReportDonut from "@/components/reports/ReportDonut";
import ReportLine from "@/components/reports/ReportLine";
import VmDetailDialog from "@/components/reports/VmDetailDialog";
import { downloadReportWord } from "@/lib/api";
import {
  REPORT_COLORS, topBy, shortRuleName, alertSeverityChip, backupStateChip,
} from "@/lib/report";
import type { MonthlyReport, ReportVmInventory, ReportPerfVm } from "@/types";

// ---- tipos locales de secciones (forma del JSON ya verificada) ----
interface Plantilla { sku: string; vcpu: number; ram_gb: number; vms: number; os: string }
interface EstadoRec { tipo: string; total: number; disponibles: number; con_alerta: number; obs?: string }
interface SqlMi { name: string; tier: string; vcores: number; bases: number; cpu_avg: number; cpu_max: number; storage_used_gb: number; storage_gb: number; estado: string }
interface AppSvc { plan: string; sku: string; instancias: string; apps: string; estado: string }
interface Conn { nombre: string; proveedor: string; ancho: string; estado: string; obs?: string }
interface Vault { vault: string; region: string; elementos: number; politicas: string; ultimo: string }
interface BackupItem { servidor: string; tipo: string; frecuencia: string; retencion: string; estado: string; ultimo: string; subscription?: string }
interface PermSub { suscripcion: string; total: number; elevados: number; owners: number; usuarios: number; service_principals: number; grupos: number }
interface PermRole { rol: string; elevado: boolean; usuarios: number; service_principals: number; grupos: number; total: number }
interface Permisos { resumen: { total: number; elevados: number; usuarios: number; service_principals: number; owners: number; cuentas_unicas: number }; por_suscripcion: PermSub[]; top_roles: PermRole[] }
interface AlertTipo { tipo: string; severidad: string; disparos: number; criticas: number }
interface AlertSub { suscripcion: string; disparos: number; criticas: number }
interface Alertas { resumen: { total: number; criticas: number; reglas_activadas: number; suscripciones: number }; por_tipo: AlertTipo[]; por_suscripcion: AlertSub[]; nota?: string; error?: string }
interface Caida { inicio: string; fin: string; servicios: string; causa: string }
interface WafRec { codigo: string; pilar: string; ambito: string; accion_cliente: string; accion_bit: string }
interface AdvisorHist { current?: { pillars?: Record<string, number>; snapshot_date?: string }; delta?: Record<string, number>; series?: { label: string; average: number }[] }

const PILLARS: Record<string, string> = { "1": "Eficiencia", "2": "Operación", "3": "Seguridad", "4": "Confiabilidad", "5": "Costos" };

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums tracking-tight mt-0.5">{value}</div>
    </div>
  );
}

function Section({ id, n, title, children }: { id: string; n: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <h2 className="text-lg font-semibold flex items-baseline gap-2 pt-2">
        <span className="text-sm text-muted-foreground tabular-nums">{n}</span>{title}
      </h2>
      {children}
    </section>
  );
}

export default function ReportView({ report, clientId, year, month }: {
  report: MonthlyReport; clientId: number; year: number; month: number;
}) {
  const [vm, setVm] = useState<ReportVmInventory | null>(null);
  const [vmOpen, setVmOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const inv = report.inventario ?? [];
  const vms = useMemo(() => report.performance?.virtual_machines ?? [], [report]);
  const perfByName = useMemo(() => {
    const m = new Map<string, ReportPerfVm>();
    for (const p of vms) m.set(p.resource_name, p);
    return m;
  }, [vms]);

  const plantillas = (report.plantillas as Plantilla[] | undefined) ?? [];
  const estadoRec = (report.estado_recursos as EstadoRec[] | undefined) ?? [];
  const sqlMi = (report.sql_mi as SqlMi[] | undefined) ?? [];
  const appSvc = (report.app_services as AppSvc[] | undefined) ?? [];
  const conn = (report.conectividad as Conn[] | undefined) ?? [];
  const vaults = (report.backups?.vaults as Vault[] | undefined) ?? [];
  const backupItems = (report.backups?.items as BackupItem[] | undefined) ?? [];
  const jobsMes = report.backups?.jobs_mes ?? {};
  const permisos = report.permisos as Permisos | undefined;
  const alertas = report.alertas as Alertas | undefined;
  const caidas = (report.caidas as Caida[] | undefined) ?? [];
  const sla = report.sla ?? [];
  const wafRecs = (report.recomendaciones_waf as WafRec[] | undefined) ?? [];
  const advisor = report.advisor_score_history as AdvisorHist | undefined;
  const narrative = report.narrative ?? {};

  function openVm(v: ReportVmInventory) { setVm(v); setVmOpen(true); }

  async function exportWord() {
    setDownloading(true);
    try {
      await downloadReportWord(clientId, year, month, `informe-${report.client?.name ?? "cliente"}-${year}-${String(month).padStart(2, "0")}.docx`);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setDownloading(false); }
  }

  // Definición de columnas
  const invCols: SimpleCol<ReportVmInventory>[] = [
    { key: "name", label: "Nombre" },
    { key: "ip", label: "IP" },
    { key: "status", label: "Estado", render: (r) => <span className={`text-xs px-2 py-0.5 rounded-full ${backupStateChip(/running/i.test(r.status) ? "completado" : "otro")}`}>{r.status}</span> },
    { key: "os", label: "SO" },
    { key: "size", label: "SKU" },
    { key: "vcpu", label: "vCPU", align: "right" },
    { key: "ram_gb", label: "RAM GB", align: "right" },
    { key: "disks", label: "Discos", align: "right" },
    { key: "has_backup", label: "Backup", render: (r) => r.has_backup ? "Sí" : "No" },
  ];
  const perfCols: SimpleCol<ReportPerfVm>[] = [
    { key: "resource_name", label: "VM" },
    { key: "cpu_avg", label: "CPU prom", align: "right", render: (r) => `${Math.round(r.cpu_avg)}%` },
    { key: "cpu_max", label: "CPU máx", align: "right", render: (r) => `${Math.round(r.cpu_max)}%` },
    { key: "ram_avg", label: "RAM prom", align: "right", render: (r) => `${Math.round(r.ram_avg)}%` },
    { key: "ram_max", label: "RAM máx", align: "right", render: (r) => `${Math.round(r.ram_max)}%` },
  ];

  const nav: { id: string; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "inventario", label: "Inventario" },
    { id: "plantillas", label: "Plantillas" },
    { id: "performance", label: "Performance" },
    ...(sqlMi.length ? [{ id: "sql", label: "SQL MI" }] : []),
    ...(appSvc.length ? [{ id: "appsvc", label: "App Services" }] : []),
    ...(conn.length ? [{ id: "conectividad", label: "Conectividad" }] : []),
    ...(vaults.length || backupItems.length ? [{ id: "respaldos", label: "Respaldos" }] : []),
    ...(permisos ? [{ id: "rbac", label: "Permisos" }] : []),
    ...(alertas ? [{ id: "alertas", label: "Alertas" }] : []),
    { id: "disponibilidad", label: "Disponibilidad" },
    ...(advisor?.series?.length ? [{ id: "advisor", label: "Advisor" }] : []),
    { id: "conclusiones", label: "Conclusiones" },
  ];

  return (
    <div className="space-y-8">
      {/* Acciones + navegación */}
      <div className="flex flex-wrap items-center gap-2 sticky top-0 z-10 bg-background/95 backdrop-blur py-2 -mt-2">
        <nav className="flex flex-wrap gap-1 flex-1">
          {nav.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/70">{s.label}</a>
          ))}
        </nav>
        <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" />Imprimir</Button>
        <Button size="sm" disabled={downloading} onClick={exportWord}><FileDown className="w-4 h-4 mr-1" />Word</Button>
      </div>

      <Section id="resumen" n="01" title="Resumen ejecutivo">
        <ExecutiveSummary report={report} />
      </Section>

      <Section id="inventario" n="02" title="Inventario de servidores">
        <SimpleTable cols={invCols} rows={inv} onRowClick={openVm} empty="Sin servidores." />
      </Section>

      <Section id="plantillas" n="03" title="Plantillas y sistema operativo">
        <ReportBars title="Top plantillas por nº de VMs" color={REPORT_COLORS.green} unit=" VMs"
          data={topBy(plantillas, (p) => p.vms, 12).map((p) => ({ name: p.sku, value: p.vms }))} />
        <SimpleTable cols={[
          { key: "sku", label: "SKU" }, { key: "vcpu", label: "vCPU", align: "right" },
          { key: "ram_gb", label: "RAM GB", align: "right" }, { key: "vms", label: "VMs", align: "right" }, { key: "os", label: "SO" },
        ]} rows={plantillas} />
        {estadoRec.length > 0 && (
          <SimpleTable cols={[
            { key: "tipo", label: "Tipo" }, { key: "total", label: "Total", align: "right" },
            { key: "disponibles", label: "Disponibles", align: "right" }, { key: "con_alerta", label: "Con alerta", align: "right" },
            { key: "obs", label: "Observación" },
          ]} rows={estadoRec} />
        )}
      </Section>

      <Section id="performance" n="04" title="Performance CPU y RAM">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ReportBars title="Top CPU promedio" color={REPORT_COLORS.greenDark} unit="%"
            data={topBy(vms, (v) => v.cpu_avg, 12).map((v) => ({ name: v.resource_name, value: Math.round(v.cpu_avg) }))}
            onClickBar={(name) => { const v = inv.find((x) => x.name === name); if (v) openVm(v); }} />
          <ReportBars title="Top RAM promedio" color={REPORT_COLORS.gold} unit="%"
            data={topBy(vms, (v) => v.ram_avg, 12).map((v) => ({ name: v.resource_name, value: Math.round(v.ram_avg) }))}
            onClickBar={(name) => { const v = inv.find((x) => x.name === name); if (v) openVm(v); }} />
        </div>
        <SimpleTable cols={perfCols} rows={vms} onRowClick={(p) => { const v = inv.find((x) => x.name === p.resource_name); if (v) openVm(v); }} />
        {narrative.performance_comentario && <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">{narrative.performance_comentario}</p>}
      </Section>

      {sqlMi.length > 0 && (
        <Section id="sql" n="05" title="Bases de datos (SQL Managed Instance)">
          <SimpleTable cols={[
            { key: "name", label: "Instancia" }, { key: "tier", label: "Tier" }, { key: "vcores", label: "vCores", align: "right" },
            { key: "bases", label: "Bases", align: "right" },
            { key: "cpu_avg", label: "CPU prom", align: "right", render: (r: SqlMi) => `${Math.round(r.cpu_avg)}%` },
            { key: "storage", label: "Almacenamiento", align: "right", render: (r: SqlMi) => `${r.storage_used_gb}/${r.storage_gb} GB` },
            { key: "estado", label: "Estado" },
          ]} rows={sqlMi} />
        </Section>
      )}

      {appSvc.length > 0 && (
        <Section id="appsvc" n="06" title="App Services">
          <SimpleTable cols={[
            { key: "plan", label: "Plan" }, { key: "sku", label: "SKU" }, { key: "instancias", label: "Instancias", align: "right" },
            { key: "apps", label: "Apps", align: "right" }, { key: "estado", label: "Estado" },
          ]} rows={appSvc} />
        </Section>
      )}

      {conn.length > 0 && (
        <Section id="conectividad" n="07" title="Conectividad">
          <SimpleTable cols={[
            { key: "nombre", label: "Nombre" }, { key: "proveedor", label: "Proveedor" }, { key: "ancho", label: "Capacidad" },
            { key: "estado", label: "Estado" }, { key: "obs", label: "Observación" },
          ]} rows={conn} />
        </Section>
      )}

      {(vaults.length > 0 || backupItems.length > 0) && (
        <Section id="respaldos" n="08" title="Respaldos">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Elementos protegidos" value={backupItems.length} />
            <Stat label="Vaults" value={vaults.length} />
            <Stat label="Jobs completados" value={jobsMes["Completado"] ?? 0} />
            <Stat label="Jobs con falla" value={jobsMes["Fallido"] ?? 0} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SimpleTable cols={[
              { key: "vault", label: "Vault" }, { key: "region", label: "Región" }, { key: "elementos", label: "Elementos", align: "right" },
              { key: "politicas", label: "Políticas" }, { key: "ultimo", label: "Último" },
            ]} rows={vaults} />
            <ReportDonut title="Jobs del mes" data={Object.entries(jobsMes).map(([k, v]) => ({
              name: k, value: v, color: /complet|exito/i.test(k) ? REPORT_COLORS.greenDark : /fall/i.test(k) ? REPORT_COLORS.crit : REPORT_COLORS.gold,
            }))} />
          </div>
          <SimpleTable cols={[
            { key: "servidor", label: "Servidor" }, { key: "tipo", label: "Tipo" }, { key: "retencion", label: "Retención" },
            { key: "estado", label: "Último estado", render: (r: BackupItem) => <span className={`text-xs px-2 py-0.5 rounded-full ${backupStateChip(r.estado)}`}>{r.estado}</span> },
            { key: "ultimo", label: "Fecha" },
          ]} rows={backupItems} />
          {narrative.backups_comentario && <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">{narrative.backups_comentario}</p>}
        </Section>
      )}

      {permisos && (
        <Section id="rbac" n="09" title="Permisos y roles (RBAC)">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Asignaciones" value={permisos.resumen.total} />
            <Stat label="Roles elevados" value={permisos.resumen.elevados} />
            <Stat label="Usuarios" value={permisos.resumen.usuarios} />
            <Stat label="Service principals" value={permisos.resumen.service_principals} />
          </div>
          <SimpleTable cols={[
            { key: "suscripcion", label: "Suscripción" }, { key: "total", label: "Total", align: "right" },
            { key: "elevados", label: "Elevados", align: "right" }, { key: "usuarios", label: "Usuarios", align: "right" },
            { key: "service_principals", label: "SP", align: "right" }, { key: "grupos", label: "Grupos", align: "right" },
          ]} rows={permisos.por_suscripcion} />
        </Section>
      )}

      {alertas && (
        <Section id="alertas" n="10" title="Alertas del mes">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Disparos" value={alertas.resumen.total} />
            <Stat label="Críticas" value={alertas.resumen.criticas} />
            <Stat label="Reglas activadas" value={alertas.resumen.reglas_activadas} />
            <Stat label="Suscripciones" value={alertas.resumen.suscripciones} />
          </div>
          {alertas.nota && <p className="text-xs text-muted-foreground">{alertas.nota}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SimpleTable cols={[
              { key: "tipo", label: "Regla", render: (r: AlertTipo) => shortRuleName(r.tipo) },
              { key: "severidad", label: "Severidad", render: (r: AlertTipo) => <span className={`text-xs px-2 py-0.5 rounded-full ${alertSeverityChip(r.severidad)}`}>{r.severidad}</span> },
              { key: "disparos", label: "Disparos", align: "right" },
            ]} rows={alertas.por_tipo} />
            <SimpleTable cols={[
              { key: "suscripcion", label: "Suscripción" }, { key: "disparos", label: "Disparos", align: "right" },
              { key: "criticas", label: "Críticas", align: "right" },
            ]} rows={alertas.por_suscripcion} />
          </div>
        </Section>
      )}

      <Section id="disponibilidad" n="11" title="Disponibilidad de la plataforma">
        <SimpleTable cols={[
          { key: "servicio", label: "Servicio" }, { key: "acordado_h", label: "Acordado (h)", align: "right" },
          { key: "caidas_h", label: "Caídas (h)", align: "right" }, { key: "disponibilidad", label: "Disponibilidad", align: "right" },
        ]} rows={sla} />
        {caidas.length > 0 ? (
          <SimpleTable cols={[
            { key: "inicio", label: "Inicio" }, { key: "fin", label: "Fin" }, { key: "servicios", label: "Servicios" }, { key: "causa", label: "Causa" },
          ]} rows={caidas} />
        ) : (
          <p className="text-xs text-muted-foreground">No se registraron eventos de disponibilidad en el período.</p>
        )}
        {narrative.disponibilidad_comentario && <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">{narrative.disponibilidad_comentario}</p>}
      </Section>

      {advisor?.series?.length ? (
        <Section id="advisor" n="12" title="Advisor Score (Well-Architected)">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(advisor.current?.pillars ?? {}).map(([k, v]) => (
              <Stat key={k} label={PILLARS[k] ?? k} value={`${Math.round(v)}%`} />
            ))}
          </div>
          <div className="rounded-xl border bg-card p-4">
            <ReportLine
              data={advisor.series.map((s) => ({ x: s.label, Promedio: Math.round(s.average) }))}
              series={[{ key: "Promedio", name: "Promedio Advisor", color: REPORT_COLORS.greenDark }]}
            />
          </div>
        </Section>
      ) : null}

      <Section id="conclusiones" n={advisor?.series?.length ? "13" : "12"} title="Conclusiones y recomendaciones">
        {(narrative.conclusiones?.length ?? 0) > 0 && (
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-medium mb-2">Conclusiones</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              {narrative.conclusiones!.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}
        {(narrative.recomendaciones?.length ?? 0) > 0 && (
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-medium mb-2">Recomendaciones</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              {narrative.recomendaciones!.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}
        {wafRecs.length > 0 && (
          <SimpleTable cols={[
            { key: "codigo", label: "ID" }, { key: "pilar", label: "Pilar" }, { key: "ambito", label: "Ámbito" },
            { key: "accion_cliente", label: "Acción cliente" }, { key: "accion_bit", label: "Acción Business IT" },
          ]} rows={wafRecs} />
        )}
      </Section>

      <VmDetailDialog vm={vm} perf={vm ? perfByName.get(vm.name) ?? null : null} open={vmOpen} onOpenChange={setVmOpen} />
    </div>
  );
}
