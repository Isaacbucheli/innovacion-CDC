import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, RefreshCw } from "lucide-react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import WafClientHeader from "@/components/waf/WafClientHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReportView from "@/components/reports/ReportView";
import { listClientsAdmin, listReports, getMonthlyReport, generateReport } from "@/lib/api";
import { getRole } from "@/lib/auth";
import type { ClientAdmin, ReportListEntry, MonthlyReport } from "@/types";

const KEY = "innovacion_cdc_waf_client";
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

export default function ReportPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const canEdit = getRole() === "admin" || getRole() === "consultor";
  const now = useMemo(() => new Date(), []);
  const [clients, setClients] = useState<ClientAdmin[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState<ReportListEntry[]>([]);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [genMsg, setGenMsg] = useState("");
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = now.getFullYear(); y >= 2024; y--) out.push(y);
    return out;
  }, [now]);

  useEffect(() => {
    listClientsAdmin().then((cs) => {
      setClients(cs);
      const stored = Number(localStorage.getItem(KEY));
      setClientId(cs.some((c) => c.client_id === stored) ? stored : cs[0]?.client_id ?? null);
    }).catch((e) => toast.error(msg(e))).finally(() => setLoading(false));
  }, []);

  // Historial de informes del cliente.
  useEffect(() => {
    if (clientId == null) return;
    listReports(clientId).then((r) => setEntries(r.reports ?? [])).catch(() => setEntries([]));
  }, [clientId]);

  const entry = useMemo(
    () => entries.find((e) => e.year === year && e.month === month) ?? null,
    [entries, year, month],
  );

  // Carga el JSON del informe cuando el periodo seleccionado está completo.
  useEffect(() => {
    if (clientId == null) { setReport(null); return; }
    if (entry?.status !== "completed") { setReport(null); return; }
    setLoadingReport(true);
    getMonthlyReport(clientId, year, month)
      .then((r) => mounted.current && setReport(r))
      .catch((e) => { if (mounted.current) { setReport(null); toast.error(msg(e)); } })
      .finally(() => mounted.current && setLoadingReport(false));
  }, [clientId, year, month, entry?.status]);

  function selectClient(id: number) { localStorage.setItem(KEY, String(id)); setClientId(id); setReport(null); }

  async function refreshEntries(): Promise<ReportListEntry[]> {
    if (clientId == null) return [];
    const r = await listReports(clientId);
    if (mounted.current) setEntries(r.reports ?? []);
    return r.reports ?? [];
  }

  async function generate() {
    if (clientId == null) return;
    setGenMsg("Iniciando generación del informe…");
    try {
      await generateReport(clientId, { year, month, include_narrative: true });
      // Polling: hasta 12 min (120 × 6s) consultando el índice de informes.
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 6000));
        if (!mounted.current) return;
        const list = await refreshEntries();
        const e = list.find((x) => x.year === year && x.month === month);
        if (e?.status === "completed") { setGenMsg(""); toast.success("Informe generado."); return; }
        if (e?.status === "failed") { setGenMsg(""); toast.error("La generación del informe falló."); return; }
        setGenMsg(`Generando informe… (${i + 1})`);
      }
      setGenMsg("");
      toast.error("La generación está tardando más de lo previsto. Revisa más tarde.");
    } catch (e) {
      setGenMsg("");
      toast.error(msg(e));
    }
  }

  const periodLabel = `${MESES[month - 1]} ${year}`;
  const generating = !!genMsg || entry?.status === "generating";

  return (
    <AppShell title="Informe de gestión mensual" subtitle="Informes · resumen mensual de la plataforma"
      active="report" onNavigate={onNavigate}
      headerRight={<WafClientHeader clients={clients} clientId={clientId} onSelect={selectClient} />}>
      <BusyOverlay show={loading} title="Cargando" />
      <div className="space-y-5">
        {/* Selector de periodo + acciones */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          {canEdit && (
            <Button size="sm" disabled={generating || clientId == null} onClick={generate}>
              <RefreshCw className={`w-4 h-4 mr-1 ${generating ? "animate-spin" : ""}`} />
              {entry ? "Regenerar" : "Generar informe"}
            </Button>
          )}
        </div>

        {/* Chips: informes disponibles */}
        {entries.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Disponibles:</span>
            {entries.slice(0, 12).map((e) => {
              const isActive = e.year === year && e.month === month;
              return (
                <button
                  key={e.report_id}
                  onClick={() => { setYear(e.year); setMonth(e.month); }}
                  className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                    isActive ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/70"
                  }`}
                >
                  {MESES[e.month - 1].slice(0, 3)} {e.year}{e.is_partial ? " ·parcial" : ""}
                </button>
              );
            })}
          </div>
        )}

        {/* Cuerpo según estado */}
        {generating ? (
          <div className="rounded-xl border bg-card p-10 text-center">
            <RefreshCw className="w-6 h-6 mx-auto mb-3 animate-spin text-primary" />
            <p className="text-sm font-medium">{genMsg || "Generando informe…"}</p>
            <p className="text-xs text-muted-foreground mt-1">La generación puede tardar varios minutos.</p>
          </div>
        ) : loadingReport ? (
          <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">Cargando informe…</div>
        ) : report && clientId != null ? (
          <ReportView report={report} clientId={clientId} year={year} month={month} />
        ) : (
          <div className="rounded-xl border bg-card p-10 text-center">
            <FileText className="w-7 h-7 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">No hay informe para {periodLabel}.</p>
            <p className="text-xs text-muted-foreground mt-1">
              {canEdit ? "Genera el informe con el botón de arriba." : "Aún no se ha generado el informe de este periodo."}
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
