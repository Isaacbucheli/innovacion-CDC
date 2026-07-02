import { useEffect, useMemo, useState } from "react";
import { Calculator, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchInput from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CostsKpis from "@/components/costs/CostsKpis";
import ServicesSummary from "@/components/costs/ServicesSummary";
import CostsDataTable from "@/components/costs/CostsDataTable";
import ScenarioCards from "@/components/costs/ScenarioCards";
import SubscriptionFilter from "@/components/costs/SubscriptionFilter";
import InventorySummary from "@/components/costs/InventorySummary";
import CoverageTab from "@/components/costs/CoverageTab";
import CalculateDialog from "@/components/costs/CalculateDialog";
import ClientCombobox from "@/components/costs/ClientCombobox";
import ImportDialog from "@/components/costs/ImportDialog";
import OptionsMenu from "@/components/costs/OptionsMenu";
import ManualCostDialog from "@/components/costs/ManualCostDialog";
import FinOpsRefreshDialog from "@/components/costs/FinOpsRefreshDialog";
import { useCosts } from "@/hooks/useCosts";
import { applySubscriptionFilter, computeKpis, filterResults, serviceName, subscriptionNames } from "@/lib/costs";
import { categoryOf } from "@/lib/finops";
import { bestEffortRefresh, runCalculation } from "@/lib/costActions";
import {
  clearPriceCache,
  downloadFromApi,
  generateExcel,
  getFinOpsLookups,
  importInventory,
  recalcScenarios,
  refreshPowerHistory,
  refreshRiCoverage,
} from "@/lib/api";
import { canEdit, getRole } from "@/lib/auth";
import type { CostResult, FinOpsLookups } from "@/types";

const RI_SOURCE_LABELS: Record<string, string> = {
  consumption: "consumo confirmado (Azure)",
  partial: "parcial (confirmado + estimado)",
  estimated_only: "solo estimado",
  no_reservations: "sin reservas activas",
  no_analysis: "sin análisis",
  error: "error de lectura",
};

const POWER_SOURCE_LABELS: Record<string, string> = {
  activity_log: "Activity Log de Azure",
  no_events: "sin eventos de encendido/apagado en el periodo",
  no_vms: "sin VMs en el análisis",
  no_analysis: "sin análisis",
};

const msg = (e: unknown) => (e instanceof Error ? e.message : "Error inesperado");

export default function CostsPage({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const {
    clients,
    services,
    clientId,
    analysis,
    results,
    scenarios,
    inventory,
    loading,
    dataLoading,
    error,
    selectClient,
    reloadData,
    reloadInventory,
  } = useCosts();

  const editable = canEdit();
  const isAdmin = getRole() === "admin";

  const [subs, setSubs] = useState<string[] | null>(null);
  const [q, setQ] = useState("");
  const [serviceKey, setServiceKey] = useState("");
  const [category, setCategory] = useState("");
  const [hideReserved, setHideReserved] = useState(false);
  const [tab, setTab] = useState("servicios");
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState<{ title: string; detail?: string }>({ title: "" });
  const [calcOpen, setCalcOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [finopsOpen, setFinopsOpen] = useState(false);
  const [manualRow, setManualRow] = useState<CostResult | null>(null);
  const [lookups, setLookups] = useState<FinOpsLookups | null>(null);

  // Al cambiar de cliente, los nombres de suscripción cambian: resetear el filtro.
  useEffect(() => {
    setSubs(null);
    setCategory("");
  }, [clientId]);

  // Catálogos FinOps (categorías/regiones/tipos): carga best-effort, una sola vez.
  useEffect(() => {
    getFinOpsLookups().then(setLookups).catch(() => {});
  }, []);

  const subRows = useMemo(() => applySubscriptionFilter(results, subs), [results, subs]);
  const kpis = useMemo(() => computeKpis(subRows, scenarios), [subRows, scenarios]);
  const categoryOptions = useMemo(
    () => [...new Set(subRows.map((r) => categoryOf(r.service_key, lookups)))].sort(),
    [subRows, lookups],
  );
  const tableRows = useMemo(() => {
    const base = filterResults(subRows, { q, serviceKey, hideReserved });
    if (!category) return base;
    return base.filter((r) => categoryOf(r.service_key, lookups) === category);
  }, [subRows, q, serviceKey, hideReserved, category, lookups]);
  // CostsDataTable filtra ademas por columna (embudo); refleja ese conteo real, no solo tableRows.length.
  const [visibleCount, setVisibleCount] = useState(tableRows.length);
  const subNames = useMemo(() => subscriptionNames(results), [results]);

  async function doCalculate(serviceKeys: string[], autoBuild: boolean) {
    if (!analysis) return;
    setBusyMsg({ title: "Calculando costos", detail: "Preparando…" });
    setBusy(true);
    try {
      await runCalculation(analysis.analysis_id, serviceKeys, { autoBuildScenarios: autoBuild }, (p) =>
        setBusyMsg({ title: "Calculando costos", detail: `${p.service} (${p.index + 1}/${p.total}), bloque ${p.batch}…` }),
      );
      setBusyMsg({ title: "Afinando resultados", detail: "Actualizando cobertura RI y encendido/apagado…" });
      await bestEffortRefresh(analysis.analysis_id);
      toast.success("Costos calculados correctamente.");
      setCalcOpen(false);
      reloadData();
    } catch (e) {
      toast.error(`Error calculando costos: ${msg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function doRecalcScenarios() {
    if (!analysis) return;
    setBusyMsg({ title: "Recalculando escenarios", detail: "Con los costos actuales…" });
    setBusy(true);
    try {
      await recalcScenarios(analysis.analysis_id);
      toast.success("Escenarios recalculados correctamente.");
      reloadData();
    } catch (e) {
      toast.error(`Error recalculando escenarios: ${msg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function doRefreshRi() {
    if (!analysis) return;
    setBusyMsg({ title: "Actualizando cobertura RI", detail: "Cruzando reservas activas contra los recursos…" });
    setBusy(true);
    try {
      const data = await refreshRiCoverage(analysis.analysis_id);
      const est = (data.estimated ?? []).reduce((s, g) => s + (g.estimated_units ?? 0), 0);
      const src = RI_SOURCE_LABELS[data.source ?? ""] ?? data.source ?? "";
      toast.success(
        `Cobertura RI: ${data.confirmed_count ?? 0} confirmados${est ? ` (+${est} estimados por SKU/región)` : ""}. Fuente: ${src}.`,
      );
      reloadData();
    } catch (e) {
      toast.error(`Error actualizando cobertura RI: ${msg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function doRefreshPower() {
    if (!analysis) return;
    setBusyMsg({ title: "Actualizando encendido/apagado", detail: "Leyendo el Activity Log del mes anterior…" });
    setBusy(true);
    try {
      const data = await refreshPowerHistory(analysis.analysis_id);
      const period = (data.period_start ?? "").slice(0, 7);
      const src = POWER_SOURCE_LABELS[data.source ?? ""] ?? data.source ?? "";
      toast.success(
        `Encendido/apagado: ${data.updated_count ?? 0} VM(s) actualizadas${period ? ` (periodo ${period})` : ""}. Fuente: ${src}.`,
      );
      reloadData();
    } catch (e) {
      toast.error(`Error actualizando encendido/apagado: ${msg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function doClearCache() {
    setBusyMsg({ title: "Limpiando caché de precios", detail: "Azure Retail Prices…" });
    setBusy(true);
    try {
      const r = await clearPriceCache();
      toast.success(`Caché de precios limpiado${r.removed_rows != null ? ` (${r.removed_rows} filas)` : ""}.`);
    } catch (e) {
      toast.error(`Error limpiando caché: ${msg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function doImport(replaceExisting: boolean) {
    if (!analysis) return;
    setBusyMsg({ title: "Importando inventario", detail: "Leyendo recursos del cliente en Azure…" });
    setBusy(true);
    try {
      await importInventory(analysis.analysis_id, {
        services: services.map((s) => s.service_key),
        replace_existing: replaceExisting,
      });
      toast.success("Inventario importado correctamente.");
      setImportOpen(false);
      reloadInventory();
    } catch (e) {
      toast.error(`Error importando inventario: ${msg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function doExcel() {
    if (!analysis) return;
    setBusyMsg({ title: "Generando Excel", detail: "Plantilla ejecutiva…" });
    setBusy(true);
    try {
      const r = await generateExcel(analysis.analysis_id);
      if (r.download_url) await downloadFromApi(r.download_url, r.file_name || "resultado-optimizacion-costos.xlsx");
      toast.success("Excel generado y descargado desde la plantilla oficial.");
    } catch (e) {
      toast.error(`Error generando Excel: ${msg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const clientSelect = <ClientCombobox clients={clients} value={clientId} onChange={selectClient} />;

  return (
    <AppShell
      title="Optimización de costos"
      subtitle="Costos PAYG y escenarios de ahorro por cliente, calculados con Azure Retail Prices."
      active="costos"
      onNavigate={onNavigate}
      headerRight={clientSelect}
    >
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          {error && <p className="text-destructive mb-4">{error}</p>}
          <p className="text-sm text-muted-foreground mb-4">
            {analysis
              ? `Evaluación actual: #${analysis.analysis_id} — ${analysis.analysis_name}`
              : "Este cliente aún no tiene una evaluación activa. Se crea desde administración."}
          </p>

          <div className="flex flex-wrap gap-2 mb-5">
            {editable && (
              <Button size="sm" disabled={busy || !analysis} onClick={() => setCalcOpen(true)}>
                <Calculator className="w-4 h-4 mr-1" />
                Calcular costos
              </Button>
            )}
            {editable && (
              <Button variant="outline" size="sm" disabled={busy || !analysis} onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4 mr-1" />
                Importar inventario
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={busy || !analysis} onClick={doExcel}>
              <Download className="w-4 h-4 mr-1" />
              Exportar Excel
            </Button>
            {editable && (
              <OptionsMenu
                disabled={busy || !analysis}
                isAdmin={isAdmin}
                onRecalcScenarios={doRecalcScenarios}
                onRefreshRi={doRefreshRi}
                onRefreshPower={doRefreshPower}
                onClearCache={doClearCache}
                onFinOpsRefresh={() => setFinopsOpen(true)}
              />
            )}
          </div>

          <CostsKpis kpis={kpis} />

          {subNames.length > 1 && (
            <div className="flex justify-end mb-3">
              <SubscriptionFilter names={subNames} selected={subs} onChange={setSubs} />
            </div>
          )}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="servicios">Servicios</TabsTrigger>
              <TabsTrigger value="resultados">Resultados</TabsTrigger>
              <TabsTrigger value="escenarios">Escenarios</TabsTrigger>
              <TabsTrigger value="inventario">Inventario</TabsTrigger>
              <TabsTrigger value="cobertura">Cobertura</TabsTrigger>
            </TabsList>

            <TabsContent value="servicios">
              {dataLoading ? <Skeleton className="h-40 w-full mt-4" /> : <ServicesSummary rows={subRows} />}
            </TabsContent>

            <TabsContent value="resultados">
              <div className="flex gap-2 flex-wrap items-center mb-4">
                <SearchInput
                  className="flex-1 min-w-[200px] max-w-sm"
                  placeholder="Buscar recurso, grupo, región…"
                  value={q}
                  onChange={setQ}
                />
                <Select value={serviceKey || "__all"} onValueChange={(v) => setServiceKey(v === "__all" ? "" : v)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Todos los servicios</SelectItem>
                    {services.map((s) => (
                      <SelectItem key={s.service_key} value={s.service_key}>
                        {serviceName(s.service_key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={category || "__all"} onValueChange={(v) => setCategory(v === "__all" ? "" : v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Todas las categorías</SelectItem>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={hideReserved} onChange={(e) => setHideReserved(e.target.checked)} />
                  Ocultar reservados
                </label>
                <span className="text-sm text-muted-foreground ml-auto">
                  {visibleCount} de {subRows.length}
                </span>
              </div>
              {dataLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <CostsDataTable
                  rows={tableRows}
                  canEdit={editable}
                  onEditManual={setManualRow}
                  onVisibleCountChange={setVisibleCount}
                  lookups={lookups}
                />
              )}
            </TabsContent>

            <TabsContent value="escenarios">
              {dataLoading ? <Skeleton className="h-40 w-full mt-4" /> : <ScenarioCards scenarios={scenarios} />}
            </TabsContent>

            <TabsContent value="inventario">
              {dataLoading ? <Skeleton className="h-40 w-full mt-4" /> : <InventorySummary rows={inventory} />}
            </TabsContent>

            <TabsContent value="cobertura">
              {analysis ? <CoverageTab analysisId={analysis.analysis_id} /> : null}
            </TabsContent>
          </Tabs>
        </>
      )}

      <CalculateDialog
        open={calcOpen}
        services={services}
        busy={busy}
        onOpenChange={setCalcOpen}
        onConfirm={doCalculate}
      />
      <ImportDialog
        open={importOpen}
        services={services}
        busy={busy}
        onOpenChange={setImportOpen}
        onConfirm={doImport}
      />
      <ManualCostDialog
        row={manualRow}
        open={manualRow !== null}
        onOpenChange={(o) => !o && setManualRow(null)}
        onSaved={reloadData}
      />
      <FinOpsRefreshDialog
        open={finopsOpen}
        onOpenChange={setFinopsOpen}
        onDone={() => {}}
      />

      <BusyOverlay
        show={busy || dataLoading}
        title={busy ? busyMsg.title : "Cargando datos del cliente"}
        detail={busy ? busyMsg.detail : "Resultados, escenarios e inventario…"}
      />
    </AppShell>
  );
}
