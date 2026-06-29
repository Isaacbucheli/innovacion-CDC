import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import WafClientHeader from "@/components/waf/WafClientHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listClientsAdmin, getWafCostReference } from "@/lib/api";
import { formatMoney } from "@/lib/costs";
import { impactMeta } from "@/lib/waf";
import type { ClientAdmin, WafCostReference } from "@/types";

const KEY = "innovacion_cdc_waf_client";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums tracking-tight mt-1">{value}</div>
    </div>
  );
}

export default function CostReferencePage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const [clients, setClients] = useState<ClientAdmin[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [data, setData] = useState<WafCostReference | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listClientsAdmin().then((cs) => {
      setClients(cs);
      const stored = Number(localStorage.getItem(KEY));
      setClientId(cs.some((c) => c.client_id === stored) ? stored : cs[0]?.client_id ?? null);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (clientId == null) return;
    setLoading(true);
    getWafCostReference(clientId).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [clientId]);

  function selectClient(id: number) { localStorage.setItem(KEY, String(id)); setClientId(id); }

  const t = data?.totals;
  return (
    <AppShell title="Costo referencial Azure" subtitle="Matriz mejoras Azure · estimación con tarifas públicas"
      active="waf-cost" onNavigate={onNavigate}
      headerRight={<WafClientHeader clients={clients} clientId={clientId} onSelect={selectClient} />}>
      <BusyOverlay show={loading} title="Cargando costo referencial" />
      {data && !data.has_cost_data ? (
        <p className="text-sm text-muted-foreground">{data.message ?? "Este cliente aún no tiene costos calculados."}</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="PAYG / mes" value={formatMoney(t?.payg_monthly ?? 0)} />
            <Kpi label="Reserva 1 año / mes" value={formatMoney(t?.ri_1y_monthly ?? 0)} />
            <Kpi label="Reserva 3 años / mes" value={formatMoney(t?.ri_3y_monthly ?? 0)} />
            <Kpi label="Cobertura recursos" value={`${t?.resources_priced ?? 0}/${t?.resources_total ?? 0}`} />
          </div>
          {data?.disclaimer && <p className="text-xs text-muted-foreground border-l-2 border-border pl-3">{data.disclaimer}</p>}
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Código</TableHead><TableHead>Ámbito</TableHead><TableHead>Impacto</TableHead>
                <TableHead>Recursos</TableHead><TableHead className="text-right">PAYG/mes</TableHead>
                <TableHead className="text-right">RI 1a/mes</TableHead><TableHead className="text-right">RI 3a/mes</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(data?.items ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin recomendaciones de costo.</TableCell></TableRow>
                ) : data!.items.map((it) => {
                  const m = impactMeta(it.business_impact);
                  return (
                    <TableRow key={it.canonical_id}>
                      <TableCell className="font-medium">{it.matrix_code}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{it.review_scope_es ?? "—"}</TableCell>
                      <TableCell><span className={`text-xs px-2.5 py-0.5 rounded-full ${m.chip}`}>{m.label}</span></TableCell>
                      <TableCell className="tabular-nums">{it.resources_priced}/{it.resources_total}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(it.payg_monthly)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(it.ri_1y_monthly)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(it.ri_3y_monthly)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
