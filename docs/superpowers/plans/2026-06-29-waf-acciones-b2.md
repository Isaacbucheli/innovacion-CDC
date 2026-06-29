# WAF Acciones B2 (Importar matriz Excel) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Agregar "Importar matriz Excel" al menú Opciones de WAF Recomendaciones: diálogo de 2 pasos (subir + preview con matching → revisar y aplicar).

**Architecture:** Tipos + 2 funciones de API en `lib/api.ts` (preview multipart + apply JSON), lógica pura de mapeo en `lib/waf.ts`, un componente `ExcelImportDialog` (2 pasos, autónomo: hace preview y apply, toasts, onChanged), y una entrada en el dropdown de `WafActions`.

**Tech Stack:** React, TS, shadcn (Dialog/Button/Label), sonner, Vitest + Testing Library.

## Contrato backend .NET (verificado)
- `POST /waf/clients/{id}/excel-import/preview?use_ai={bool}` — multipart campo `file`. Respuesta: `{ file_name, client_id, rows_total, rows_matched, rows_needs_review, ai_enabled, metrics, rows: [{ row: {row_number, pillar_number, excel_code, title, raw_scope, completion_pct, remediation_start_date, execution_log, benefit, actions, impact, projected_bit_effort, resources[], warnings[], ...}, status: "matched"|"needs_review"|"new", can_create, match_source, confidence, reason, suggested_match: {canonical_id, matrix_code, pillar_number, review_scope_es, advisor_name, ...}|null, candidates[], tracking_updates }] }`.
- `POST /waf/clients/{id}/excel-import/apply` — body `{ rows: [{ row_number, action:"update"|"create", canonical_id?, approved?, completion_pct?, remediation_start_date?, execution_log?, pillar_number?, title?, review_scope?, benefit?, actions?, impact?, projected_bit_effort?, resources? }] }`. Update requiere `canonical_id`; create requiere `pillar_number`+`title`. Respuesta: `{ message, client_id, rows_applied, rows_created, rows_skipped, changed_fields, errors: [{row_number, detail}] }`.
- Rol: cualquiera autenticado (en la UI lo gateamos a `canEdit`, es una escritura).

## Global Constraints
- Front solo al .NET. Multipart como `uploadClientLogo`/`uploadWafIngestion`. Tokens / `dark:`. Español. YAGNI.
- Decisión del usuario: filas `needs_review` → **aprobar/omitir con acción automática** (NO elegir entre candidatos). Acción por fila: si hay `suggested_match` → `update`; si no y `can_create` → `create`; si ninguno → no aplicable (checkbox deshabilitado).
- Default aprobado: `matched`→sí, `new`(can_create)→sí, `needs_review`→no.
- Gating: `Importar matriz Excel` → `canEdit()`. Apply: BusyOverlay inline (botón "Aplicando…") + toast + `onChanged()`.
- Tras cada tarea: lint + build verdes; commits frecuentes.

---

### Task 1: Tipos + API (preview multipart + apply)

**Files:** Modify `src/types.ts`, `src/lib/api.ts`; Test `src/lib/api.test.ts`.

**Interfaces produces:** tipos `WafExcelRow`, `WafExcelSuggestedMatch`, `WafExcelPreviewRow`, `WafExcelPreview`, `WafExcelApplyItem`, `WafExcelApplyRequest`, `WafExcelApplyResult`; funciones `previewWafExcel(clientId, file, useAi)`, `applyWafExcel(clientId, body)`.

- [ ] **Step 1: Tipos en `src/types.ts` (al final)**

```ts
export interface WafExcelRow {
  row_number: number;
  pillar_number: number | null;
  excel_code: string | null;
  title: string | null;
  raw_scope: string | null;
  completion_pct: number | null;
  remediation_start_date: string | null;
  execution_log: string | null;
  benefit: string | null;
  actions: string | null;
  impact: string | null;
  projected_bit_effort: string | null;
  resources: string[];
  warnings: string[];
}
export interface WafExcelSuggestedMatch {
  canonical_id: number;
  matrix_code: string | null;
  pillar_number: number | null;
  review_scope_es: string | null;
  advisor_name: string | null;
}
export interface WafExcelPreviewRow {
  row: WafExcelRow;
  status: "matched" | "needs_review" | "new";
  can_create: boolean;
  match_source: string | null;
  confidence: number | null;
  reason: string | null;
  suggested_match: WafExcelSuggestedMatch | null;
}
export interface WafExcelPreview {
  file_name: string;
  client_id: number;
  rows_total: number;
  rows_matched: number;
  rows_needs_review: number;
  ai_enabled: boolean;
  rows: WafExcelPreviewRow[];
}
export interface WafExcelApplyItem {
  row_number: number;
  action: "update" | "create";
  approved: boolean;
  canonical_id?: number;
  completion_pct?: number | null;
  remediation_start_date?: string | null;
  execution_log?: string | null;
  pillar_number?: number | null;
  title?: string | null;
  review_scope?: string | null;
  benefit?: string | null;
  actions?: string | null;
  impact?: string | null;
  projected_bit_effort?: string | null;
  resources?: string[];
}
export interface WafExcelApplyRequest { rows: WafExcelApplyItem[]; }
export interface WafExcelApplyResult {
  message: string;
  client_id: number;
  rows_applied: number;
  rows_created: number;
  rows_skipped: number;
  changed_fields: Record<string, number>;
  errors: { row_number: number; detail: string }[];
}
```

- [ ] **Step 2: API en `src/lib/api.ts`** (merge `WafExcelApplyRequest`, `WafExcelApplyResult`, `WafExcelPreview` en el `import type` del tope; agregar tras las funciones WAF existentes)

```ts
/** Preview de la matriz Excel (multipart "file", ?use_ai). */
export async function previewWafExcel(clientId: number, file: File, useAi: boolean, base: string = apiBase()): Promise<WafExcelPreview> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${base}/waf/clients/${clientId}/excel-import/preview?use_ai=${useAi}`, { method: "POST", headers, body: form });
  if (res.status === 401) { clearSession(); if (typeof location !== "undefined") location.reload(); throw new Error("Sesión expirada"); }
  const text = await res.text();
  if (!res.ok) { let d = text; try { d = JSON.parse(text).detail ?? text; } catch { /* texto plano */ } throw new Error(d || `HTTP ${res.status}`); }
  return (text ? JSON.parse(text) : {}) as WafExcelPreview;
}
export const applyWafExcel = (clientId: number, body: WafExcelApplyRequest) =>
  request<WafExcelApplyResult>(`/waf/clients/${clientId}/excel-import/apply`, jsonOpts("POST", body));
```

- [ ] **Step 3: Test en `src/lib/api.test.ts`** (bloque WAF)

```ts
it("previewWafExcel postea multipart con use_ai", async () => {
  const spy = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", spy);
  const { previewWafExcel } = await import("@/lib/api");
  await previewWafExcel(3, new File(["x"], "m.xlsx"), true);
  const calls = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls;
  expect(calls[0][0]).toContain("/waf/clients/3/excel-import/preview?use_ai=true");
  expect((calls[0][1] as RequestInit).body).toBeInstanceOf(FormData);
});
it("applyWafExcel postea el body con rows", async () => {
  const spy = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", spy);
  const { applyWafExcel } = await import("@/lib/api");
  await applyWafExcel(3, { rows: [{ row_number: 1, action: "update", approved: true, canonical_id: 9 }] });
  const calls = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls;
  expect(calls[0][0]).toContain("/waf/clients/3/excel-import/apply");
  expect(JSON.parse((calls[0][1] as RequestInit).body as string).rows[0].canonical_id).toBe(9);
});
```

- [ ] **Step 4: Correr** `npx vitest run src/lib/api.test.ts` → PASS; `npx tsc -b` limpio.
- [ ] **Step 5: Commit** `git commit -m "feat(waf): API import Excel (preview multipart + apply)"`

---

### Task 2: Lógica pura de mapeo en `lib/waf.ts`

**Files:** Modify `src/lib/waf.ts`; Test `src/lib/waf.test.ts`.

**Interfaces produces:** `EXCEL_STATUS_META`, `excelRowAction(pr)`, `defaultApproved(pr)`, `buildApplyItem(pr, approved)`, `excelSummary(result)`.

- [ ] **Step 1: Test en `src/lib/waf.test.ts`**

```ts
import { excelRowAction, defaultApproved, buildApplyItem, excelSummary } from "@/lib/waf";
import type { WafExcelPreviewRow, WafExcelApplyResult } from "@/types";

const baseRow = (over: Partial<WafExcelPreviewRow["row"]> = {}): WafExcelPreviewRow["row"] => ({
  row_number: 1, pillar_number: 5, excel_code: "5.1", title: "RI", raw_scope: "scope",
  completion_pct: 80, remediation_start_date: null, execution_log: null, benefit: "b",
  actions: "a", impact: "High", projected_bit_effort: "8h", resources: ["vm1"], warnings: [], ...over,
});
const pr = (over: Partial<WafExcelPreviewRow> = {}): WafExcelPreviewRow => ({
  row: baseRow(), status: "matched", can_create: true, match_source: "deterministic",
  confidence: 0.9, reason: "", suggested_match: { canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "x", advisor_name: "y" }, ...over,
});

describe("excel mapping", () => {
  it("excelRowAction: con suggested_match → update", () => { expect(excelRowAction(pr())).toBe("update"); });
  it("excelRowAction: sin match pero can_create → create", () => {
    expect(excelRowAction(pr({ status: "new", suggested_match: null }))).toBe("create");
  });
  it("excelRowAction: sin match ni can_create → null", () => {
    expect(excelRowAction(pr({ status: "needs_review", suggested_match: null, can_create: false }))).toBeNull();
  });
  it("defaultApproved: matched sí, needs_review no, new sí", () => {
    expect(defaultApproved(pr())).toBe(true);
    expect(defaultApproved(pr({ status: "needs_review", suggested_match: null }))).toBe(false);
    expect(defaultApproved(pr({ status: "new", suggested_match: null }))).toBe(true);
  });
  it("buildApplyItem update lleva canonical_id; create lleva pillar/title", () => {
    const up = buildApplyItem(pr(), true);
    expect(up).toMatchObject({ action: "update", canonical_id: 9, row_number: 1, approved: true });
    const cr = buildApplyItem(pr({ status: "new", suggested_match: null }), true);
    expect(cr).toMatchObject({ action: "create", pillar_number: 5, title: "RI", review_scope: "scope" });
  });
  it("buildApplyItem devuelve null si no hay acción", () => {
    expect(buildApplyItem(pr({ status: "needs_review", suggested_match: null, can_create: false }), true)).toBeNull();
  });
  it("excelSummary arma el texto", () => {
    const r: WafExcelApplyResult = { message: "", client_id: 3, rows_applied: 8, rows_created: 2, rows_skipped: 1, changed_fields: {}, errors: [] };
    const s = excelSummary(r);
    expect(s).toContain("8"); expect(s).toContain("2"); expect(s).toContain("1");
  });
});
```

- [ ] **Step 2: Correr (RED)** `npx vitest run src/lib/waf.test.ts`
- [ ] **Step 3: Implementar en `src/lib/waf.ts`** (agregar al final; ampliar el `import type` de `@/types` con los tipos Excel)

```ts
import type { WafExcelPreviewRow, WafExcelApplyItem, WafExcelApplyResult } from "@/types";

export const EXCEL_STATUS_META: Record<string, { label: string; chip: string }> = {
  matched: { label: "match", chip: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" },
  needs_review: { label: "revisar", chip: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  new: { label: "nueva", chip: "bg-accent text-accent-foreground" },
};

export function excelRowAction(pr: WafExcelPreviewRow): "update" | "create" | null {
  if (pr.suggested_match) return "update";
  if (pr.can_create) return "create";
  return null;
}

export function defaultApproved(pr: WafExcelPreviewRow): boolean {
  if (pr.status === "matched") return true;
  if (pr.status === "new" && pr.can_create) return true;
  return false;
}

export function buildApplyItem(pr: WafExcelPreviewRow, approved: boolean): WafExcelApplyItem | null {
  const action = excelRowAction(pr);
  if (!action) return null;
  const r = pr.row;
  const base = {
    row_number: r.row_number, approved,
    completion_pct: r.completion_pct, remediation_start_date: r.remediation_start_date, execution_log: r.execution_log,
  };
  if (action === "update") {
    return { ...base, action: "update", canonical_id: pr.suggested_match!.canonical_id };
  }
  return {
    ...base, action: "create",
    pillar_number: r.pillar_number, title: r.title, review_scope: r.raw_scope,
    benefit: r.benefit, actions: r.actions, impact: r.impact,
    projected_bit_effort: r.projected_bit_effort, resources: r.resources,
  };
}

export function excelSummary(r: WafExcelApplyResult): string {
  return `${r.rows_applied} aplicada${r.rows_applied === 1 ? "" : "s"} · ${r.rows_created} creada${r.rows_created === 1 ? "" : "s"} · ${r.rows_skipped} omitida${r.rows_skipped === 1 ? "" : "s"}`;
}
```

- [ ] **Step 4: Correr (GREEN)** y `npx tsc -b` limpio.
- [ ] **Step 5: Commit** `git commit -m "feat(waf): mapeo preview→apply de import Excel (lógica pura)"`

---

### Task 3: `ExcelImportDialog` (2 pasos)

**Files:** Create `src/components/waf/ExcelImportDialog.tsx`; Test `src/components/waf/ExcelImportDialog.test.tsx`.

**Interfaces produces:** `ExcelImportDialog({ open, clientId, onOpenChange, onChanged }: { open: boolean; clientId: number; onOpenChange: (o: boolean) => void; onChanged: () => void })`. Paso 1: archivo + use_ai → `previewWafExcel`. Paso 2: tabla de filas con checkbox (default según `defaultApproved`, deshabilitado si no hay acción), badge de estado, acción propuesta → `applyWafExcel` con los `buildApplyItem` aprobados → toast + onChanged + cerrar.

- [ ] **Step 1: Test `src/components/waf/ExcelImportDialog.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  previewWafExcel: vi.fn(async () => ({
    file_name: "m.xlsx", client_id: 3, rows_total: 2, rows_matched: 1, rows_needs_review: 0, ai_enabled: true,
    rows: [
      { row: { row_number: 1, pillar_number: 5, excel_code: "5.1", title: "RI", raw_scope: "s", completion_pct: 80, remediation_start_date: null, execution_log: null, benefit: "b", actions: "a", impact: "High", projected_bit_effort: "8h", resources: [], warnings: [] }, status: "matched", can_create: true, match_source: "deterministic", confidence: 0.9, reason: "", suggested_match: { canonical_id: 9, matrix_code: "5.1", pillar_number: 5, review_scope_es: "x", advisor_name: "y" } },
      { row: { row_number: 2, pillar_number: 1, excel_code: "1.7", title: "Probes", raw_scope: "s2", completion_pct: 0, remediation_start_date: null, execution_log: null, benefit: "b", actions: "a", impact: "Low", projected_bit_effort: "", resources: [], warnings: [] }, status: "new", can_create: true, match_source: null, confidence: null, reason: "", suggested_match: null },
    ],
  })),
  applyWafExcel: vi.fn(async () => ({ message: "ok", client_id: 3, rows_applied: 1, rows_created: 1, rows_skipped: 0, changed_fields: {}, errors: [] })),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

test("genera preview, muestra filas y aplica las aprobadas", async () => {
  const { default: ExcelImportDialog } = await import("@/components/waf/ExcelImportDialog");
  const { applyWafExcel } = await import("@/lib/api");
  const onChanged = vi.fn();
  render(<ExcelImportDialog open clientId={3} onOpenChange={() => {}} onChanged={onChanged} />);
  // paso 1: elegir archivo + generar preview
  fireEvent.change(screen.getByLabelText(/archivo excel/i), { target: { files: [new File(["x"], "m.xlsx")] } });
  fireEvent.click(screen.getByRole("button", { name: /generar preview/i }));
  // paso 2: ver filas
  await waitFor(() => expect(screen.getByText("RI")).toBeInTheDocument());
  expect(screen.getByText("Probes")).toBeInTheDocument();
  // aplicar
  fireEvent.click(screen.getByRole("button", { name: /aplicar/i }));
  await waitFor(() => expect(applyWafExcel).toHaveBeenCalled());
  const body = (applyWafExcel as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
  expect(body.rows).toHaveLength(2); // ambas aprobadas por defecto (matched + new)
  expect(body.rows[0]).toMatchObject({ action: "update", canonical_id: 9 });
  expect(body.rows[1]).toMatchObject({ action: "create", pillar_number: 1 });
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});
```

- [ ] **Step 2: Correr (RED)** `npx vitest run src/components/waf/ExcelImportDialog.test.tsx`
- [ ] **Step 3: Implementar `src/components/waf/ExcelImportDialog.tsx`**

```tsx
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { previewWafExcel, applyWafExcel } from "@/lib/api";
import { excelRowAction, defaultApproved, buildApplyItem, excelSummary, EXCEL_STATUS_META } from "@/lib/waf";
import type { WafExcelPreview, WafExcelApplyItem } from "@/types";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

export default function ExcelImportDialog({ open, clientId, onOpenChange, onChanged }: {
  open: boolean; clientId: number; onOpenChange: (o: boolean) => void; onChanged: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [useAi, setUseAi] = useState(true);
  const [preview, setPreview] = useState<WafExcelPreview | null>(null);
  const [approved, setApproved] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setFile(null); setUseAi(true); setPreview(null); setApproved({}); setBusy(false); }
  }, [open]);

  async function doPreview() {
    if (!file) return;
    setBusy(true);
    try {
      const p = await previewWafExcel(clientId, file, useAi);
      const init: Record<number, boolean> = {};
      for (const pr of p.rows) init[pr.row.row_number] = defaultApproved(pr);
      setPreview(p);
      setApproved(init);
    } catch (e) {
      toast.error(`Error generando preview: ${msg(e)}`);
    } finally { setBusy(false); }
  }

  async function doApply() {
    if (!preview) return;
    const items: WafExcelApplyItem[] = [];
    for (const pr of preview.rows) {
      if (!approved[pr.row.row_number]) continue;
      const item = buildApplyItem(pr, true);
      if (item) items.push(item);
    }
    if (items.length === 0) { toast.error("No hay filas seleccionadas aplicables."); return; }
    setBusy(true);
    try {
      const r = await applyWafExcel(clientId, { rows: items });
      toast.success(`Importación aplicada · ${excelSummary(r)}`);
      onChanged();
      onOpenChange(false);
    } catch (e) {
      toast.error(`Error aplicando: ${msg(e)}`);
    } finally { setBusy(false); }
  }

  const newCount = preview ? preview.rows.filter((p) => p.status === "new").length : 0;
  const selectedCount = preview ? preview.rows.filter((p) => approved[p.row.row_number] && excelRowAction(p)).length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar matriz Excel</DialogTitle></DialogHeader>
        {!preview ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Sube la matriz WAF (.xlsx). Se cruza con el catálogo antes de aplicar.</p>
            <div className="space-y-1.5">
              <Label htmlFor="xlsx">Archivo Excel</Label>
              <input id="xlsx" type="file" accept=".xlsx" className="block w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} /> Usar IA para el matching (Azure OpenAI)
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="button" disabled={!file || busy} onClick={doPreview}>{busy ? "Generando…" : "Generar preview"}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap text-[11px]">
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200">{preview.rows_matched} match</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">{preview.rows_needs_review} revisar</span>
              <span className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{newCount} nuevas</span>
            </div>
            <div className="border rounded-lg overflow-auto max-h-[50vh]">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="p-2 w-8"></th><th className="p-2">Fila</th><th className="p-2">Estado</th><th className="p-2">Acción</th>
                </tr></thead>
                <tbody>
                  {preview.rows.map((pr) => {
                    const action = excelRowAction(pr);
                    const meta = EXCEL_STATUS_META[pr.status];
                    return (
                      <tr key={pr.row.row_number} className="border-b">
                        <td className="p-2"><input type="checkbox" disabled={!action} checked={!!approved[pr.row.row_number]}
                          onChange={(e) => setApproved((m) => ({ ...m, [pr.row.row_number]: e.target.checked }))} /></td>
                        <td className="p-2"><div className="font-medium">{pr.row.excel_code || `Fila ${pr.row.row_number}`}</div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">{pr.row.title}</div></td>
                        <td className="p-2"><span className={`text-[11px] px-2 py-0.5 rounded-full ${meta.chip}`}>{meta.label}</span></td>
                        <td className="p-2 text-[12px]">
                          {action === "update" ? <>Actualizar <strong>#{pr.suggested_match?.matrix_code}</strong></>
                            : action === "create" ? `Crear nueva (pilar ${pr.row.pillar_number ?? "?"})`
                            : <span className="text-muted-foreground">no aplicable</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPreview(null)}>Atrás</Button>
              <Button type="button" disabled={busy || selectedCount === 0} onClick={doApply}>{busy ? "Aplicando…" : `Aplicar ${selectedCount} seleccionadas`}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Correr (GREEN)** `npx vitest run src/components/waf/ExcelImportDialog.test.tsx`; `npx tsc -b` + `npm run lint` limpios.
- [ ] **Step 5: Commit** `git commit -m "feat(waf): diálogo Importar matriz Excel (preview + aplicar)"`

---

### Task 4: Añadir "Importar matriz Excel" a `WafActions`

**Files:** Modify `src/components/waf/WafActions.tsx`, `src/components/waf/WafActions.test.tsx`.

**Interfaces consumes:** `ExcelImportDialog` (Task 3).

- [ ] **Step 1: Test — extender `src/components/waf/WafActions.test.tsx`**

Agregar al `vi.mock("@/lib/api", …)` existente: `previewWafExcel: vi.fn(async () => ({ file_name: "m.xlsx", client_id: 3, rows_total: 0, rows_matched: 0, rows_needs_review: 0, ai_enabled: true, rows: [] })), applyWafExcel: vi.fn()`. Agregar test:
```tsx
test("Importar matriz Excel abre el diálogo de preview", async () => {
  const { default: WafActions } = await import("@/components/waf/WafActions");
  render(<WafActions clientId={3} onChanged={vi.fn()} />);
  fireEvent.pointerDown(screen.getByRole("button", { name: /opciones/i }));
  fireEvent.click(screen.getByRole("button", { name: /opciones/i }));
  fireEvent.click(await screen.findByText(/importar matriz excel/i));
  expect(await screen.findByText(/sube la matriz waf/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Correr (RED)** `npx vitest run src/components/waf/WafActions.test.tsx`

- [ ] **Step 3: Implementar en `src/components/waf/WafActions.tsx`**

Import: `import ExcelImportDialog from "@/components/waf/ExcelImportDialog";`
Estado: `const [excelOpen, setExcelOpen] = useState(false);`
En el dropdown, dentro de la sección "Cargar datos", tras "Importar Advisor CSV":
```tsx
            {editable && <DropdownMenuItem onClick={() => setExcelOpen(true)}>Importar matriz Excel</DropdownMenuItem>}
```
Render del diálogo junto a los otros:
```tsx
      <ExcelImportDialog open={excelOpen} clientId={clientId} onOpenChange={setExcelOpen} onChanged={onChanged} />
```

- [ ] **Step 4: Correr (GREEN) + gate completo** `npx vitest run && npx tsc -b && npm run build && npm run lint` — todo verde, sin lint nuevos.
- [ ] **Step 5: Commit** `git commit -m "feat(waf): Importar matriz Excel en Opciones"`

---

## Verificación en vivo (con OK del usuario)
- DEV con el .NET local + un .xlsx de matriz: Generar preview (match/revisar/nuevas), revisar checkboxes (needs_review viene desmarcada), Aplicar → toast con aplicadas/creadas/omitidas → recarga. Verificar gating (lector no ve Opciones). Deploy con OK.

## Self-Review (hecho)
- Cobertura: preview multipart + apply (Tasks 1), mapeo y acción automática + default-approved + summary (Task 2), diálogo 2 pasos con tabla/checkboxes (Task 3), ítem en Opciones gated canEdit (Task 4). Decisión del usuario respetada (aprobar/omitir, sin elegir candidatos). Fuera de alcance: nada extra.
- Sin placeholders; código completo. Tipos `WafExcelPreview*`/`WafExcelApplyItem`/`WafExcelApplyResult` y firmas `previewWafExcel(clientId,file,useAi)`/`applyWafExcel(clientId,{rows})`/`buildApplyItem(pr,approved)`/`excelSummary(r)` consistentes entre Tasks 1–3.
