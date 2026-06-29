# WAF Validación inteligente (admin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Implementar la sub-vista "Validación inteligente" (curación IA del catálogo global de canónicas WAF), solo admin, y activarla en el menú. Cierra el módulo WAF.

**Architecture:** API en `lib/api.ts`, helpers puros en `lib/waf.ts`, `CanonicalEditDialog` (editor con analizar/aplicar IA y guardar manual) y `ValidationPage` (tarjeta de config IA + filtros + tabla del catálogo + botón batch "Analizar y aplicar pendientes"), ruteo en `App.tsx` + ítem del menú (adminOnly) en `AppShell`.

**Tech Stack:** React, TS, shadcn (Table, Dialog, Select, Input, Textarea, Button), sonner, Vitest + Testing Library.

## Contrato backend .NET (verificado, snake_case; TODO solo rol `admin`)
- `GET /waf/admin/ai/config` → `{ configured, deployment, api_version, has_key }`.
- `GET /waf/admin/catalog?review_status=&excluded=` → `[{ canonical_id, advisor_name, advisor_category, pillar_number, review_scope_es, benefit_es, client_action_es, bit_action_es, is_excluded, exclusion_reason, consolidates_to_id, ai_review_status, ai_decision, ai_confidence, ai_possible_additional_cost, ai_cost_reason, ai_exclusion_reason, ai_duplicate_group_key, ai_reviewed_at, created_at, updated_at }]`.
- `POST /waf/admin/ai/recommendations/{id}/analyze` → `{ canonical_id, suggestion: { decision, possible_additional_cost, cost_reason, duplicate_group_key, pillar_number, review_scope_es, benefit_es, client_action_es, bit_action_es, exclusion_reason, confidence, raw_model_text } }` (no persiste; 502 si falla IA).
- `POST /waf/admin/ai/recommendations/analyze-all` body `{ limit: 1-200 (default 50), apply: bool }` → `{ total, processed, applied, errors: [{canonical_id, error}] }`.
- `PATCH /waf/admin/ai/recommendations/{id}/apply` body `WafAiSuggestion` (decision requerido include|exclude|review; review_scope_es/benefit_es/client_action_es/bit_action_es requeridos; exclusion_reason requerido si decision=exclude) → `{ message, canonical_id }`.
- `PUT /waf/admin/catalog/{id}` body (todos opcionales; solo los presentes se actualizan): `{ pillar_number?, review_scope_es?, benefit_es?, client_action_es?, bit_action_es?, is_excluded?, exclusion_reason?, ai_review_status? }` (ai_review_status ∈ pending|reviewed|applied|requires_review|excluded; si excluded fuerza is_excluded=true; exclusion_reason requerido si is_excluded) → `{ message, canonical_id }`.

## Global Constraints
- Front solo al .NET vía `request<T>`. Tokens / `dark:`. Español. YAGNI.
- Toda la vista es **admin-only**: el ítem del menú ya es `adminOnly`; además la página muestra un aviso si `getRole() !== "admin"` (defensa en profundidad).
- Escrituras (analizar/aplicar/guardar/batch) con toast (sonner); `BusyOverlay` en cargas y operaciones; tras éxito recargar el catálogo.
- Tras cada tarea: lint + build verdes; commits frecuentes.

---

### Task 1: Tipos + API (config, catalog, analyze, analyze-all, apply, update)

**Files:** Modify `src/types.ts`, `src/lib/api.ts`; Test `src/lib/api.test.ts`.

**Produces:** tipos `WafAiConfig`, `WafCanonical`, `WafAiSuggestion`, `WafCanonicalUpdate`, `WafAiBatchResult`; funciones `getWafAiConfig()`, `getWafCatalog(params?)`, `analyzeWafCanonical(id)`, `analyzeAllWafCanonicals(body)`, `applyWafSuggestion(id, suggestion)`, `updateWafCanonical(id, body)`.

- [ ] **Step 1: Tipos en `src/types.ts` (al final)**

```ts
export interface WafAiConfig { configured: boolean; deployment: string | null; api_version: string | null; has_key: boolean; }
export interface WafCanonical {
  canonical_id: number; advisor_name: string; advisor_category: string; pillar_number: number;
  review_scope_es: string; benefit_es: string; client_action_es: string; bit_action_es: string;
  is_excluded: boolean; exclusion_reason: string | null; consolidates_to_id: number | null;
  ai_review_status: string; ai_decision: string | null; ai_confidence: number | null;
  ai_possible_additional_cost: boolean; ai_cost_reason: string | null; ai_exclusion_reason: string | null;
  ai_duplicate_group_key: string | null; ai_reviewed_at: string | null; created_at: string; updated_at: string;
}
export interface WafAiSuggestion {
  decision: string; possible_additional_cost: boolean; cost_reason: string; duplicate_group_key: string;
  pillar_number: number; review_scope_es: string; benefit_es: string; client_action_es: string;
  bit_action_es: string; exclusion_reason: string; confidence: number; raw_model_text: string;
}
export interface WafCanonicalUpdate {
  pillar_number?: number; review_scope_es?: string; benefit_es?: string; client_action_es?: string;
  bit_action_es?: string; is_excluded?: boolean; exclusion_reason?: string | null; ai_review_status?: string;
}
export interface WafAiBatchResult { total: number; processed: number; applied: number; errors: { canonical_id: number; error: string }[]; }
```

- [ ] **Step 2: API en `src/lib/api.ts`** (merge `WafAiBatchResult`, `WafAiConfig`, `WafAiSuggestion`, `WafCanonical`, `WafCanonicalUpdate` en el `import type` del tope; agregar un bloque "WAF admin")

```ts
// ---- WAF admin: validación inteligente (curación IA del catálogo) ----
export const getWafAiConfig = () => request<WafAiConfig>(`/waf/admin/ai/config`);
export const getWafCatalog = (params?: { review_status?: string; excluded?: boolean }) => {
  const q = new URLSearchParams();
  if (params?.review_status) q.set("review_status", params.review_status);
  if (params?.excluded != null) q.set("excluded", String(params.excluded));
  const qs = q.toString();
  return request<WafCanonical[]>(`/waf/admin/catalog${qs ? `?${qs}` : ""}`);
};
export const analyzeWafCanonical = (canonicalId: number) =>
  request<{ canonical_id: number; suggestion: WafAiSuggestion }>(`/waf/admin/ai/recommendations/${canonicalId}/analyze`, { method: "POST" });
export const analyzeAllWafCanonicals = (body: { limit: number; apply: boolean }) =>
  request<WafAiBatchResult>(`/waf/admin/ai/recommendations/analyze-all`, jsonOpts("POST", body));
export const applyWafSuggestion = (canonicalId: number, suggestion: WafAiSuggestion) =>
  request<{ message: string; canonical_id: number }>(`/waf/admin/ai/recommendations/${canonicalId}/apply`, jsonOpts("PATCH", suggestion));
export const updateWafCanonical = (canonicalId: number, body: WafCanonicalUpdate) =>
  request<{ message: string; canonical_id: number }>(`/waf/admin/catalog/${canonicalId}`, jsonOpts("PUT", body));
```

- [ ] **Step 3: Test en `src/lib/api.test.ts`** (bloque WAF)

```ts
it("getWafCatalog agrega review_status y excluded a la query", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
  const { getWafCatalog } = await import("@/lib/api");
  await getWafCatalog({ review_status: "pending", excluded: false });
  const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
  expect(calls[0][0]).toContain("/waf/admin/catalog?");
  expect(calls[0][0]).toContain("review_status=pending");
  expect(calls[0][0]).toContain("excluded=false");
});
it("analyzeAllWafCanonicals postea limit+apply", async () => {
  const spy = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", spy);
  const { analyzeAllWafCanonicals } = await import("@/lib/api");
  await analyzeAllWafCanonicals({ limit: 50, apply: true });
  const calls = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls;
  expect(calls[0][0]).toContain("/waf/admin/ai/recommendations/analyze-all");
  expect(JSON.parse((calls[0][1] as RequestInit).body as string)).toEqual({ limit: 50, apply: true });
});
```

- [ ] **Step 4: Correr** `npx vitest run src/lib/api.test.ts` → PASS; `npx tsc -b` limpio.
- [ ] **Step 5: Commit** `git commit -m "feat(waf): API validación inteligente (catálogo + IA admin)"`

---

### Task 2: Helpers de catálogo en `lib/waf.ts`

**Files:** Modify `src/lib/waf.ts`; Test `src/lib/waf.test.ts`.

**Produces:** `REVIEW_STATUS_META: Record<string,{label:string;chip:string}>`, `reviewStatusMeta(status)`, `filterCatalog(rows, q)` (búsqueda de texto client-side por advisor_name/review_scope_es).

- [ ] **Step 1: Test en `src/lib/waf.test.ts`**

```ts
import { reviewStatusMeta, filterCatalog } from "@/lib/waf";
import type { WafCanonical } from "@/types";

const canon = (over: Partial<WafCanonical>): WafCanonical => ({
  canonical_id: 1, advisor_name: "Enable MFA", advisor_category: "Security", pillar_number: 2,
  review_scope_es: "MFA admins", benefit_es: "", client_action_es: "", bit_action_es: "",
  is_excluded: false, exclusion_reason: null, consolidates_to_id: null, ai_review_status: "pending",
  ai_decision: null, ai_confidence: null, ai_possible_additional_cost: false, ai_cost_reason: null,
  ai_exclusion_reason: null, ai_duplicate_group_key: null, ai_reviewed_at: null, created_at: "", updated_at: "", ...over,
});

describe("catálogo helpers", () => {
  it("reviewStatusMeta mapea pending", () => { expect(reviewStatusMeta("pending").label).toMatch(/pendiente/i); });
  it("filterCatalog filtra por nombre o ámbito (case-insensitive)", () => {
    const rows = [canon({ canonical_id: 1, advisor_name: "Enable MFA" }), canon({ canonical_id: 2, advisor_name: "Backups", review_scope_es: "geo" })];
    expect(filterCatalog(rows, "mfa").map((r) => r.canonical_id)).toEqual([1]);
    expect(filterCatalog(rows, "GEO").map((r) => r.canonical_id)).toEqual([2]);
    expect(filterCatalog(rows, "")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Correr (RED)** `npx vitest run src/lib/waf.test.ts`
- [ ] **Step 3: Implementar en `src/lib/waf.ts`** (agregar al final; ampliar el `import type` con `WafCanonical`)

```ts
export const REVIEW_STATUS_META: Record<string, { label: string; chip: string }> = {
  pending: { label: "Pendiente", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  reviewed: { label: "Revisada", chip: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" },
  applied: { label: "Aplicada", chip: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" },
  requires_review: { label: "Requiere revisión", chip: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  excluded: { label: "Excluida", chip: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
};
export function reviewStatusMeta(status: string | null): { label: string; chip: string } {
  return REVIEW_STATUS_META[status ?? ""] ?? { label: status ?? "—", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
}
export function filterCatalog(rows: WafCanonical[], q: string): WafCanonical[] {
  const s = q.trim().toLowerCase();
  if (!s) return rows;
  return rows.filter((r) =>
    (r.advisor_name ?? "").toLowerCase().includes(s) || (r.review_scope_es ?? "").toLowerCase().includes(s));
}
```

- [ ] **Step 4: Correr (GREEN)** y `npx tsc -b` limpio.
- [ ] **Step 5: Commit** `git commit -m "feat(waf): helpers de catálogo (estado de revisión + búsqueda)"`

---

### Task 3: `CanonicalEditDialog` (editor + IA)

**Files:** Create `src/components/waf/CanonicalEditDialog.tsx`; Test `src/components/waf/CanonicalEditDialog.test.tsx`.

**Produces:** `CanonicalEditDialog({ open, canonical, onOpenChange, onSaved }: { open: boolean; canonical: WafCanonical | null; onOpenChange: (o:boolean)=>void; onSaved: ()=>void })`. Campos editables (pilar, estado de revisión, ámbito/beneficio/acción cliente/acción BIT, excluida+motivo). Botones: "Analizar con IA" (`analyzeWafCanonical` → muestra la sugerencia), "Aplicar sugerencia" (`applyWafSuggestion` → onSaved), "Guardar cambios" (`updateWafCanonical` → onSaved). Toasts; cierra al guardar/aplicar.

- [ ] **Step 1: Test `src/components/waf/CanonicalEditDialog.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  analyzeWafCanonical: vi.fn(async () => ({ canonical_id: 1, suggestion: { decision: "include", possible_additional_cost: false, cost_reason: "", duplicate_group_key: "", pillar_number: 2, review_scope_es: "MFA admins (IA)", benefit_es: "b", client_action_es: "c", bit_action_es: "d", exclusion_reason: "", confidence: 0.9, raw_model_text: "" } })),
  applyWafSuggestion: vi.fn(async () => ({ message: "ok", canonical_id: 1 })),
  updateWafCanonical: vi.fn(async () => ({ message: "ok", canonical_id: 1 })),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const canonical = {
  canonical_id: 1, advisor_name: "Enable MFA", advisor_category: "Security", pillar_number: 2,
  review_scope_es: "MFA admins", benefit_es: "b", client_action_es: "c", bit_action_es: "d",
  is_excluded: false, exclusion_reason: null, consolidates_to_id: null, ai_review_status: "pending",
  ai_decision: null, ai_confidence: null, ai_possible_additional_cost: false, ai_cost_reason: null,
  ai_exclusion_reason: null, ai_duplicate_group_key: null, ai_reviewed_at: null, created_at: "", updated_at: "",
};

beforeEach(() => vi.clearAllMocks());

test("guardar cambios llama updateWafCanonical", async () => {
  const { default: CanonicalEditDialog } = await import("@/components/waf/CanonicalEditDialog");
  const { updateWafCanonical } = await import("@/lib/api");
  const onSaved = vi.fn();
  render(<CanonicalEditDialog open canonical={canonical} onOpenChange={() => {}} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
  await waitFor(() => expect(updateWafCanonical).toHaveBeenCalledWith(1, expect.objectContaining({ review_scope_es: "MFA admins" })));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
});

test("analizar con IA muestra la sugerencia y permite aplicarla", async () => {
  const { default: CanonicalEditDialog } = await import("@/components/waf/CanonicalEditDialog");
  const { analyzeWafCanonical, applyWafSuggestion } = await import("@/lib/api");
  const onSaved = vi.fn();
  render(<CanonicalEditDialog open canonical={canonical} onOpenChange={() => {}} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("button", { name: /analizar con ia/i }));
  await waitFor(() => expect(analyzeWafCanonical).toHaveBeenCalledWith(1));
  await waitFor(() => expect(screen.getByText(/MFA admins \(IA\)/)).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /aplicar sugerencia/i }));
  await waitFor(() => expect(applyWafSuggestion).toHaveBeenCalled());
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
});
```

- [ ] **Step 2: Correr (RED)** `npx vitest run src/components/waf/CanonicalEditDialog.test.tsx`
- [ ] **Step 3: Implementar `src/components/waf/CanonicalEditDialog.tsx`**

```tsx
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { analyzeWafCanonical, applyWafSuggestion, updateWafCanonical } from "@/lib/api";
import type { WafCanonical, WafAiSuggestion, WafCanonicalUpdate } from "@/types";

const PILLARS = [1, 2, 3, 4, 5];
const REVIEW = ["pending", "reviewed", "applied", "requires_review", "excluded"];
function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

export default function CanonicalEditDialog({ open, canonical, onOpenChange, onSaved }: {
  open: boolean; canonical: WafCanonical | null; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const [pillar, setPillar] = useState("2");
  const [status, setStatus] = useState("pending");
  const [scope, setScope] = useState("");
  const [benefit, setBenefit] = useState("");
  const [clientAction, setClientAction] = useState("");
  const [bitAction, setBitAction] = useState("");
  const [excluded, setExcluded] = useState(false);
  const [reason, setReason] = useState("");
  const [suggestion, setSuggestion] = useState<WafAiSuggestion | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !canonical) return;
    setPillar(String(canonical.pillar_number));
    setStatus(canonical.ai_review_status || "pending");
    setScope(canonical.review_scope_es ?? "");
    setBenefit(canonical.benefit_es ?? "");
    setClientAction(canonical.client_action_es ?? "");
    setBitAction(canonical.bit_action_es ?? "");
    setExcluded(canonical.is_excluded);
    setReason(canonical.exclusion_reason ?? "");
    setSuggestion(null);
  }, [open, canonical]);

  if (!canonical) return null;

  async function doAnalyze() {
    setBusy(true);
    try {
      const r = await analyzeWafCanonical(canonical!.canonical_id);
      setSuggestion(r.suggestion);
      toast.success("Análisis IA listo");
    } catch (e) { toast.error(`Error al analizar: ${msg(e)}`); }
    finally { setBusy(false); }
  }
  async function doApply() {
    if (!suggestion) return;
    setBusy(true);
    try {
      await applyWafSuggestion(canonical!.canonical_id, suggestion);
      toast.success("Sugerencia IA aplicada");
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error(`Error al aplicar: ${msg(e)}`); }
    finally { setBusy(false); }
  }
  async function doSave() {
    const body: WafCanonicalUpdate = {
      pillar_number: Number(pillar), review_scope_es: scope, benefit_es: benefit,
      client_action_es: clientAction, bit_action_es: bitAction, is_excluded: excluded,
      exclusion_reason: excluded ? reason : null, ai_review_status: status,
    };
    setBusy(true);
    try {
      await updateWafCanonical(canonical!.canonical_id, body);
      toast.success("Catálogo actualizado");
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error(`Error al guardar: ${msg(e)}`); }
    finally { setBusy(false); }
  }

  const field = (label: string, value: string, set: (v: string) => void) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea rows={2} value={value} onChange={(e) => set(e.target.value)} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{canonical.advisor_name}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{canonical.advisor_category}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Pilar</Label>
            <Select value={pillar} onValueChange={setPillar}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PILLARS.map((p) => <SelectItem key={p} value={String(p)}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Estado de revisión</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REVIEW.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {field("Ámbito", scope, setScope)}
        {field("Beneficio", benefit, setBenefit)}
        {field("Acción del cliente", clientAction, setClientAction)}
        {field("Acción Business IT", bitAction, setBitAction)}
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={excluded} onChange={(e) => setExcluded(e.target.checked)} /> Excluir del catálogo
        </label>
        {excluded && field("Motivo de exclusión", reason, setReason)}

        {suggestion && (
          <div className="rounded-lg border border-border bg-secondary p-3 text-sm space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Sugerencia IA · decisión: {suggestion.decision} · confianza {Math.round((suggestion.confidence ?? 0) * 100)}%</div>
            <div><span className="text-muted-foreground text-xs">Ámbito: </span>{suggestion.review_scope_es}</div>
            <div><span className="text-muted-foreground text-xs">Beneficio: </span>{suggestion.benefit_es}</div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={doAnalyze}>Analizar con IA</Button>
          {suggestion && <Button type="button" variant="outline" disabled={busy} onClick={doApply}>Aplicar sugerencia</Button>}
          <Button type="button" disabled={busy} onClick={doSave}>Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Correr (GREEN)** `npx vitest run src/components/waf/CanonicalEditDialog.test.tsx`; `npx tsc -b` + `npm run lint` limpios.
- [ ] **Step 5: Commit** `git commit -m "feat(waf): diálogo editor de canónica (IA + guardar)"`

---

### Task 4: `ValidationPage` + batch + ruteo + menú

**Files:** Create `src/components/waf/ValidationPage.tsx`; Modify `src/App.tsx`, `src/components/AppShell.tsx`; Test `src/components/waf/ValidationPage.test.tsx`.

**Produces:** `ValidationPage({ onNavigate })`. Tarjeta de config IA (`getWafAiConfig`), filtros (búsqueda texto + estado de revisión + excluidas), tabla del catálogo (`getWafCatalog`) con "Revisar" → `CanonicalEditDialog`, y botón "Analizar y aplicar pendientes" (batch: itera `analyzeAllWafCanonicals({limit:50, apply:true})` hasta `total===0` o `processed===0`, máx 20 iteraciones, con `BusyOverlay` de progreso). Admin-only (aviso si no admin).

- [ ] **Step 1: Test `src/components/waf/ValidationPage.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  getWafAiConfig: vi.fn(async () => ({ configured: true, deployment: "gpt-4o", api_version: "2024-02-01", has_key: true })),
  getWafCatalog: vi.fn(async () => [
    { canonical_id: 1, advisor_name: "Enable MFA", advisor_category: "Security", pillar_number: 2, review_scope_es: "MFA admins", benefit_es: "", client_action_es: "", bit_action_es: "", is_excluded: false, exclusion_reason: null, consolidates_to_id: null, ai_review_status: "pending", ai_decision: null, ai_confidence: null, ai_possible_additional_cost: false, ai_cost_reason: null, ai_exclusion_reason: null, ai_duplicate_group_key: null, ai_reviewed_at: null, created_at: "", updated_at: "" },
  ]),
  analyzeAllWafCanonicals: vi.fn(async () => ({ total: 0, processed: 0, applied: 0, errors: [] })),
}));
vi.mock("@/lib/auth", () => ({ getRole: () => "admin" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

test("muestra config IA y catálogo; abre el editor", async () => {
  const { default: ValidationPage } = await import("@/components/waf/ValidationPage");
  render(<ThemeProvider attribute="class" defaultTheme="light"><ValidationPage /></ThemeProvider>);
  await waitFor(() => expect(screen.getByText("Enable MFA")).toBeInTheDocument());
  expect(screen.getByText(/gpt-4o/i)).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: /revisar/i })[0]);
  expect(await screen.findByRole("button", { name: /guardar cambios/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Correr (RED)** `npx vitest run src/components/waf/ValidationPage.test.tsx`
- [ ] **Step 3: Implementar `src/components/waf/ValidationPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CanonicalEditDialog from "@/components/waf/CanonicalEditDialog";
import { getWafAiConfig, getWafCatalog, analyzeAllWafCanonicals } from "@/lib/api";
import { reviewStatusMeta, filterCatalog } from "@/lib/waf";
import { getRole } from "@/lib/auth";
import type { WafAiConfig, WafCanonical } from "@/types";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

export default function ValidationPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const isAdmin = getRole() === "admin";
  const [config, setConfig] = useState<WafAiConfig | null>(null);
  const [rows, setRows] = useState<WafCanonical[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [excludedFilter, setExcludedFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyMsg, setBusyMsg] = useState("");
  const [editing, setEditing] = useState<WafCanonical | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function load() {
    setLoading(true);
    const params: { review_status?: string; excluded?: boolean } = {};
    if (statusFilter !== "all") params.review_status = statusFilter;
    if (excludedFilter !== "all") params.excluded = excludedFilter === "excluded";
    getWafCatalog(params).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }
  useEffect(() => { if (isAdmin) getWafAiConfig().then(setConfig).catch(() => setConfig(null)); }, [isAdmin]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isAdmin) load(); }, [statusFilter, excludedFilter, isAdmin]);

  async function runBatch() {
    setBusyMsg("Analizando y aplicando pendientes…");
    let applied = 0;
    try {
      for (let i = 0; i < 20; i++) {
        const r = await analyzeAllWafCanonicals({ limit: 50, apply: true });
        applied += r.applied;
        if (r.total === 0 || r.processed === 0) break;
      }
      toast.success(`Curación IA: ${applied} aplicada${applied === 1 ? "" : "s"}`);
      load();
    } catch (e) { toast.error(`Error en la curación: ${msg(e)}`); }
    finally { setBusyMsg(""); }
  }

  function openEditor(c: WafCanonical) { setEditing(c); setDialogOpen(true); }

  if (!isAdmin) {
    return (
      <AppShell title="Validación inteligente" subtitle="Matriz mejoras Azure" active="waf-validation" onNavigate={onNavigate}>
        <p className="text-sm text-muted-foreground">Esta sección es solo para administradores.</p>
      </AppShell>
    );
  }

  const filtered = filterCatalog(rows, q);
  return (
    <AppShell title="Validación inteligente" subtitle="Matriz mejoras Azure · curación IA del catálogo"
      active="waf-validation" onNavigate={onNavigate}
      headerRight={<Button size="sm" disabled={!!busyMsg} onClick={runBatch}>Analizar y aplicar pendientes</Button>}>
      <BusyOverlay show={loading || !!busyMsg} title={busyMsg || "Cargando catálogo"} />
      <div className="space-y-5">
        <div className="rounded-xl bg-secondary p-4 text-sm flex flex-wrap gap-x-6 gap-y-1">
          <span className="text-muted-foreground">Azure OpenAI: <span className={config?.configured ? "text-[#5a7016] dark:text-[#a9c46a]" : "text-destructive"}>{config?.configured ? "configurado" : "no configurado"}</span></span>
          {config?.deployment && <span className="text-muted-foreground">Deployment: <span className="text-foreground">{config.deployment}</span></span>}
          {config?.api_version && <span className="text-muted-foreground">API: <span className="text-foreground">{config.api_version}</span></span>}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="w-[220px]" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="reviewed">Revisada</SelectItem>
              <SelectItem value="applied">Aplicada</SelectItem>
              <SelectItem value="requires_review">Requiere revisión</SelectItem>
              <SelectItem value="excluded">Excluida</SelectItem>
            </SelectContent>
          </Select>
          <Select value={excludedFilter} onValueChange={setExcludedFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Activas + excluidas</SelectItem>
              <SelectItem value="active">Solo activas</SelectItem>
              <SelectItem value="excluded">Solo excluidas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>ID</TableHead><TableHead>Nombre Advisor</TableHead><TableHead>Categoría</TableHead>
              <TableHead>Pilar</TableHead><TableHead>Estado</TableHead><TableHead>Costo</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin canónicas.</TableCell></TableRow>
              ) : filtered.map((c) => {
                const m = reviewStatusMeta(c.ai_review_status);
                return (
                  <TableRow key={c.canonical_id}>
                    <TableCell className="tabular-nums">{c.canonical_id}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{c.advisor_name}{c.is_excluded && <span className="ml-2 text-[11px] text-red-600 dark:text-red-400">excluida</span>}</TableCell>
                    <TableCell className="text-muted-foreground">{c.advisor_category}</TableCell>
                    <TableCell className="tabular-nums">{c.pillar_number}</TableCell>
                    <TableCell><span className={`text-xs px-2.5 py-0.5 rounded-full ${m.chip}`}>{m.label}</span></TableCell>
                    <TableCell>{c.ai_possible_additional_cost ? <span className="text-[11px] text-amber-600 dark:text-amber-400">posible</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => openEditor(c)}>Revisar</Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      <CanonicalEditDialog open={dialogOpen} canonical={editing} onOpenChange={setDialogOpen} onSaved={load} />
    </AppShell>
  );
}
```

- [ ] **Step 4: Ruteo + menú**
  - `src/App.tsx`: `import ValidationPage from "@/components/waf/ValidationPage";` y rama `) : section === "waf-validation" ? (<ValidationPage onNavigate={setSection} />`.
  - `src/components/AppShell.tsx`: cambiar `{ label: "Validación inteligente", adminOnly: true, soon: true }` → `{ label: "Validación inteligente", adminOnly: true, section: "waf-validation" }`.

- [ ] **Step 5: Correr (GREEN) + gate completo** `npx vitest run && npx tsc -b && npm run build && npm run lint`.
- [ ] **Step 6: Commit** `git commit -m "feat(waf): vista Validación inteligente (catálogo + batch IA)"`

---

## Self-Review (hecho)
- Cobertura: config IA, filtros (estado/excluidas server-side + texto client-side), tabla del catálogo, editor con analizar/aplicar IA + guardar manual, batch "analizar y aplicar pendientes", admin-gating (menú + aviso en página), ruteo. Cierra el módulo WAF.
- Sin placeholders; código completo. Tipos `WafAiConfig/WafCanonical/WafAiSuggestion/WafCanonicalUpdate/WafAiBatchResult` y firmas de API consistentes entre Tasks 1, 3, 4. Sección `waf-validation` añadida en App.tsx y AppShell. El batch tiene tope de 20 iteraciones (anti-loop) y corta si total/processed = 0.
