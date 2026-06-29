# WAF Recomendaciones (núcleo, slice 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la sub-vista "Recomendaciones" del módulo WAF en el front nuevo (React), en modo read + seguimiento, contra el backend .NET ya migrado.

**Architecture:** Espeja el módulo de costos del piloto: tipos + funciones de API en `lib/api.ts`, lógica pura en `lib/waf.ts`, estado en `hooks/useWaf.ts`, y componentes en `components/waf/`. Una `WafPage` orquesta selector de cliente + logo + KPIs + tarjetas de pilar (clicables) + tabla TanStack + un `Dialog` de detalle con 5 secciones.

**Tech Stack:** Vite, React, TypeScript, Tailwind + shadcn/ui, @tanstack/react-table, cmdk, react-hook-form + zod, sonner, Vitest + Testing Library, next-themes (tema claro/oscuro ya integrado).

## Global Constraints

- El front nuevo habla **SOLO** con el backend .NET vía `apiBase()` (DEV: proxy `/api`). NUNCA al FastAPI/.NET de prod. (`STACK-NUEVO.md`)
- Todo el color via **tokens semánticos** (`bg-card`, `text-muted-foreground`, `bg-primary`, etc.) o variantes `dark:`; debe verse bien en claro y oscuro. Verde de marca `#A3C243` solo como acento.
- Paginación con `DataTablePagination` (10/pág, opciones 10/20/50/100); tablas paginadas **sin** scroll interno.
- Idioma de UI: español latino neutro.
- Gating: lecturas para todos los roles; escrituras (seguimiento, comentarios) solo `canEdit()` (admin/consultor).
- Antes de tocar UI: confirmar contra el Swagger del .NET (`apiBase()/swagger` o `/openapi`) las rutas/forma de respuesta WAF; ajustar tipos si difieren. No deployar sin OK del usuario.
- Tras cada tarea: `npm run lint` y `npm run build` deben quedar verdes; commits frecuentes.

---

### Task 1: Tipos + funciones de API WAF

**Files:**
- Modify: `src/types.ts` (agregar tipos WAF al final)
- Modify: `src/lib/api.ts` (agregar bloque "WAF")
- Test: `src/lib/api.test.ts` (agregar casos WAF)

**Interfaces:**
- Produces:
  - Tipos: `WafSummary`, `WafSection`, `WafRecommendation`, `WafRecommendationDetail`, `WafResource`, `WafComment`, `WafHistoryEntry`, `WafTrackingUpdate`.
  - Funciones: `getWafSummary(clientId)`, `getWafSections(clientId)`, `getWafRecommendations(clientId, pillar?)`, `getWafRecommendation(clientId, canonicalId)`, `getWafResources(clientId, canonicalId)`, `getWafComments(clientId, canonicalId)`, `getWafHistory(clientId, canonicalId)`, `updateWafTracking(clientId, canonicalId, body)`, `addWafComment(clientId, canonicalId, text)`.

- [ ] **Step 1: Agregar tipos WAF a `src/types.ts`**

```ts
// ---- WAF (Matriz mejoras Azure) ----
export interface WafSummary {
  client_id: number;
  recommendations: number;
  active_recommendations: number;
  cost_recommendations: number;
  active_findings: number;
  latest_ingestion: { source_file_name?: string | null; completed_at?: string | null; status?: string | null } | null;
}

export interface WafSection {
  section_num: number;
  section_name: string;
  total_recs: number;
  total_resources: number;
  avg_progress: number;
  high_recs: number;
  medium_recs: number;
}

export interface WafRecommendation {
  canonical_id: number;
  matrix_code: string;
  pillar_number: number;
  review_scope_es: string | null;
  business_impact: string | null;
  resource_count: number;
  completion_pct: number;
}

export interface WafRecommendationDetail extends WafRecommendation {
  benefit_es: string | null;
  client_action_es: string | null;
  bit_action_es: string | null;
  remediation_start_date: string | null;
  projected_bit_effort: string | null;
  execution_log: string | null;
  priority_override: number | null;
  internal_notes: string | null;
}

export interface WafResource {
  finding_id: number;
  resource_name: string;
  resource_type: string | null;
  resource_group: string | null;
  subscription_name: string | null;
  status: string;
}

export interface WafComment {
  comment_id: number;
  user_display: string;
  comment_text: string;
  created_at: string;
}

export interface WafHistoryEntry {
  history_id: number;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface WafTrackingUpdate {
  completion_pct: number;
  remediation_start_date: string | null;
  projected_bit_effort: string | null;
  execution_log: string | null;
  priority_override: number | null;
  internal_notes: string | null;
}
```

- [ ] **Step 2: Agregar funciones de API en `src/lib/api.ts`** (después del bloque de costos, antes de `downloadFromApi`)

```ts
// ---- WAF (Matriz mejoras Azure): lecturas ----
import type {
  WafSummary, WafSection, WafRecommendation, WafRecommendationDetail,
  WafResource, WafComment, WafHistoryEntry, WafTrackingUpdate,
} from "@/types";

export const getWafSummary = (clientId: number) =>
  request<WafSummary>(`/waf/clients/${clientId}/summary`);
export const getWafSections = (clientId: number) =>
  request<WafSection[]>(`/waf/clients/${clientId}/sections`);
export const getWafRecommendations = (clientId: number, pillar?: number) =>
  request<WafRecommendation[]>(
    `/waf/clients/${clientId}/recommendations${pillar ? `?pillar=${pillar}` : ""}`,
  );
export const getWafRecommendation = (clientId: number, canonicalId: number) =>
  request<WafRecommendationDetail>(`/waf/clients/${clientId}/recommendations/${canonicalId}`);
export const getWafResources = (clientId: number, canonicalId: number) =>
  request<WafResource[]>(`/waf/clients/${clientId}/recommendations/${canonicalId}/resources`);
export const getWafComments = (clientId: number, canonicalId: number) =>
  request<WafComment[]>(`/waf/clients/${clientId}/recommendations/${canonicalId}/comments`);
export const getWafHistory = (clientId: number, canonicalId: number) =>
  request<WafHistoryEntry[]>(`/waf/clients/${clientId}/recommendations/${canonicalId}/history`);

// ---- WAF: escrituras ----
export const updateWafTracking = (clientId: number, canonicalId: number, body: WafTrackingUpdate) =>
  request<{ message: string }>(
    `/waf/clients/${clientId}/recommendations/${canonicalId}/tracking`, jsonOpts("PUT", body),
  );
export const addWafComment = (clientId: number, canonicalId: number, comment_text: string) =>
  request<{ comment_id: number }>(
    `/waf/clients/${clientId}/recommendations/${canonicalId}/comments`, jsonOpts("POST", { comment_text }),
  );
```

> Nota: mover los `import type` al bloque de imports existente del archivo si el linter se queja de import en medio del módulo (oxlint lo permite, pero por estilo agruparlos arriba con los demás `import type`).

- [ ] **Step 3: Escribir test de construcción de URL en `src/lib/api.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

describe("WAF api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
  });
  it("getWafRecommendations agrega el filtro de pilar", async () => {
    const { getWafRecommendations } = await import("@/lib/api");
    await getWafRecommendations(3, 5);
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("/waf/clients/3/recommendations?pillar=5");
  });
  it("getWafRecommendations sin pilar no agrega query", async () => {
    const { getWafRecommendations } = await import("@/lib/api");
    await getWafRecommendations(3);
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("/waf/clients/3/recommendations");
    expect(url).not.toContain("?pillar");
  });
});
```

- [ ] **Step 4: Correr tests**

Run: `npx vitest run src/lib/api.test.ts`
Expected: PASS (los nuevos casos WAF verdes; los existentes siguen verdes).

- [ ] **Step 5: Verificar tipos y commitear**

```bash
npx tsc -b
git add src/types.ts src/lib/api.ts src/lib/api.test.ts
git commit -m "feat(waf): tipos y funciones de API de Recomendaciones"
```

---

### Task 2: Lógica pura `lib/waf.ts`

**Files:**
- Create: `src/lib/waf.ts`
- Test: `src/lib/waf.test.ts`

**Interfaces:**
- Consumes: `WafRecommendation`, `WafTrackingUpdate` (Task 1).
- Produces:
  - `PILLAR_COLOR: Record<number, string>` (color por número de pilar 1–5).
  - `pillarColor(n: number): string`
  - `IMPACT_META: Record<string, { label: string; chip: string }>` y `impactMeta(impact: string | null)`.
  - `filterRecommendations(recs, { pillar, minPct, maxPct })`
  - `validateTracking(form): Record<string, string>` (errores por campo; vacío = válido)

- [ ] **Step 1: Escribir tests en `src/lib/waf.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { filterRecommendations, validateTracking, impactMeta, pillarColor } from "@/lib/waf";
import type { WafRecommendation } from "@/types";

const rec = (over: Partial<WafRecommendation>): WafRecommendation => ({
  canonical_id: 1, matrix_code: "1.1", pillar_number: 1, review_scope_es: "x",
  business_impact: "High", resource_count: 0, completion_pct: 0, ...over,
});

describe("filterRecommendations", () => {
  const recs = [rec({ canonical_id: 1, pillar_number: 1, completion_pct: 10 }),
                rec({ canonical_id: 2, pillar_number: 5, completion_pct: 80 })];
  it("filtra por pilar", () => {
    expect(filterRecommendations(recs, { pillar: 5 }).map((r) => r.canonical_id)).toEqual([2]);
  });
  it("sin pilar devuelve todo", () => {
    expect(filterRecommendations(recs, {})).toHaveLength(2);
  });
  it("filtra por rango de avance", () => {
    expect(filterRecommendations(recs, { minPct: 50, maxPct: 100 }).map((r) => r.canonical_id)).toEqual([2]);
  });
});

describe("validateTracking", () => {
  it("acepta avance válido", () => {
    expect(validateTracking({ completion_pct: 50, remediation_start_date: "2026-06-15" })).toEqual({});
  });
  it("rechaza avance fuera de 0–100", () => {
    expect(validateTracking({ completion_pct: 120 })).toHaveProperty("completion_pct");
  });
  it("rechaza fecha inválida", () => {
    expect(validateTracking({ completion_pct: 10, remediation_start_date: "no-fecha" })).toHaveProperty("remediation_start_date");
  });
});

describe("meta", () => {
  it("impactMeta mapea High", () => { expect(impactMeta("High").label).toBe("Alta"); });
  it("pillarColor devuelve un color por número", () => { expect(pillarColor(5)).toMatch(/^#/); });
});
```

- [ ] **Step 2: Correr para ver fallar**

Run: `npx vitest run src/lib/waf.test.ts`
Expected: FAIL ("Cannot find module '@/lib/waf'").

- [ ] **Step 3: Implementar `src/lib/waf.ts`**

```ts
import type { WafRecommendation } from "@/types";

// Color por número de pilar (1–5). Mid-ramp: legible en claro y oscuro.
// Los NOMBRES de pilar vienen del backend (section_name), no se hardcodean aquí.
export const PILLAR_COLOR: Record<number, string> = {
  1: "#185fa5", 2: "#1d9e75", 3: "#7f77dd", 4: "#ba7517", 5: "#639922",
};
export function pillarColor(n: number): string {
  return PILLAR_COLOR[n] ?? "#888780";
}

export const IMPACT_META: Record<string, { label: string; chip: string }> = {
  high: { label: "Alta", chip: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
  medium: { label: "Media", chip: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  low: { label: "Baja", chip: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" },
};
export function impactMeta(impact: string | null): { label: string; chip: string } {
  const k = (impact ?? "").toLowerCase();
  return IMPACT_META[k] ?? { label: impact ?? "—", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
}

export function filterRecommendations(
  recs: WafRecommendation[],
  opts: { pillar?: number | null; minPct?: number; maxPct?: number },
): WafRecommendation[] {
  const { pillar, minPct = 0, maxPct = 100 } = opts;
  return recs.filter((r) =>
    (pillar == null || r.pillar_number === pillar) &&
    r.completion_pct >= minPct && r.completion_pct <= maxPct);
}

export function validateTracking(form: {
  completion_pct?: number; remediation_start_date?: string | null;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const pct = form.completion_pct;
  if (pct != null && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
    errors.completion_pct = "El avance debe estar entre 0 y 100.";
  }
  const d = form.remediation_start_date;
  if (d && Number.isNaN(Date.parse(d))) {
    errors.remediation_start_date = "Fecha inválida.";
  }
  return errors;
}
```

- [ ] **Step 4: Correr tests**

Run: `npx vitest run src/lib/waf.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/waf.ts src/lib/waf.test.ts
git commit -m "feat(waf): lógica pura (filtros, validación, meta de pilar/impacto)"
```

---

### Task 3: Hook `useWaf`

**Files:**
- Create: `src/hooks/useWaf.ts`
- Test: `src/hooks/useWaf.test.ts`

**Interfaces:**
- Consumes: `listClientsAdmin`, `getWafSummary`, `getWafSections`, `getWafRecommendations` (Task 1); tipos WAF.
- Produces: `useWaf(): { clients: ClientAdmin[]; clientId: number | null; summary: WafSummary | null; sections: WafSection[]; recommendations: WafRecommendation[]; pillarNames: Record<number,string>; loading: boolean; dataLoading: boolean; error: string; selectClient(id): void; reloadData(): void }`.

- [ ] **Step 1: Escribir test en `src/hooks/useWaf.test.ts`**

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  listClientsAdmin: vi.fn(async () => [{ client_id: 3, client_name: "BANISI", has_logo: true }]),
  getWafSummary: vi.fn(async () => ({ client_id: 3, recommendations: 1, active_recommendations: 1, cost_recommendations: 0, active_findings: 2, latest_ingestion: null })),
  getWafSections: vi.fn(async () => [{ section_num: 5, section_name: "Costos", total_recs: 1, total_resources: 2, avg_progress: 10, high_recs: 1, medium_recs: 0 }]),
  getWafRecommendations: vi.fn(async () => [{ canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "x", business_impact: "High", resource_count: 2, completion_pct: 10 }]),
}));

describe("useWaf", () => {
  beforeEach(() => { localStorage.clear(); });
  it("carga cliente, secciones y recomendaciones; arma pillarNames", async () => {
    const { useWaf } = await import("@/hooks/useWaf");
    const { result } = renderHook(() => useWaf());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.recommendations).toHaveLength(1));
    expect(result.current.clientId).toBe(3);
    expect(result.current.pillarNames[5]).toBe("Costos");
  });
});
```

- [ ] **Step 2: Correr para ver fallar**

Run: `npx vitest run src/hooks/useWaf.test.ts`
Expected: FAIL ("Cannot find module '@/hooks/useWaf'").

- [ ] **Step 3: Implementar `src/hooks/useWaf.ts`** (espeja `useCosts`)

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getWafRecommendations, getWafSections, getWafSummary, listClientsAdmin } from "@/lib/api";
import type { ClientAdmin, WafRecommendation, WafSection, WafSummary } from "@/types";

const SELECTED_CLIENT_KEY = "innovacion_cdc_waf_client";

function readSelectedClient(): number | null {
  const raw = localStorage.getItem(SELECTED_CLIENT_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function useWaf() {
  const [clients, setClients] = useState<ClientAdmin[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [summary, setSummary] = useState<WafSummary | null>(null);
  const [sections, setSections] = useState<WafSection[]>([]);
  const [recommendations, setRecommendations] = useState<WafRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    (async () => {
      setLoading(true); setError("");
      try {
        const cs = await listClientsAdmin();
        if (!mountedRef.current) return;
        setClients(cs);
        const stored = readSelectedClient();
        const initial = stored && cs.some((c) => c.client_id === stored) ? stored : cs[0]?.client_id ?? null;
        setClientId(initial);
      } catch (e) {
        if (mountedRef.current) setError(e instanceof Error ? e.message : "Error al cargar clientes");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, []);

  const loadFor = useCallback(async (cid: number) => {
    setDataLoading(true); setError("");
    try {
      const [sum, secs, recs] = await Promise.all([
        getWafSummary(cid), getWafSections(cid), getWafRecommendations(cid),
      ]);
      if (!mountedRef.current) return;
      setSummary(sum); setSections(secs); setRecommendations(recs);
    } catch (e) {
      if (!mountedRef.current) return;
      setSummary(null); setSections([]); setRecommendations([]);
      setError(e instanceof Error ? e.message : "Error al cargar WAF");
    } finally {
      if (mountedRef.current) setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clientId == null) { setSummary(null); setSections([]); setRecommendations([]); return; }
    loadFor(clientId);
  }, [clientId, loadFor]);

  const pillarNames = useMemo(() => {
    const m: Record<number, string> = {};
    for (const s of sections) m[s.section_num] = s.section_name;
    return m;
  }, [sections]);

  const selectClient = useCallback((id: number) => {
    localStorage.setItem(SELECTED_CLIENT_KEY, String(id));
    setClientId(id);
  }, []);

  const reloadData = useCallback(() => { if (clientId != null) loadFor(clientId); }, [clientId, loadFor]);

  return { clients, clientId, summary, sections, recommendations, pillarNames, loading, dataLoading, error, selectClient, reloadData };
}
```

- [ ] **Step 4: Correr tests**

Run: `npx vitest run src/hooks/useWaf.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useWaf.ts src/hooks/useWaf.test.ts
git commit -m "feat(waf): hook useWaf (clientes + summary/sections/recommendations)"
```

---

### Task 4: `WafKpis` y `PillarCards`

**Files:**
- Create: `src/components/waf/WafKpis.tsx`
- Create: `src/components/waf/PillarCards.tsx`
- Test: `src/components/waf/PillarCards.test.tsx`

**Interfaces:**
- Consumes: `WafSummary`, `WafSection` (Task 1); `pillarColor` (Task 2).
- Produces:
  - `WafKpis({ summary }: { summary: WafSummary | null })`
  - `PillarCards({ sections, activePillar, onPick }: { sections: WafSection[]; activePillar: number | null; onPick: (pillar: number | null) => void })`

- [ ] **Step 1: Escribir test en `src/components/waf/PillarCards.test.tsx`**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import PillarCards from "@/components/waf/PillarCards";
import type { WafSection } from "@/types";

const sections: WafSection[] = [
  { section_num: 2, section_name: "Seguridad", total_recs: 12, total_resources: 40, avg_progress: 35, high_recs: 5, medium_recs: 3 },
  { section_num: 5, section_name: "Costos", total_recs: 6, total_resources: 31, avg_progress: 40, high_recs: 3, medium_recs: 1 },
];

test("muestra una tarjeta por sección y dispara onPick al hacer clic", () => {
  const onPick = vi.fn();
  render(<PillarCards sections={sections} activePillar={null} onPick={onPick} />);
  expect(screen.getByText("Seguridad")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Costos"));
  expect(onPick).toHaveBeenCalledWith(5);
});

test("clic en la tarjeta activa la deselecciona (onPick null)", () => {
  const onPick = vi.fn();
  render(<PillarCards sections={sections} activePillar={5} onPick={onPick} />);
  fireEvent.click(screen.getByText("Costos"));
  expect(onPick).toHaveBeenCalledWith(null);
});
```

- [ ] **Step 2: Correr para ver fallar**

Run: `npx vitest run src/components/waf/PillarCards.test.tsx`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implementar `src/components/waf/WafKpis.tsx`**

```tsx
import type { WafSummary } from "@/types";

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-secondary p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums tracking-tight mt-1">{value}</div>
    </div>
  );
}

export default function WafKpis({ summary }: { summary: WafSummary | null }) {
  const ing = summary?.latest_ingestion;
  const ingLabel = ing?.completed_at ? new Date(ing.completed_at).toLocaleDateString("es-EC") : "—";
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Kpi label="Recomendaciones activas" value={summary?.active_recommendations ?? 0} />
      <Kpi label="Hallazgos activos" value={summary?.active_findings ?? 0} />
      <Kpi label="Recomendaciones de costo" value={summary?.cost_recommendations ?? 0} />
      <Kpi label="Última ingesta" value={ingLabel} />
    </div>
  );
}
```

- [ ] **Step 4: Implementar `src/components/waf/PillarCards.tsx`**

```tsx
import type { WafSection } from "@/types";
import { pillarColor } from "@/lib/waf";

export default function PillarCards({ sections, activePillar, onPick }: {
  sections: WafSection[];
  activePillar: number | null;
  onPick: (pillar: number | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {sections.map((s) => {
        const active = activePillar === s.section_num;
        const color = pillarColor(s.section_num);
        return (
          <button
            key={s.section_num}
            type="button"
            onClick={() => onPick(active ? null : s.section_num)}
            aria-pressed={active}
            className={`text-left rounded-xl border p-3 flex flex-col gap-2 transition-colors hover:bg-accent ${active ? "border-primary ring-1 ring-primary" : "border-border bg-card"}`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
              {s.section_name}
            </div>
            <div className="text-2xl font-bold tabular-nums">{s.total_recs}</div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <span className="block h-full rounded-full" style={{ width: `${Math.round(s.avg_progress)}%`, background: color }} />
            </div>
            <div className="text-[11px] text-muted-foreground">{Math.round(s.avg_progress)}% · Alta {s.high_recs}</div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Correr tests**

Run: `npx vitest run src/components/waf/PillarCards.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/waf/WafKpis.tsx src/components/waf/PillarCards.tsx src/components/waf/PillarCards.test.tsx
git commit -m "feat(waf): KPIs y tarjetas de pilar clicables"
```

---

### Task 5: `WafDataTable`

**Files:**
- Create: `src/components/waf/WafDataTable.tsx`
- Test: `src/components/waf/WafDataTable.test.tsx`

**Interfaces:**
- Consumes: `WafRecommendation` (Task 1); `impactMeta` (Task 2); `DataTablePagination`; tabla shadcn (`@/components/ui/table`).
- Produces: `WafDataTable({ recommendations, pillarNames, minPct, maxPct, onOpen }: { recommendations: WafRecommendation[]; pillarNames: Record<number,string>; minPct: number; maxPct: number; onOpen: (canonicalId: number) => void })`. El filtrado por pilar ya viene aplicado por el padre; aquí se aplica el filtro de avance (minPct/maxPct) via columnFilters/global o pre-filtrado con `filterRecommendations`.

- [ ] **Step 1: Escribir test en `src/components/waf/WafDataTable.test.tsx`**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import WafDataTable from "@/components/waf/WafDataTable";
import type { WafRecommendation } from "@/types";

const recs: WafRecommendation[] = [
  { canonical_id: 1, matrix_code: "2.1", pillar_number: 2, review_scope_es: "MFA admins", business_impact: "High", resource_count: 18, completion_pct: 20 },
  { canonical_id: 2, matrix_code: "5.1", pillar_number: 5, review_scope_es: "Reserved Instances", business_impact: "High", resource_count: 31, completion_pct: 10 },
];

test("renderiza filas y abre el detalle al hacer clic", () => {
  const onOpen = vi.fn();
  render(<WafDataTable recommendations={recs} pillarNames={{ 2: "Seguridad", 5: "Costos" }} minPct={0} maxPct={100} onOpen={onOpen} />);
  expect(screen.getByText("MFA admins")).toBeInTheDocument();
  expect(screen.getByText("Costos")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Reserved Instances"));
  expect(onOpen).toHaveBeenCalledWith(2);
});
```

- [ ] **Step 2: Correr para ver fallar**

Run: `npx vitest run src/components/waf/WafDataTable.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/components/waf/WafDataTable.tsx`**

```tsx
import { useMemo, useState } from "react";
import {
  createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable, type SortingState,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DataTablePagination from "@/components/DataTablePagination";
import { impactMeta, filterRecommendations } from "@/lib/waf";
import type { WafRecommendation } from "@/types";

const col = createColumnHelper<WafRecommendation>();

export default function WafDataTable({ recommendations, pillarNames, minPct, maxPct, onOpen }: {
  recommendations: WafRecommendation[];
  pillarNames: Record<number, string>;
  minPct: number;
  maxPct: number;
  onOpen: (canonicalId: number) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const data = useMemo(() => filterRecommendations(recommendations, { minPct, maxPct }), [recommendations, minPct, maxPct]);

  const columns = useMemo(() => [
    col.accessor("matrix_code", { header: "Código", cell: (c) => <span className="font-medium">{c.getValue()}</span> }),
    col.accessor("pillar_number", { header: "Pilar", cell: (c) => pillarNames[c.getValue()] ?? c.getValue() }),
    col.accessor("review_scope_es", { header: "Ámbito", cell: (c) => <span className="truncate block max-w-[280px]">{c.getValue() ?? "—"}</span> }),
    col.accessor("business_impact", {
      header: "Impacto",
      cell: (c) => { const m = impactMeta(c.getValue()); return <span className={`text-xs px-2.5 py-0.5 rounded-full ${m.chip}`}>{m.label}</span>; },
    }),
    col.accessor("resource_count", { header: "Recursos", sortingFn: "basic", cell: (c) => <span className="tabular-nums">{c.getValue()}</span> }),
    col.accessor("completion_pct", {
      header: "Avance", sortingFn: "basic",
      cell: (c) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-[70px] rounded-full bg-secondary overflow-hidden">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${c.getValue()}%` }} />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{c.getValue()}%</span>
        </div>
      ),
    }),
  ], [pillarNames]);

  const table = useReactTable({
    data, columns, state: { sorting }, onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} onClick={h.column.getToggleSortingHandler()} className="cursor-pointer select-none">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin recomendaciones.</TableCell></TableRow>
            ) : table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} onClick={() => onOpen(row.original.canonical_id)} className="cursor-pointer">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
```

- [ ] **Step 4: Correr tests**

Run: `npx vitest run src/components/waf/WafDataTable.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/waf/WafDataTable.tsx src/components/waf/WafDataTable.test.tsx
git commit -m "feat(waf): tabla de recomendaciones (TanStack + paginación + orden)"
```

---

### Task 6: `WafDetailDialog` (shell + secciones de lectura)

**Files:**
- Create: `src/components/waf/WafDetailDialog.tsx`
- Test: `src/components/waf/WafDetailDialog.test.tsx`

**Interfaces:**
- Consumes: `getWafRecommendation`, `getWafResources`, `getWafComments`, `getWafHistory` (Task 1); `impactMeta` (Task 2); `Dialog` shadcn. Renderiza placeholders para `TrackingForm` (Task 7) y `Comments` (Task 8) que se rellenan luego — en esta tarea esas zonas muestran datos read-only y se completan en sus tareas.
- Produces: `WafDetailDialog({ clientId, canonicalId, pillarName, open, onOpenChange, onChanged }: { clientId: number; canonicalId: number | null; pillarName: string; open: boolean; onOpenChange: (o: boolean) => void; onChanged: () => void })`. `onChanged` se llama tras guardar seguimiento/comentario (Tasks 7–8) para refrescar la tabla.

- [ ] **Step 1: Escribir test en `src/components/waf/WafDetailDialog.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  getWafRecommendation: vi.fn(async () => ({
    canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "RI",
    business_impact: "High", resource_count: 2, completion_pct: 10,
    benefit_es: "Ahorra", client_action_es: "Aprobar", bit_action_es: "Comprar",
    remediation_start_date: null, projected_bit_effort: null, execution_log: null,
    priority_override: null, internal_notes: null,
  })),
  getWafResources: vi.fn(async () => [{ finding_id: 1, resource_name: "vm-01", resource_type: "VM", resource_group: "rg", subscription_name: "sub", status: "active" }]),
  getWafComments: vi.fn(async () => []),
  getWafHistory: vi.fn(async () => []),
  updateWafTracking: vi.fn(async () => ({ message: "ok" })),
  addWafComment: vi.fn(async () => ({ comment_id: 1 })),
}));

test("carga y muestra el detalle (resumen + recursos)", async () => {
  const { default: WafDetailDialog } = await import("@/components/waf/WafDetailDialog");
  render(<WafDetailDialog clientId={3} canonicalId={9} pillarName="Costos" open onOpenChange={() => {}} onChanged={() => {}} />);
  await waitFor(() => expect(screen.getByText("Ahorra")).toBeInTheDocument());
  expect(screen.getByText("vm-01")).toBeInTheDocument();
});
```

- [ ] **Step 2: Correr para ver fallar**

Run: `npx vitest run src/components/waf/WafDetailDialog.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/components/waf/WafDetailDialog.tsx`** (incluye `TrackingForm` y `Comments` ya integrados; el código de esos sub-bloques se detalla en Tasks 7 y 8 — aquí van como secciones internas con su estado)

```tsx
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getWafRecommendation, getWafResources, getWafComments, getWafHistory } from "@/lib/api";
import { impactMeta } from "@/lib/waf";
import type { WafRecommendationDetail, WafResource, WafComment, WafHistoryEntry } from "@/types";
import TrackingForm from "@/components/waf/TrackingForm";
import Comments from "@/components/waf/Comments";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-4">
      <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-3">{title}</h3>
      {children}
    </section>
  );
}

export default function WafDetailDialog({ clientId, canonicalId, pillarName, open, onOpenChange, onChanged }: {
  clientId: number; canonicalId: number | null; pillarName: string;
  open: boolean; onOpenChange: (o: boolean) => void; onChanged: () => void;
}) {
  const [detail, setDetail] = useState<WafRecommendationDetail | null>(null);
  const [resources, setResources] = useState<WafResource[]>([]);
  const [comments, setComments] = useState<WafComment[]>([]);
  const [history, setHistory] = useState<WafHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadDetail(cid: number) {
    setLoading(true);
    try {
      const [d, r, c, h] = await Promise.all([
        getWafRecommendation(clientId, cid), getWafResources(clientId, cid),
        getWafComments(clientId, cid), getWafHistory(clientId, cid),
      ]);
      setDetail(d); setResources(r); setComments(c); setHistory(h);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (open && canonicalId != null) loadDetail(canonicalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, canonicalId]);

  function refreshComments() { if (canonicalId != null) getWafComments(clientId, canonicalId).then(setComments); }
  function afterTracking() { if (canonicalId != null) loadDetail(canonicalId); onChanged(); }

  const m = detail ? impactMeta(detail.business_impact) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{detail?.matrix_code} · {detail?.review_scope_es ?? "Recomendación"}</span>
          </DialogTitle>
        </DialogHeader>
        {loading || !detail ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>
        ) : (
          <div>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-accent text-accent-foreground">{pillarName}</span>
              {m && <span className={`text-xs px-2.5 py-0.5 rounded-full ${m.chip}`}>Impacto {m.label}</span>}
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{detail.resource_count} recursos</span>
            </div>

            <Section title="Resumen">
              <div className="space-y-3 text-sm">
                <div><div className="text-muted-foreground text-xs mb-0.5">Beneficio</div>{detail.benefit_es ?? "—"}</div>
                <div><div className="text-muted-foreground text-xs mb-0.5">Acción del cliente</div>{detail.client_action_es ?? "—"}</div>
                <div><div className="text-muted-foreground text-xs mb-0.5">Acción Business IT</div>{detail.bit_action_es ?? "—"}</div>
              </div>
            </Section>

            <Section title="Seguimiento">
              <TrackingForm clientId={clientId} canonicalId={detail.canonical_id} detail={detail} onSaved={afterTracking} />
            </Section>

            <Section title={`Recursos asociados (${resources.length})`}>
              {resources.length === 0 ? <p className="text-sm text-muted-foreground">Sin recursos.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1.5 pr-3 font-medium">Recurso</th><th className="py-1.5 pr-3 font-medium">Tipo</th>
                      <th className="py-1.5 pr-3 font-medium">Grupo</th><th className="py-1.5 font-medium">Estado</th>
                    </tr></thead>
                    <tbody>
                      {resources.map((r) => (
                        <tr key={r.finding_id} className="border-t border-border">
                          <td className="py-1.5 pr-3">{r.resource_name}</td><td className="py-1.5 pr-3">{r.resource_type ?? "—"}</td>
                          <td className="py-1.5 pr-3">{r.resource_group ?? "—"}</td>
                          <td className="py-1.5">{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title="Comentarios">
              <Comments clientId={clientId} canonicalId={detail.canonical_id} comments={comments} onAdded={refreshComments} />
            </Section>

            <Section title="Historial de cambios">
              {history.length === 0 ? <p className="text-sm text-muted-foreground">Sin cambios registrados.</p> : (
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  {history.map((h) => (
                    <li key={h.history_id}>
                      <span className="text-foreground">{h.field_changed}</span> {h.old_value ?? "—"} → {h.new_value ?? "—"} · {h.changed_by ?? "—"} · {new Date(h.changed_at).toLocaleDateString("es-EC")}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

> Esta tarea depende de `TrackingForm` (Task 7) y `Comments` (Task 8). Para que el test de esta tarea compile, primero crea stubs mínimos de ambos (un componente que renderice `null`), o reordena la ejecución: implementa Tasks 7 y 8 antes del Step 4 de esta tarea. Recomendado: crear los stubs aquí y completarlos en sus tareas.

- [ ] **Step 4: Crear stubs mínimos para compilar** (`src/components/waf/TrackingForm.tsx` y `src/components/waf/Comments.tsx`)

```tsx
// TrackingForm.tsx (stub; se completa en Task 7)
import type { WafRecommendationDetail } from "@/types";
export default function TrackingForm(_: { clientId: number; canonicalId: number; detail: WafRecommendationDetail; onSaved: () => void }) {
  return null;
}
```

```tsx
// Comments.tsx (stub; se completa en Task 8)
import type { WafComment } from "@/types";
export default function Comments(_: { clientId: number; canonicalId: number; comments: WafComment[]; onAdded: () => void }) {
  return null;
}
```

- [ ] **Step 5: Correr tests**

Run: `npx vitest run src/components/waf/WafDetailDialog.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/waf/WafDetailDialog.tsx src/components/waf/TrackingForm.tsx src/components/waf/Comments.tsx src/components/waf/WafDetailDialog.test.tsx
git commit -m "feat(waf): dialog de detalle (resumen, recursos, historial) + stubs"
```

---

### Task 7: `TrackingForm` (seguimiento editable)

**Files:**
- Modify: `src/components/waf/TrackingForm.tsx` (reemplaza el stub)
- Test: `src/components/waf/TrackingForm.test.tsx`

**Interfaces:**
- Consumes: `updateWafTracking` (Task 1); `validateTracking` (Task 2); `canEdit` (`@/lib/auth`); `Input`/`Label`/`Textarea`/`Button`/`Select` (shadcn); `toast` (sonner).
- Produces: `TrackingForm({ clientId, canonicalId, detail, onSaved })` — ya consumido por Task 6.

- [ ] **Step 1: Escribir test en `src/components/waf/TrackingForm.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({ updateWafTracking: vi.fn(async () => ({ message: "ok" })) }));
vi.mock("@/lib/auth", () => ({ canEdit: () => true }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const detail = {
  canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "RI",
  business_impact: "High", resource_count: 2, completion_pct: 10,
  benefit_es: "", client_action_es: "", bit_action_es: "",
  remediation_start_date: null, projected_bit_effort: null, execution_log: null,
  priority_override: null, internal_notes: null,
};

beforeEach(() => vi.clearAllMocks());

test("guarda el seguimiento llamando a la API", async () => {
  const { default: TrackingForm } = await import("@/components/waf/TrackingForm");
  const { updateWafTracking } = await import("@/lib/api");
  const onSaved = vi.fn();
  render(<TrackingForm clientId={3} canonicalId={9} detail={detail} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("button", { name: /guardar seguimiento/i }));
  await waitFor(() => expect(updateWafTracking).toHaveBeenCalled());
  expect(onSaved).toHaveBeenCalled();
});
```

- [ ] **Step 2: Correr para ver fallar**

Run: `npx vitest run src/components/waf/TrackingForm.test.tsx`
Expected: FAIL (el stub no tiene botón).

- [ ] **Step 3: Implementar `src/components/waf/TrackingForm.tsx`**

```tsx
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateWafTracking } from "@/lib/api";
import { validateTracking } from "@/lib/waf";
import { canEdit } from "@/lib/auth";
import type { WafRecommendationDetail, WafTrackingUpdate } from "@/types";

const PRIORITY = [{ v: "1", l: "Alta" }, { v: "2", l: "Media" }, { v: "3", l: "Baja" }];

export default function TrackingForm({ clientId, canonicalId, detail, onSaved }: {
  clientId: number; canonicalId: number; detail: WafRecommendationDetail; onSaved: () => void;
}) {
  const editable = canEdit();
  const [pct, setPct] = useState(detail.completion_pct ?? 0);
  const [date, setDate] = useState(detail.remediation_start_date ?? "");
  const [effort, setEffort] = useState(detail.projected_bit_effort ?? "");
  const [priority, setPriority] = useState(detail.priority_override ? String(detail.priority_override) : "");
  const [log, setLog] = useState(detail.execution_log ?? "");
  const [notes, setNotes] = useState(detail.internal_notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    const errs = validateTracking({ completion_pct: pct, remediation_start_date: date || null });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body: WafTrackingUpdate = {
      completion_pct: pct,
      remediation_start_date: date || null,
      projected_bit_effort: effort || null,
      priority_override: priority ? Number(priority) : null,
      execution_log: log || null,
      internal_notes: notes || null,
    };
    setSaving(true);
    try {
      await updateWafTracking(clientId, canonicalId, body);
      toast.success("Seguimiento guardado");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pct">Avance: {pct}%</Label>
          <input id="pct" type="range" min={0} max={100} step={1} value={pct}
            disabled={!editable} onChange={(e) => setPct(Number(e.target.value))} className="w-full" />
          {errors.completion_pct && <p className="text-sm text-destructive">{errors.completion_pct}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="priority">Prioridad</Label>
          <Select value={priority} onValueChange={setPriority} disabled={!editable}>
            <SelectTrigger id="priority"><SelectValue placeholder="Sin definir" /></SelectTrigger>
            <SelectContent>{PRIORITY.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Fecha de inicio</Label>
          <Input id="date" type="date" value={date} disabled={!editable} onChange={(e) => setDate(e.target.value)} />
          {errors.remediation_start_date && <p className="text-sm text-destructive">{errors.remediation_start_date}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="effort">Esfuerzo BIT</Label>
          <Input id="effort" value={effort} disabled={!editable} onChange={(e) => setEffort(e.target.value)} placeholder="8 horas" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="log">Bitácora de ejecución</Label>
        <Textarea id="log" rows={2} value={log} disabled={!editable} onChange={(e) => setLog(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas internas</Label>
        <Textarea id="notes" rows={2} value={notes} disabled={!editable} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {editable && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>Guardar seguimiento</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Correr tests**

Run: `npx vitest run src/components/waf/TrackingForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/waf/TrackingForm.tsx src/components/waf/TrackingForm.test.tsx
git commit -m "feat(waf): formulario de seguimiento editable (PUT tracking)"
```

---

### Task 8: `Comments` (lista + agregar)

**Files:**
- Modify: `src/components/waf/Comments.tsx` (reemplaza el stub)
- Test: `src/components/waf/Comments.test.tsx`

**Interfaces:**
- Consumes: `addWafComment` (Task 1); `canEdit`; `Textarea`/`Button`; `toast`.
- Produces: `Comments({ clientId, canonicalId, comments, onAdded })` — ya consumido por Task 6.

- [ ] **Step 1: Escribir test en `src/components/waf/Comments.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({ addWafComment: vi.fn(async () => ({ comment_id: 1 })) }));
vi.mock("@/lib/auth", () => ({ canEdit: () => true }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

test("agrega un comentario", async () => {
  const { default: Comments } = await import("@/components/waf/Comments");
  const { addWafComment } = await import("@/lib/api");
  const onAdded = vi.fn();
  render(<Comments clientId={3} canonicalId={9} comments={[]} onAdded={onAdded} />);
  fireEvent.change(screen.getByPlaceholderText(/comentario/i), { target: { value: "Hola" } });
  fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
  await waitFor(() => expect(addWafComment).toHaveBeenCalledWith(3, 9, "Hola"));
  expect(onAdded).toHaveBeenCalled();
});

test("muestra comentarios existentes", async () => {
  const { default: Comments } = await import("@/components/waf/Comments");
  render(<Comments clientId={3} canonicalId={9} comments={[{ comment_id: 1, user_display: "IB", comment_text: "Nota previa", created_at: "2026-06-24T00:00:00Z" }]} onAdded={() => {}} />);
  expect(screen.getByText("Nota previa")).toBeInTheDocument();
});
```

- [ ] **Step 2: Correr para ver fallar**

Run: `npx vitest run src/components/waf/Comments.test.tsx`
Expected: FAIL (el stub renderiza null).

- [ ] **Step 3: Implementar `src/components/waf/Comments.tsx`**

```tsx
import { useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { addWafComment } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import type { WafComment } from "@/types";

export default function Comments({ clientId, canonicalId, comments, onAdded }: {
  clientId: number; canonicalId: number; comments: WafComment[]; onAdded: () => void;
}) {
  const editable = canEdit();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await addWafComment(clientId, canonicalId, text.trim());
      setText("");
      toast.success("Comentario agregado");
      onAdded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al comentar");
    } finally { setSending(false); }
  }

  return (
    <div className="space-y-3">
      {comments.length === 0 ? <p className="text-sm text-muted-foreground">Sin comentarios.</p> : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.comment_id} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-accent text-accent-foreground grid place-items-center text-[11px] font-medium shrink-0">
                {c.user_display.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm">{c.comment_text}</div>
                <div className="text-[11px] text-muted-foreground">{c.user_display} · {new Date(c.created_at).toLocaleDateString("es-EC")}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="flex gap-2 items-end">
          <Textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe un comentario…" className="flex-1" />
          <Button variant="outline" onClick={send} disabled={sending || !text.trim()}>Enviar</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Correr tests**

Run: `npx vitest run src/components/waf/Comments.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/waf/Comments.tsx src/components/waf/Comments.test.tsx
git commit -m "feat(waf): comentarios (lista + agregar)"
```

---

### Task 9: `WafPage` + `WafClientHeader` (ensamblaje + logo)

**Files:**
- Create: `src/components/waf/WafClientHeader.tsx`
- Create: `src/components/waf/WafPage.tsx`
- Test: `src/components/waf/WafPage.test.tsx`

**Interfaces:**
- Consumes: `useWaf` (Task 3); `WafKpis`/`PillarCards` (Task 4); `WafDataTable` (Task 5); `WafDetailDialog` (Task 6); `ClientCombobox` (existente); `ClientLogo` (existente); `AppShell` (existente); `BusyOverlay` (existente).
- Produces: `WafPage({ onNavigate }: { onNavigate?: (key: string) => void })`.

- [ ] **Step 1: Escribir test en `src/components/waf/WafPage.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { expect, test, vi } from "vitest";

vi.mock("@/hooks/useWaf", () => ({
  useWaf: () => ({
    clients: [{ client_id: 3, client_name: "BANISI", has_logo: false }],
    clientId: 3,
    summary: { client_id: 3, recommendations: 1, active_recommendations: 1, cost_recommendations: 0, active_findings: 2, latest_ingestion: null },
    sections: [{ section_num: 5, section_name: "Costos", total_recs: 1, total_resources: 2, avg_progress: 10, high_recs: 1, medium_recs: 0 }],
    recommendations: [{ canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "RI", business_impact: "High", resource_count: 2, completion_pct: 10 }],
    pillarNames: { 5: "Costos" },
    loading: false, dataLoading: false, error: "", selectClient: vi.fn(), reloadData: vi.fn(),
  }),
}));
vi.mock("@/lib/api", () => ({ fetchClientLogoObjectUrl: vi.fn(async () => null) }));

test("renderiza la vista WAF con KPIs, pilar y tabla", async () => {
  const { default: WafPage } = await import("@/components/waf/WafPage");
  render(<ThemeProvider attribute="class" defaultTheme="light"><WafPage /></ThemeProvider>);
  await waitFor(() => expect(screen.getByText("RI")).toBeInTheDocument());
  expect(screen.getByText("Recomendaciones activas")).toBeInTheDocument();
  expect(screen.getAllByText("Costos").length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Correr para ver fallar**

Run: `npx vitest run src/components/waf/WafPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/components/waf/WafClientHeader.tsx`**

```tsx
import ClientCombobox from "@/components/costs/ClientCombobox";
import ClientLogo from "@/components/clients/ClientLogo";
import type { ClientAdmin } from "@/types";

export default function WafClientHeader({ clients, clientId, onSelect }: {
  clients: ClientAdmin[]; clientId: number | null; onSelect: (id: number) => void;
}) {
  const active = clients.find((c) => c.client_id === clientId);
  return (
    <div className="flex items-center gap-3">
      {active && <ClientLogo clientId={active.client_id} name={active.client_name} hasLogo={active.has_logo} size={32} />}
      <ClientCombobox clients={clients} value={clientId} onChange={onSelect} />
    </div>
  );
}
```

- [ ] **Step 4: Implementar `src/components/waf/WafPage.tsx`**

```tsx
import { useState } from "react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import WafClientHeader from "@/components/waf/WafClientHeader";
import WafKpis from "@/components/waf/WafKpis";
import PillarCards from "@/components/waf/PillarCards";
import WafDataTable from "@/components/waf/WafDataTable";
import WafDetailDialog from "@/components/waf/WafDetailDialog";
import { useWaf } from "@/hooks/useWaf";
import { filterRecommendations } from "@/lib/waf";

export default function WafPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const waf = useWaf();
  const [pillar, setPillar] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = filterRecommendations(waf.recommendations, { pillar });

  function open(canonicalId: number) { setOpenId(canonicalId); setDialogOpen(true); }

  return (
    <AppShell title="Recomendaciones" subtitle="Matriz mejoras Azure · Well-Architected" active="waf" onNavigate={onNavigate}
      headerRight={<WafClientHeader clients={waf.clients} clientId={waf.clientId} onSelect={waf.selectClient} />}>
      <BusyOverlay show={waf.loading || waf.dataLoading} title="Cargando recomendaciones" />
      <div className="space-y-5">
        <WafKpis summary={waf.summary} />
        <PillarCards sections={waf.sections} activePillar={pillar} onPick={setPillar} />
        {waf.error && <p className="text-sm text-destructive">{waf.error}</p>}
        <WafDataTable recommendations={filtered} pillarNames={waf.pillarNames} minPct={0} maxPct={100} onOpen={open} />
      </div>
      <WafDetailDialog
        clientId={waf.clientId ?? 0}
        canonicalId={openId}
        pillarName={openId != null ? (waf.pillarNames[waf.recommendations.find((r) => r.canonical_id === openId)?.pillar_number ?? 0] ?? "") : ""}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onChanged={waf.reloadData}
      />
    </AppShell>
  );
}
```

- [ ] **Step 5: Correr tests**

Run: `npx vitest run src/components/waf/WafPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/waf/WafClientHeader.tsx src/components/waf/WafPage.tsx src/components/waf/WafPage.test.tsx
git commit -m "feat(waf): WafPage (ensamblaje) + header con logo de cliente"
```

---

### Task 10: Navegación (activar "Recomendaciones" en el menú)

**Files:**
- Modify: `src/App.tsx` (agregar sección `"waf"`)
- Modify: `src/components/AppShell.tsx` (el ítem "Recomendaciones" deja de ser `soon` y navega a `"waf"`)
- Modify: `src/components/AppShell.test.tsx` (actualizar: "Recomendaciones" ahora es navegable)

**Interfaces:**
- Consumes: `WafPage` (Task 9).

- [ ] **Step 1: Actualizar el test del AppShell** en `src/components/AppShell.test.tsx` — agregar caso de que "Recomendaciones" es un botón navegable (ya no placeholder)

```tsx
test("el ítem Recomendaciones es navegable (no placeholder)", () => {
  renderShell("waf");
  const item = screen.getByRole("button", { name: /^Recomendaciones$/i });
  expect(item).toHaveClass("bg-primary");
});
```

- [ ] **Step 2: Correr para ver fallar**

Run: `npx vitest run src/components/AppShell.test.tsx`
Expected: FAIL (hoy "Recomendaciones" es un `<span>` placeholder "pronto", no un botón activo).

- [ ] **Step 3: En `src/components/AppShell.tsx`, cambiar el ítem de "Matriz mejoras Azure"**

Reemplazar la entrada del MENU:
```ts
      { label: "Recomendaciones", soon: true },
```
por:
```ts
      { label: "Recomendaciones", section: "waf" },
```

- [ ] **Step 4: En `src/App.tsx`, agregar la sección `"waf"`**

```tsx
import WafPage from "@/components/waf/WafPage";
```
Y en el switch de secciones, agregar antes del `else` final:
```tsx
        ) : section === "waf" ? (
          <WafPage onNavigate={setSection} />
```

- [ ] **Step 5: Correr toda la suite + build + lint**

Run: `npx vitest run && npm run build && npm run lint`
Expected: todos los tests verdes; build OK; lint sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/AppShell.tsx src/components/AppShell.test.tsx
git commit -m "feat(waf): activar Recomendaciones en el menú y enrutar la vista"
```

---

## Verificación en vivo (tras implementar, con OK del usuario para deploy)
- Confirmar contra el Swagger del .NET que las respuestas WAF coinciden con los tipos; ajustar si difiere (especialmente `summary.latest_ingestion`, `recommendations[].completion_pct` y la numeración de pilar).
- DEV: `npm run dev` con el .NET local (`-valida`) corriendo; elegir un cliente con datos WAF; verificar KPIs, tarjetas (clic filtra), tabla (orden/paginación), detalle (5 secciones), guardar seguimiento y comentar (toasts), y modo claro/oscuro.
- Deploy: push a `main` (dispara GitHub Actions a la SWA del piloto) **solo con OK explícito del usuario**.

## Self-Review (hecho)
- **Cobertura del spec:** selector+logo (Task 9), KPIs (Task 4), tarjetas clicables (Task 4), tabla con orden/paginación/filtro (Task 5), detalle 5 secciones (Tasks 6–8), gating (Tasks 7–8 via `canEdit`), tema (tokens en todos los componentes), navegación (Task 10). Fuera de alcance respetado (sin Advisor-sync/Excel/IA/costo-ref/ingestas/descartar).
- **Placeholders:** ninguno; todo el código está completo. La numeración de pilar se evita hardcodear usando `section_name` del backend.
- **Consistencia de tipos:** `WafRecommendation`/`WafRecommendationDetail`/`WafTrackingUpdate` y las firmas de `updateWafTracking(clientId, canonicalId, body)` y `addWafComment(clientId, canonicalId, text)` se usan idénticas en Tasks 1, 6, 7, 8.
