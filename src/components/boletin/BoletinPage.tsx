import { useMemo, useState } from "react";
import { RefreshCw, ExternalLink, Languages } from "lucide-react";
import AppShell from "@/components/AppShell";
import ClientHeader from "@/components/ClientHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBoletin } from "@/hooks/useBoletin";
import { URGENCY_META, SOURCE_LABEL, fmtDate, groupTexts } from "@/components/boletin/boletinMeta";
import RetirementDetailSheet from "@/components/boletin/RetirementDetailSheet";
import { canEditModule } from "@/lib/auth";
import type { BoletinGroup } from "@/types";

function Kpi({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: "red" | "amber" }) {
  const toneCls = tone === "red" ? "text-red-700 dark:text-red-400"
    : tone === "amber" ? "text-amber-700 dark:text-amber-400" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function UrgencyPill({ urgency }: { urgency: BoletinGroup["urgency"] }) {
  const m = URGENCY_META[urgency];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>;
}

/** Traduce el status del último sync para mostrarlo al usuario (fallback: el valor crudo). */
function syncStatusEs(status: string): string {
  switch (status) {
    case "partial": return "parcial";
    case "failed": return "fallido";
    case "running": return "en curso";
    default: return status;
  }
}

export default function BoletinPage({ onNavigate }: { onNavigate: (key: string) => void }) {
  const { clients, clientId, view, loading, dataLoading, syncing, error, selectClient, sync } = useBoletin();
  const [q, setQ] = useState("");
  const [urgency, setUrgency] = useState<string>("todas");
  const [english, setEnglish] = useState(false);
  const [detail, setDetail] = useState<BoletinGroup | null>(null);
  const canEdit = canEditModule("boletin");

  const filtered = useMemo(() => {
    const groups = view?.groups ?? [];
    const needle = q.trim().toLowerCase();
    return groups.filter((g) =>
      (urgency === "todas" || g.urgency === urgency) &&
      (needle === "" ||
        g.title.toLowerCase().includes(needle) ||
        (g.title_es ?? "").toLowerCase().includes(needle) ||
        g.retiring_feature.toLowerCase().includes(needle) ||
        (g.recommended_action ?? "").toLowerCase().includes(needle) ||
        (g.recommended_action_es ?? "").toLowerCase().includes(needle)));
  }, [view, q, urgency]);

  const upcoming = useMemo(() =>
    (view?.groups ?? []).filter((g) => g.urgency === "proximo" || g.urgency === "programado").slice(0, 6),
  [view]);

  const hasActiveFilters = q.trim() !== "" || urgency !== "todas";
  const emptyRetirosText = hasActiveFilters
    ? "Sin retiros que impacten a este cliente con los filtros actuales."
    : "Sin retiros de Azure que impacten a este cliente.";

  const clientSelect = (
    <ClientHeader clients={clients} clientId={clientId} onSelect={selectClient} disabled={syncing || dataLoading} />
  );

  return (
    <AppShell
      title="Boletín Azure"
      subtitle="Retiros, fin de soporte y novedades de Microsoft Azure con impacto en el ambiente del cliente."
      active="boletin"
      onNavigate={onNavigate}
      headerRight={clientSelect}
    >
      {loading ? (
        <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div>
      ) : (
        <div className="space-y-4">
          {/* Barra de vitalidad: última sincronización + acción */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-card px-4 py-2.5 text-xs text-muted-foreground">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Fuentes</span>
            {view?.last_sync ? (
              <>
                <span><b className="font-semibold text-foreground">Advisor</b> · {view.last_sync.advisor_items} avisos</span>
                <span><b className="font-semibold text-foreground">Service Health</b> · {view.last_sync.health_items} avisos</span>
                <span>Última sincronización: {new Date(view.last_sync.started_at).toLocaleString("es-EC")}
                  {view.last_sync.status !== "completed" ? ` (${syncStatusEs(view.last_sync.status)})` : ""}</span>
              </>
            ) : (
              <span>Sin sincronizaciones todavía — usa &quot;Sincronizar&quot; para traer los avisos del tenant.</span>
            )}
            {canEdit ? (
              <Button size="sm" className="ml-auto" onClick={() => void sync()} disabled={syncing || clientId == null}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando…" : "Sincronizar"}
              </Button>
            ) : null}
          </div>

          {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">{error}</div> : null}

          <Tabs defaultValue="resumen">
            <TabsList>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="retiros">
                Retiros y deprecaciones{view ? ` (${view.kpis.announcements})` : ""}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi label="Retiros que impactan" value={view?.kpis.announcements ?? 0} tone="red"
                  sub="solo anuncios que afectan a este cliente" />
                <Kpi label="Vencen en < 6 meses" value={view?.kpis.due_soon ?? 0} tone="amber" />
                <Kpi label="Recursos afectados" value={view?.kpis.resources ?? 0}
                  sub={view ? `en ${view.kpis.subscriptions_impacted} de ${view.kpis.subscriptions_total} suscripciones administradas` : undefined} />
                <Kpi label="Ya retirados" value={view?.kpis.already_retired ?? 0}
                  sub="verificar dependencias residuales" />
              </div>

              <div className="rounded-xl border bg-card">
                <div className="border-b px-4 py-3 text-sm font-semibold">Próximos vencimientos</div>
                {upcoming.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">Sin vencimientos futuros registrados.</div>
                ) : (
                  <ul className="divide-y">
                    {upcoming.map((g) => {
                      // El resumen siempre en español, sin importar el toggle del tab Retiros.
                      const texts = groupTexts(g, false);
                      return (
                        <li key={`${g.source}:${g.announcement_key}`} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
                          <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground tabular-nums">
                            {fmtDate(g.retirement_date)}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{texts.title}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {g.resource_count > 0 ? `${g.resource_count} recursos` : "aviso de suscripción"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <p className="max-w-3xl text-xs text-muted-foreground">
                Generado desde Azure Advisor (Service Upgrade and Retirement) y Service Health del tenant del cliente.
                Las fechas provienen de anuncios de Microsoft y pueden cambiar: valida el estado vigente en el portal
                antes de ejecutar cambios. Documento de priorización — no incluye información de costos.
              </p>
            </TabsContent>

            <TabsContent value="retiros" className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar servicio, feature o acción…"
                  aria-label="Buscar servicio, feature o acción"
                  className="h-9 w-64 rounded-md border bg-background px-3 text-sm"
                />
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  aria-label="Filtrar por urgencia"
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="todas">Todas las urgencias</option>
                  <option value="retirado">Retirado</option>
                  <option value="proximo">Vence &lt; 6 m</option>
                  <option value="programado">Programado</option>
                  <option value="sin_fecha">Sin fecha</option>
                </select>
                <Button
                  variant={english ? "default" : "outline"}
                  size="sm"
                  aria-label="Alternar idioma inglés"
                  onClick={() => setEnglish((v) => !v)}
                >
                  <Languages className="mr-1.5 h-3.5 w-3.5" />
                  {english ? "Español" : "Inglés"}
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {filtered.length} de {view?.groups.length ?? 0} anuncios
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5 font-semibold">Servicio / componente</th>
                      <th className="px-4 py-2.5 font-semibold">Urgencia</th>
                      <th className="px-4 py-2.5 font-semibold">Fecha límite</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Recursos</th>
                      <th className="px-4 py-2.5 font-semibold">Acción recomendada</th>
                      <th className="px-4 py-2.5 font-semibold">Fuente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataLoading ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        {emptyRetirosText}
                      </td></tr>
                    ) : filtered.map((g) => {
                      const texts = groupTexts(g, english);
                      return (
                        <tr
                          key={`${g.source}:${g.announcement_key}`}
                          role="button"
                          tabIndex={0}
                          aria-label={`Ver detalle de ${g.retiring_feature || texts.title}`}
                          onClick={() => setDetail(g)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetail(g); }
                          }}
                          className="cursor-pointer border-b align-top last:border-b-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
                        >
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{g.retiring_feature || texts.title}</div>
                            {g.retiring_feature ? <div className="text-xs text-muted-foreground">{texts.title}</div> : null}
                          </td>
                          <td className="px-4 py-2.5"><UrgencyPill urgency={g.urgency} /></td>
                          <td className="px-4 py-2.5 tabular-nums">{fmtDate(g.retirement_date)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{g.resource_count || "—"}</td>
                          <td className="max-w-72 px-4 py-2.5 text-xs text-muted-foreground">
                            <span className="line-clamp-2">{texts.action ?? "—"}</span>
                            {g.learn_more_url ? (
                              <a href={g.learn_more_url} target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                // El onKeyDown de la fila (abre el sheet con Enter/Espacio) intercepta
                                // el Enter del link ANTES de que el navegador lo navegue, porque el
                                // evento burbujea desde el <a> hasta el <tr>. stopPropagation acá corta
                                // esa burbuja para el teclado igual que ya se hace con el click.
                                onKeyDown={(e) => e.stopPropagation()}
                                className="mt-0.5 inline-flex items-center gap-1 text-primary hover:underline">
                                Más información <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{SOURCE_LABEL[g.source]}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
      <RetirementDetailSheet
        group={detail}
        subscriptions={view?.subscriptions}
        open={detail != null}
        onOpenChange={(o) => { if (!o) setDetail(null); }}
        english={english}
      />
    </AppShell>
  );
}
