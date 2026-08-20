import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ArrowLeft, Image as ImageIcon, Sparkles, Printer, Presentation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ReportDonut from "@/components/reports/ReportDonut";
import ReportBars from "@/components/reports/ReportBars";
import ReportLine from "@/components/reports/ReportLine";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import ExecutiveActionPlan from "@/components/reports/ExecutiveActionPlan";
import { getExecutive, generateExecutiveNarrative, fetchClientLogoObjectUrl, uploadClientLogo, deleteClientLogo } from "@/lib/api";
import { fmtDateISO } from "@/lib/dates";
import { REPORT_COLORS } from "@/lib/report";
import {
  STATE_COLORS, STATE_LABELS, STATE_HEADLINES, WAF_PILLARS,
  kpiData, buildFindings, pct, deltaText, advisorTone, jobKind, type Tone,
} from "@/lib/executive";
import type { ExecutivePayload, MonthlyReport } from "@/types";

const TABS = [
  { key: "ejecutivo", label: "Resumen ejecutivo" },
  { key: "performance", label: "Performance" },
  { key: "paas", label: "Servicios / PaaS" },
  { key: "backup", label: "Backup" },
  { key: "advisor", label: "Advisor Score" },
  { key: "acciones", label: "Plan de acción" },
];

interface AppSvcRow { plan: string; sku?: string; apps?: string | number }
interface AppPlanMetric { resource_name: string; cpu_avg?: number; ram_avg?: number }
interface PerfVmRow { resource_name: string; cpu_avg?: number; cpu_max?: number; ram_avg?: number; ram_max?: number }
interface AdvisorHist {
  current?: { pillars?: Record<string, number>; snapshot_date?: string; captured_at?: string };
  delta?: Record<string, number>;
  series?: { label?: string; month?: string; average: number }[];
}

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }
const accentFor = (tone: Tone) =>
  tone === "danger" ? REPORT_COLORS.crit : tone === "warn" ? REPORT_COLORS.gold
    : tone === "neutral" ? REPORT_COLORS.muted : REPORT_COLORS.greenDark;

function Kpi({ label, value, hint, tone = "" }: { label: string; value: React.ReactNode; hint?: string; tone?: Tone }) {
  return (
    <div className="rounded-xl border bg-card p-4 border-l-[3px]" style={{ borderLeftColor: accentFor(tone) }}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums tracking-tight mt-0.5">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function Insight({ tone, title, text }: { tone: string; title: string; text: string }) {
  const accent = tone === "bad" ? REPORT_COLORS.crit : tone === "warn" ? REPORT_COLORS.gold : REPORT_COLORS.greenDark;
  return (
    <div className="rounded-xl border bg-card p-4 border-l-[3px]" style={{ borderLeftColor: accent }}>
      <div className="text-sm font-medium">{title}</div>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{text}</p>
    </div>
  );
}

function StatusPill({ estado, title }: { estado: string; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: `${STATE_COLORS[estado] ?? STATE_COLORS.verde}22`, color: STATE_COLORS[estado] ?? STATE_COLORS.verde }}>
      <span className="w-2 h-2 rounded-full" style={{ background: STATE_COLORS[estado] ?? STATE_COLORS.verde }} />
      {STATE_LABELS[estado] ?? estado}
    </span>
  );
}

export default function ExecutiveDashboard({ report, clientId, year, month, canEdit, onBack }: {
  report: MonthlyReport; clientId: number; year: number; month: number; canEdit: boolean; onBack: () => void;
}) {
  const [exec, setExec] = useState<ExecutivePayload | null>(null);
  const [tab, setTab] = useState("ejecutivo");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    getExecutive(clientId, year, month).then((e) => { if (alive) setExec(e); }).catch((e) => { if (alive) toast.error(`No se pudo cargar la vista gerencial: ${msg(e)}`); });
    return () => { alive = false; };
  }, [clientId, year, month]);

  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    fetchClientLogoObjectUrl(clientId).then((u) => { if (alive) { url = u; setLogoUrl(u); } }).catch(() => { if (alive) setLogoUrl(null); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [clientId]);

  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPresenting(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting]);

  const k = useMemo(() => kpiData(report), [report]);
  const findings = useMemo(() => buildFindings(report, exec), [report, exec]);
  const overall = exec?.semaforo?.estado_general ?? "verde";
  const threshold = exec?.semaforo?.umbral_presion ?? 90;
  const narrative = exec?.narrative ?? null;
  const domains = exec?.semaforo?.dominios ?? [];
  const readings = narrative?.lectura_dominios ?? {};

  async function genNarrative() {
    setGenBusy(true);
    try {
      const res = await generateExecutiveNarrative(clientId, year, month);
      setExec((prev) => ({ ...(prev ?? {}), semaforo: res.semaforo, narrative: res.narrative }));
      toast.success("Lectura gerencial generada.");
    } catch (e) { toast.error(`No se pudo generar la lectura IA: ${msg(e)}`); }
    finally { setGenBusy(false); }
  }

  async function onLogoPick(file: File) {
    if (file.size > 2 * 1024 * 1024) { toast.error("El logo supera el límite de 2 MB."); return; }
    try {
      await uploadClientLogo(clientId, file);
      const u = await fetchClientLogoObjectUrl(clientId);
      setLogoUrl(u);
      toast.success("Logo actualizado.");
    } catch (e) { toast.error(`No se pudo subir el logo: ${msg(e)}`); }
  }

  async function removeLogo() {
    if (!window.confirm("¿Quitar el logo del cliente?")) return;
    try { await deleteClientLogo(clientId); setLogoUrl(null); toast.success("Logo eliminado."); }
    catch (e) { toast.error(`No se pudo quitar el logo: ${msg(e)}`); }
  }

  const period = report.period?.label ?? "";
  const clientName = report.client?.name ?? "Cliente";
  const regions = (report.meta?.regiones ?? []).join(", ");

  // ---- datos derivados por sección ----
  const status = report.estado_recursos ?? [];
  const available = status.reduce((s, r) => s + (r.disponibles ?? 0), 0);
  const vms = (report.performance?.virtual_machines ?? []) as PerfVmRow[];
  const jobs = report.backups?.jobs_mes ?? {};
  const advisor = report.advisor_score_history as AdvisorHist | undefined;

  const kpis = [
    { label: "Disponibilidad", value: k.events ? `${k.events} evento(s)` : "100%", hint: k.events ? "Eventos de Azure en el periodo" : "Sin caídas reportadas", tone: (k.events ? "warn" : "") as Tone },
    { label: "Máquinas virtuales", value: k.total, hint: `${k.running} encendidas · ${k.total - k.running} detenidas`, tone: "neutral" as Tone },
    { label: "CPU promedio", value: pct(k.cpuAvg), hint: "Promedio del parque con métricas", tone: ((k.cpuAvg ?? 0) >= threshold ? "danger" : "") as Tone },
    { label: "RAM promedio", value: pct(k.ramAvg), hint: "Promedio del parque con métricas", tone: ((k.ramAvg ?? 0) >= threshold ? "danger" : "") as Tone },
    { label: "Recursos no disponibles", value: k.unavailable, hint: k.unavailable ? "Principal desviación operativa" : "Todo el universo PaaS disponible", tone: (k.unavailable ? "danger" : "") as Tone },
    { label: "VMs con backup", value: `${k.protectedVms}/${k.total}`, hint: k.protectedVms < k.total ? "Validar cobertura vs criticidad" : "Cobertura completa", tone: (k.protectedVms < k.total ? "warn" : "") as Tone },
  ];

  const perfCritical = vms.filter((v) => (v.cpu_avg ?? 0) >= threshold || (v.ram_avg ?? 0) >= threshold || (v.cpu_max ?? 0) >= threshold || (v.ram_max ?? 0) >= threshold)
    .sort((a, b) => Math.max(b.ram_avg ?? 0, b.cpu_avg ?? 0) - Math.max(a.ram_avg ?? 0, a.cpu_avg ?? 0)).slice(0, 12);
  const perfCols: SimpleCol<PerfVmRow>[] = [
    { key: "resource_name", label: "Recurso", render: (r) => <span className="font-medium">{r.resource_name}</span> },
    { key: "cpu_avg", label: "CPU prom.", align: "right", render: (r) => pct(r.cpu_avg) },
    { key: "cpu_max", label: "CPU máx.", align: "right", render: (r) => pct(r.cpu_max) },
    { key: "ram_avg", label: "RAM prom.", align: "right", render: (r) => pct(r.ram_avg) },
    { key: "ram_max", label: "RAM máx.", align: "right", render: (r) => pct(r.ram_max) },
    { key: "lectura", label: "Lectura", render: (r) => {
      const sustained = (r.cpu_avg ?? 0) >= threshold || (r.ram_avg ?? 0) >= threshold;
      return <StatusPill estado={sustained ? "rojo" : "amarillo"} title={sustained ? "Riesgo alto" : "Picos críticos"} />;
    } },
  ];

  const appSvcs = (report.app_services as AppSvcRow[] | undefined) ?? [];
  const planMetrics = new Map<string, AppPlanMetric>();
  ((report.performance?.app_service_plans ?? []) as AppPlanMetric[]).forEach((p) => planMetrics.set(p.resource_name, p));
  const paasKpis = [
    { label: "Recursos evaluados", value: status.reduce((s, r) => s + (r.total ?? 0), 0), hint: "Tipos presentes en el cliente", tone: "neutral" as Tone },
    { label: "Disponibles", value: available, hint: "Recursos operativos", tone: "" as Tone },
    { label: "No disponibles", value: k.unavailable, hint: k.unavailable ? "Revisión prioritaria" : "Sin pendientes", tone: (k.unavailable ? "danger" : "") as Tone },
    { label: "Planes App Service", value: appSvcs.length, hint: "Con métricas del mes", tone: "neutral" as Tone },
  ];
  const planRows = appSvcs.map((p) => ({ ...p, metrics: planMetrics.get(p.plan) ?? {} }))
    .sort((a, b) => ((b.metrics as AppPlanMetric).ram_avg ?? 0) - ((a.metrics as AppPlanMetric).ram_avg ?? 0)).slice(0, 8);

  const backupInsights: { tone: string; title: string; text: string }[] = [];
  {
    let failed = 0, warnings = 0, completed = 0;
    Object.entries(jobs).forEach(([label, count]) => {
      const kind = jobKind(label);
      if (kind === "fallido") failed += count; else if (kind === "advertencia") warnings += count; else completed += count;
    });
    backupInsights.push(failed
      ? { tone: "bad", title: `${failed} respaldo(s) fallidos`, text: "Revisar causa y reejecución de los trabajos fallidos del periodo." }
      : { tone: "", title: "Sin fallos de respaldo", text: `La operación de backup se mantuvo estable durante el mes, con ${completed} trabajos completados.` });
    if (k.protectedVms < k.total) backupInsights.push({ tone: "warn", title: "Cobertura pendiente de confirmar", text: `${k.protectedVms} VM(s) protegidas frente a ${k.total} inventariadas. Validar si las restantes son no críticas, temporales o excluidas formalmente.` });
    if (warnings) backupInsights.push({ tone: "warn", title: `${warnings} trabajo(s) con advertencias`, text: "No son fallos, pero deben revisarse para evitar degradación futura de la protección." });
  }

  const advScores = advisor?.current?.pillars ?? {};
  const advDelta = advisor?.delta ?? {};
  const advSeries = advisor?.series ?? [];
  // Fecha del último snapshot; si el snapshot no trae fecha, se cae al texto de "sin snapshots".
  const advSnapshotDate = advisor?.current
    ? advisor.current.snapshot_date || fmtDateISO(advisor.current.captured_at)
    : "";

  const content = (
    <div className="space-y-6">
      {/* Barra de acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" />Volver al informe</Button>
        <div className="flex-1" />
        {canEdit && (
          <>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><ImageIcon className="w-4 h-4 mr-1" />{logoUrl ? "Cambiar logo" : "Subir logo"}</Button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogoPick(f); e.target.value = ""; }} />
            <Button size="sm" variant="outline" disabled={genBusy} onClick={genNarrative}>
              <Sparkles className={`w-4 h-4 mr-1 ${genBusy ? "animate-pulse" : ""}`} />{narrative ? "Regenerar lectura IA" : "Generar lectura IA"}
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" />Imprimir / PDF</Button>
        <Button size="sm" variant={presenting ? "default" : "outline"} onClick={() => setPresenting((v) => !v)}>
          {presenting ? <><X className="w-4 h-4 mr-1" />Salir de presentación</> : <><Presentation className="w-4 h-4 mr-1" />Modo presentación</>}
        </Button>
      </div>

      {/* Hero */}
      <div className="rounded-xl border bg-card p-6 flex flex-col md:flex-row gap-6 md:items-center justify-between">
        <div className="flex items-center gap-4">
          {logoUrl && (
            <img src={logoUrl} alt="Logo del cliente" onClick={canEdit ? removeLogo : undefined}
              title={canEdit ? "Click para quitar el logo" : undefined}
              className={`h-12 max-w-[160px] object-contain ${canEdit ? "cursor-pointer" : ""}`} />
          )}
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Business IT · Servicios Administrados Azure · {clientName}</div>
            <h2 className="text-xl font-semibold mt-0.5">Dashboard gerencial de salud y performance Azure</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Vista ejecutiva del informe mensual: disponibilidad, performance, servicios, respaldos y prioridades de acción.
              {period && ` Periodo: ${period}`}{regions && ` · Región: ${regions}`}.
            </p>
          </div>
        </div>
        <div className="md:text-right md:min-w-[240px]">
          <StatusPill estado={overall} />
          <h3 className="text-base font-semibold mt-2">{narrative?.titular || STATE_HEADLINES[overall] || "Resumen del periodo"}</h3>
          <p className="text-sm text-muted-foreground mt-1">{narrative?.sintesis || "Genera la lectura IA para obtener la síntesis gerencial del periodo."}</p>
          {narrative?.sintesis && <span className="text-[11px] text-muted-foreground italic">Lectura generada con IA{narrative.generated_at ? ` · ${fmtDateISO(narrative.generated_at)}` : ""}</span>}
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`text-sm px-3 py-2 -mb-px border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Resumen ejecutivo */}
      {tab === "ejecutivo" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpis.map((kpi) => <Kpi key={kpi.label} {...kpi} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-medium">Semáforo gerencial por dominio</h3>
              <p className="text-xs text-muted-foreground mb-2">Estados calculados con reglas fijas sobre los datos del informe (pasa el cursor sobre el estado para ver el criterio).</p>
              <Table>
                <TableHeader><TableRow><TableHead>Dominio</TableHead><TableHead>Estado</TableHead><TableHead>Lectura gerencial</TableHead></TableRow></TableHeader>
                <TableBody>
                  {domains.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sin dominios evaluables en este informe.</TableCell></TableRow>
                  ) : domains.map((d) => (
                    <TableRow key={d.dominio}>
                      <TableCell className="font-medium">{d.etiqueta}</TableCell>
                      <TableCell><StatusPill estado={d.estado} title={d.criterio} /></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{readings[d.dominio] || d.lectura}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-medium">Top prioridades del mes</h3>
              <p className="text-xs text-muted-foreground mb-2">Derivadas automáticamente de los hallazgos del periodo.</p>
              {findings.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Sin prioridades críticas: el periodo no registra hallazgos relevantes.</p>
              ) : (
                <div className="space-y-2">
                  {findings.slice(0, 5).map((f, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-md grid place-items-center text-xs font-bold text-white" style={{ background: STATE_COLORS[f.nivel] ?? STATE_COLORS.verde }}>{i + 1}</span>
                      <div><div className="text-sm font-medium">{f.titulo}</div><div className="text-xs text-muted-foreground">{f.detalle}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ReportDonut title="Distribución de VMs" data={[
              { name: "En ejecución", value: k.running, color: REPORT_COLORS.greenDark },
              { name: "Detenidas", value: k.total - k.running, color: REPORT_COLORS.gold },
            ]} />
            <ReportDonut title="Recursos PaaS" data={[
              { name: "Disponibles", value: available, color: REPORT_COLORS.greenDark },
              { name: "No disponibles", value: k.unavailable, color: REPORT_COLORS.crit },
            ]} />
            <ReportDonut title="Cobertura de backup" data={[
              { name: "Con backup", value: k.protectedVms, color: REPORT_COLORS.greenDark },
              { name: "Por validar", value: Math.max(k.total - k.protectedVms, 0), color: REPORT_COLORS.gold },
            ]} />
          </div>
        </div>
      )}

      {/* Performance */}
      {tab === "performance" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ReportBars title="Top consumo de CPU promedio" color={REPORT_COLORS.greenDark} unit="%"
              data={[...vms].sort((a, b) => (b.cpu_avg ?? 0) - (a.cpu_avg ?? 0)).slice(0, 10).map((v) => ({ name: v.resource_name, value: Math.round(v.cpu_avg ?? 0) }))} />
            <ReportBars title="Top consumo de RAM promedio" color={REPORT_COLORS.gold} unit="%"
              data={[...vms].sort((a, b) => (b.ram_avg ?? 0) - (a.ram_avg ?? 0)).slice(0, 10).map((v) => ({ name: v.resource_name, value: Math.round(v.ram_avg ?? 0) }))} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-1">Recursos críticos de performance</h3>
            <p className="text-xs text-muted-foreground mb-2">VMs con promedio o máximos de CPU/RAM sobre el umbral de {threshold}%.</p>
            <SimpleTable cols={perfCols} rows={perfCritical} empty={`Sin recursos sobre el umbral de ${threshold}% en el periodo.`} />
          </div>
        </div>
      )}

      {/* Servicios / PaaS */}
      {tab === "paas" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{paasKpis.map((kpi) => <Kpi key={kpi.label} {...kpi} />)}</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-medium mb-2">Estado de servicios Azure</h3>
              {status.length === 0 ? <p className="text-xs text-muted-foreground py-8 text-center">Sin datos.</p> : (
                <div style={{ height: Math.max(160, status.length * 34 + 30) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={status} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="tipo" width={150} tick={{ fontSize: 11 }} interval={0} />
                      <Tooltip cursor={{ fill: "transparent" }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="disponibles" name="Disponibles" stackId="s" fill={REPORT_COLORS.greenDark} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="con_alerta" name="Revisar" stackId="s" fill={REPORT_COLORS.crit} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Planes App Service destacados</h3>
              <SimpleTable
                cols={[
                  { key: "plan", label: "Plan", render: (r: (typeof planRows)[number]) => <span className="font-medium">{r.plan}</span> },
                  { key: "sku", label: "SKU", render: (r) => r.sku || "" },
                  { key: "apps", label: "Apps", align: "right", render: (r) => String(r.apps ?? "") },
                  { key: "cpu", label: "CPU", align: "right", render: (r) => pct((r.metrics as AppPlanMetric).cpu_avg) },
                  { key: "ram", label: "RAM", align: "right", render: (r) => pct((r.metrics as AppPlanMetric).ram_avg) },
                ]}
                rows={planRows} empty="Sin planes App Service en el periodo." />
            </div>
          </div>
        </div>
      )}

      {/* Backup */}
      {tab === "backup" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ReportDonut title="Cobertura de respaldo" data={[
              { name: "VMs con backup", value: k.protectedVms, color: REPORT_COLORS.greenDark },
              { name: "VMs por validar", value: Math.max(k.total - k.protectedVms, 0), color: REPORT_COLORS.gold },
            ]} />
            <ReportDonut title="Jobs del mes" data={Object.entries(jobs).map(([label, count]) => ({
              name: label, value: count,
              color: jobKind(label) === "fallido" ? REPORT_COLORS.crit : jobKind(label) === "advertencia" ? REPORT_COLORS.gold : REPORT_COLORS.greenDark,
            }))} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Lectura de continuidad</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{backupInsights.map((ins, i) => <Insight key={i} {...ins} />)}</div>
          </div>
        </div>
      )}

      {/* Advisor Score */}
      {tab === "advisor" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((p) => {
              const v = advScores[String(p)];
              return <Kpi key={p} label={WAF_PILLARS[p]} value={v === undefined ? "" : `${Math.round(Number(v))}%`} hint={deltaText(advDelta[String(p)])} tone={advisorTone(v)} />;
            })}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-medium mb-1">Evolución mensual Advisor Score</h3>
              <p className="text-xs text-muted-foreground mb-2">
                {advSnapshotDate ? `Último snapshot guardado: ${advSnapshotDate}.` : "Sin snapshots para el periodo; se completará con el refresh semanal."}
              </p>
              {advSeries.length > 0 ? (
                <ReportLine data={advSeries.map((s) => ({ x: s.label ?? s.month ?? "", Promedio: Math.round(s.average) }))}
                  series={[{ key: "Promedio", name: "Promedio Advisor Score", color: REPORT_COLORS.greenDark }]} yDomain={[0, 100]} />
              ) : <p className="text-xs text-muted-foreground py-8 text-center">Sin serie histórica.</p>}
            </div>
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-medium mb-2">Lectura ejecutiva</h3>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((p) => {
                  const v = advScores[String(p)];
                  const change = advDelta[String(p)];
                  if (v === undefined) return <Insight key={p} tone="warn" title={WAF_PILLARS[p]} text="Sin snapshot disponible para este pilar en el periodo." />;
                  const trend = change === null || change === undefined ? "sin comparativo mensual"
                    : change > 0 ? `mejora de ${Number(change).toFixed(1)} puntos`
                      : change < 0 ? `deterioro de ${Math.abs(Number(change)).toFixed(1)} puntos` : "sin variación mensual";
                  return <Insight key={p} tone={Number(v) < 50 ? "bad" : Number(v) < 80 ? "warn" : ""} title={`${WAF_PILLARS[p]} · ${Math.round(Number(v))}%`} text={`Lectura mensual: ${trend}.`} />;
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan de acción */}
      {tab === "acciones" && <ExecutiveActionPlan clientId={clientId} year={year} month={month} />}
    </div>
  );

  if (presenting) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">{content}</div>
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground bg-card border rounded-full px-3 py-1 shadow-sm">
          Modo presentación · pulsa Esc para salir
        </div>
      </div>
    );
  }
  return content;
}
