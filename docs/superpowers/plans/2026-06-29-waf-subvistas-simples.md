# WAF sub-vistas simples (Costo referencial + Historial de ingestas) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Implementar dos sub-vistas read-only de WAF: Costo referencial Azure y Historial de ingestas, y activarlas en el menú.

**Architecture:** Igual al resto del piloto: funciones de API en `lib/api.ts`, una `*Page` por vista con selector de cliente (reusa `ClientCombobox`/`WafClientHeader`), KPIs/tablas con tokens, `BusyOverlay` en carga; ruteo en `App.tsx` + ítems del menú en `AppShell`.

**Tech Stack:** React, TS, shadcn (Table), sonner, Vitest + Testing Library.

## Contrato backend .NET (verificado, snake_case; rol: cualquier autenticado)
- `GET /waf/clients/{id}/cost-reference` → `{ client_id, has_cost_data, disclaimer, message?, analysis_id?, analysis_name?, totals: { payg_monthly, ri_1y_monthly, ri_3y_monthly, resources_total, resources_matched, resources_priced }, items: [{ canonical_id, matrix_code, review_scope_es, business_impact, resources_total, resources_matched, resources_priced, payg_monthly, ri_1y_monthly, ri_3y_monthly }] }`.
- `GET /waf/clients/{id}/ingestion-runs` → `[{ run_id, source_file_name, status, rows_total, rows_processed, new_recommendations, new_findings, resolved_findings, started_at, completed_at, created_by, error_message }]`.

## Global Constraints
- Front solo al .NET vía `request<T>`. Tokens / `dark:` (claro y oscuro). Español. YAGNI.
- Reusar `WafClientHeader` (logo + ClientCombobox) y `listClientsAdmin` para el selector. Dinero con `formatMoney` de `@/lib/costs`. Estados de ingesta con badge de color por `status`.
- Ambas vistas son read-only (sin escrituras). Lectura para todos los roles.
- Tras cada tarea: lint + build verdes; commits frecuentes.

---

### Task 1: Tipos + API (cost-reference + ingestion-runs)

**Files:** Modify `src/types.ts`, `src/lib/api.ts`; Test `src/lib/api.test.ts`.

**Produces:** tipos `WafCostReference`, `WafCostItem`, `WafIngestionRun`; funciones `getWafCostReference(clientId)`, `getWafIngestionRuns(clientId)`.

- [ ] **Step 1: Tipos en `src/types.ts` (al final)**

```ts
export interface WafCostItem {
  canonical_id: number;
  matrix_code: string | null;
  review_scope_es: string | null;
  business_impact: string | null;
  resources_total: number;
  resources_matched: number;
  resources_priced: number;
  payg_monthly: number;
  ri_1y_monthly: number;
  ri_3y_monthly: number;
}
export interface WafCostReference {
  client_id: number;
  has_cost_data: boolean;
  disclaimer: string;
  message?: string | null;
  analysis_id?: number | null;
  analysis_name?: string | null;
  totals: {
    payg_monthly: number; ri_1y_monthly: number; ri_3y_monthly: number;
    resources_total: number; resources_matched: number; resources_priced: number;
  };
  items: WafCostItem[];
}
export interface WafIngestionRun {
  run_id: number;
  source_file_name: string | null;
  status: string | null;
  rows_total: number | null;
  rows_processed: number | null;
  new_recommendations: number | null;
  new_findings: number | null;
  resolved_findings: number | null;
  started_at: string;
  completed_at: string | null;
  created_by: string | null;
  error_message: string | null;
}
```

- [ ] **Step 2: API en `src/lib/api.ts`** (merge `WafCostReference`, `WafIngestionRun` en el `import type` del tope; agregar tras las lecturas WAF existentes)

```ts
export const getWafCostReference = (clientId: number) =>
  request<WafCostReference>(`/waf/clients/${clientId}/cost-reference`);
export const getWafIngestionRuns = (clientId: number) =>
  request<WafIngestionRun[]>(`/waf/clients/${clientId}/ingestion-runs`);
```

- [ ] **Step 3: Test en `src/lib/api.test.ts`** (bloque WAF)

```ts
it("getWafCostReference arma la URL", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  const { getWafCostReference } = await import("@/lib/api");
  await getWafCostReference(3);
  const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
  expect(calls[0][0]).toContain("/waf/clients/3/cost-reference");
});
it("getWafIngestionRuns arma la URL", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
  const { getWafIngestionRuns } = await import("@/lib/api");
  await getWafIngestionRuns(3);
  const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
  expect(calls[0][0]).toContain("/waf/clients/3/ingestion-runs");
});
```

- [ ] **Step 4: Correr** `npx vitest run src/lib/api.test.ts` → PASS; `npx tsc -b` limpio.
- [ ] **Step 5: Commit** `git commit -m "feat(waf): API costo referencial + historial de ingestas"`

---

### Task 2: `CostReferencePage` + ruteo + menú

**Files:** Create `src/components/waf/CostReferencePage.tsx`; Modify `src/App.tsx`, `src/components/AppShell.tsx`; Test `src/components/waf/CostReferencePage.test.tsx`.

**Produces:** `CostReferencePage({ onNavigate })`. Vista: selector de cliente (`WafClientHeader`) en headerRight + 4 KPIs (PAYG/mes, Reserva 1 año, Reserva 3 años, Cobertura recursos) + disclaimer + tabla de ítems (código, ámbito, impacto, recursos priced/matched/total, PAYG, RI 1a, RI 3a). Carga clientes con `listClientsAdmin`, datos con `getWafCostReference`.

- [ ] **Step 1: Test `src/components/waf/CostReferencePage.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { expect, test, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  listClientsAdmin: vi.fn(async () => [{ client_id: 3, client_name: "BANISI", has_logo: false }]),
  getWafCostReference: vi.fn(async () => ({
    client_id: 3, has_cost_data: true, disclaimer: "Valor referencial…", analysis_id: 7, analysis_name: "Eval",
    totals: { payg_monthly: 5991, ri_1y_monthly: 4200, ri_3y_monthly: 3100, resources_total: 50, resources_matched: 40, resources_priced: 35 },
    items: [{ canonical_id: 9, matrix_code: "5.1", review_scope_es: "Reserved Instances", business_impact: "High", resources_total: 31, resources_matched: 28, resources_priced: 25, payg_monthly: 3000, ri_1y_monthly: 2100, ri_3y_monthly: 1500 }],
  })),
  fetchClientLogoObjectUrl: vi.fn(async () => null),
}));

test("muestra KPIs y la tabla de costo referencial", async () => {
  const { default: CostReferencePage } = await import("@/components/waf/CostReferencePage");
  render(<ThemeProvider attribute="class" defaultTheme="light"><CostReferencePage /></ThemeProvider>);
  await waitFor(() => expect(screen.getByText("Reserved Instances")).toBeInTheDocument());
  expect(screen.getByText(/PAYG/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Correr (RED)** `npx vitest run src/components/waf/CostReferencePage.test.tsx`

- [ ] **Step 3: Implementar `src/components/waf/CostReferencePage.tsx`**

```tsx
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
```

- [ ] **Step 4: Ruteo + menú**
  - `src/App.tsx`: `import CostReferencePage from "@/components/waf/CostReferencePage";` y rama `) : section === "waf-cost" ? (<CostReferencePage onNavigate={setSection} />`.
  - `src/components/AppShell.tsx`: en MENU, cambiar `{ label: "Costo referencial Azure", soon: true }` → `{ label: "Costo referencial Azure", section: "waf-cost" }`.

- [ ] **Step 5: Correr (GREEN)** `npx vitest run src/components/waf/CostReferencePage.test.tsx`; `npx tsc -b` + `npm run lint` limpios.
- [ ] **Step 6: Commit** `git commit -m "feat(waf): vista Costo referencial Azure"`

---

### Task 3: `IngestionsPage` + ruteo + menú

**Files:** Create `src/components/waf/IngestionsPage.tsx`; Modify `src/App.tsx`, `src/components/AppShell.tsx`; Test `src/components/waf/IngestionsPage.test.tsx`.

**Produces:** `IngestionsPage({ onNavigate })`. Vista: selector de cliente + tabla de corridas (archivo, estado con badge, filas total/procesadas, nuevas recs/findings, resueltos, inicio, fin, usuario). `getWafIngestionRuns`.

- [ ] **Step 1: Test `src/components/waf/IngestionsPage.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { expect, test, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  listClientsAdmin: vi.fn(async () => [{ client_id: 3, client_name: "BANISI", has_logo: false }]),
  getWafIngestionRuns: vi.fn(async () => [{ run_id: 1, source_file_name: "Advisor_Export.csv", status: "completed", rows_total: 100, rows_processed: 100, new_recommendations: 5, new_findings: 20, resolved_findings: 2, started_at: "2026-06-25T10:00:00Z", completed_at: "2026-06-25T10:02:00Z", created_by: "isaac", error_message: null }]),
  fetchClientLogoObjectUrl: vi.fn(async () => null),
}));

test("muestra la tabla de ingestas", async () => {
  const { default: IngestionsPage } = await import("@/components/waf/IngestionsPage");
  render(<ThemeProvider attribute="class" defaultTheme="light"><IngestionsPage /></ThemeProvider>);
  await waitFor(() => expect(screen.getByText("Advisor_Export.csv")).toBeInTheDocument());
  expect(screen.getByText(/completed/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Correr (RED)**

- [ ] **Step 3: Implementar `src/components/waf/IngestionsPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import WafClientHeader from "@/components/waf/WafClientHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listClientsAdmin, getWafIngestionRuns } from "@/lib/api";
import type { ClientAdmin, WafIngestionRun } from "@/types";

const KEY = "innovacion_cdc_waf_client";

function statusChip(status: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s.includes("complet") && !s.includes("error")) return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200";
  if (s.includes("run")) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  if (s.includes("fail") || s.includes("error")) return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
}
function fmtDate(d: string | null): string { return d ? new Date(d).toLocaleString("es-EC") : "—"; }

export default function IngestionsPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const [clients, setClients] = useState<ClientAdmin[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [runs, setRuns] = useState<WafIngestionRun[]>([]);
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
    getWafIngestionRuns(clientId).then(setRuns).catch(() => setRuns([])).finally(() => setLoading(false));
  }, [clientId]);

  function selectClient(id: number) { localStorage.setItem(KEY, String(id)); setClientId(id); }

  return (
    <AppShell title="Historial de ingestas" subtitle="Matriz mejoras Azure · cargas de Advisor/Excel"
      active="waf-ingestions" onNavigate={onNavigate}
      headerRight={<WafClientHeader clients={clients} clientId={clientId} onSelect={selectClient} />}>
      <BusyOverlay show={loading} title="Cargando historial" />
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Archivo</TableHead><TableHead>Estado</TableHead><TableHead>Filas</TableHead>
            <TableHead>Nuevas / Hallazgos</TableHead><TableHead>Resueltos</TableHead>
            <TableHead>Inicio</TableHead><TableHead>Fin</TableHead><TableHead>Usuario</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {runs.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin ingestas registradas.</TableCell></TableRow>
            ) : runs.map((r) => (
              <TableRow key={r.run_id}>
                <TableCell className="max-w-[220px] truncate">{r.source_file_name ?? "—"}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full ${statusChip(r.status)}`}>{r.status ?? "—"}</span>
                  {r.error_message && <div className="text-[11px] text-destructive mt-1 max-w-[220px] truncate">{r.error_message}</div>}
                </TableCell>
                <TableCell className="tabular-nums">{r.rows_processed ?? 0}/{r.rows_total ?? 0}</TableCell>
                <TableCell className="tabular-nums">{r.new_recommendations ?? 0} / {r.new_findings ?? 0}</TableCell>
                <TableCell className="tabular-nums">{r.resolved_findings ?? 0}</TableCell>
                <TableCell className="text-xs">{fmtDate(r.started_at)}</TableCell>
                <TableCell className="text-xs">{fmtDate(r.completed_at)}</TableCell>
                <TableCell className="text-xs">{r.created_by ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 4: Ruteo + menú**
  - `src/App.tsx`: `import IngestionsPage from "@/components/waf/IngestionsPage";` y rama `) : section === "waf-ingestions" ? (<IngestionsPage onNavigate={setSection} />`.
  - `src/components/AppShell.tsx`: cambiar `{ label: "Historial de ingestas", soon: true }` → `{ label: "Historial de ingestas", section: "waf-ingestions" }`.

- [ ] **Step 5: Correr (GREEN) + gate completo** `npx vitest run && npx tsc -b && npm run build && npm run lint`.
- [ ] **Step 6: Commit** `git commit -m "feat(waf): vista Historial de ingestas"`

---

## Self-Review (hecho)
- Cobertura: ambas vistas read-only con selector de cliente, KPIs/tabla, disclaimer (cost-ref), badges de estado (ingestas), ruteo + menú activado. Validación inteligente queda para la ola 2.
- Sin placeholders; código completo. Tipos `WafCostReference`/`WafIngestionRun` y firmas `getWafCostReference`/`getWafIngestionRuns` consistentes entre Tasks 1–3. Secciones `waf-cost`/`waf-ingestions` añadidas en App.tsx y AppShell.
