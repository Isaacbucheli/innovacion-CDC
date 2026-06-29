# WAF Acciones B1 (Consolidar duplicados + Actualizar Advisor Score) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Agregar al menú "Opciones" de WAF Recomendaciones dos acciones de mantenimiento: Consolidar duplicados y Actualizar Advisor Score, con sus diálogos de confirmación.

**Architecture:** Igual que Slice A: funciones de API en `lib/api.ts`, dos diálogos de confirmación (`ConsolidateDialog`, `AdvisorScoreDialog`) y nuevas entradas en el dropdown de `WafActions` (sección "Mantenimiento") con su gating, busy/overlay y toasts. Diseño aprobado por mockup.

**Tech Stack:** React, TS, shadcn (Dialog, DropdownMenu, Button), sonner, Vitest + Testing Library.

## Contrato backend .NET (verificado 2026-06-29)
- `POST /waf/clients/{id}/consolidate-duplicates?use_ai={bool}` → rol **admin o consultor** (`Roles.Editors`). Respuesta: `{ message, client_id, merged, ai_calls }`.
- `POST /waf/admin/advisor-score/refresh` body `{ client_id?: number, include_in_reports?: bool }` → **solo admin**. Respuesta: `{ message, clients_total, clients_refreshed, clients_failed, results: [{ client_id, status, snapshot_date, captured_at, subscriptions_scored }] }`.

## Global Constraints
- Front solo al .NET vía `request<T>`. Tokens / `dark:` (claro y oscuro). Español. YAGNI (solo estas 2 acciones; NO Excel import — ese es B2).
- Gating: Consolidar duplicados → `canEdit()` (admin/consultor). Actualizar Advisor Score → `getRole() === "admin"`.
- Cada acción: `BusyOverlay` + toast; al éxito → `onChanged()` (reloadData) para refrescar KPIs/pilares (el Score cambia tras refresh).
- Tras cada tarea: `npm run lint` y `npm run build` verdes; commits frecuentes.

---

### Task 1: Tipos + API (consolidate + advisor-score refresh)

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/api.ts`
- Test: `src/lib/api.test.ts`

**Interfaces:**
- Produces: tipos `WafConsolidateResult`, `WafScoreRefreshResult`; funciones `consolidateWafDuplicates(clientId, useAi)`, `refreshWafAdvisorScore(clientId, includeInReports)`.

- [ ] **Step 1: Tipos en `src/types.ts` (al final)**

```ts
/** Resultado de consolidar duplicados (POST /waf/clients/{id}/consolidate-duplicates). */
export interface WafConsolidateResult {
  message: string;
  client_id: number;
  merged: number;
  ai_calls: number;
}

/** Resultado de refrescar Advisor Score (POST /waf/admin/advisor-score/refresh). */
export interface WafScoreRefreshResult {
  message: string;
  clients_total: number;
  clients_refreshed: number;
  clients_failed: number;
  results: { client_id: number; status: string; snapshot_date: string | null; captured_at: string | null; subscriptions_scored: number }[];
}
```

- [ ] **Step 2: API en `src/lib/api.ts`** (merge `WafConsolidateResult`, `WafScoreRefreshResult` en el `import type` del tope; agregar tras `runWafAdvisorSync`/`uploadWafIngestion`)

```ts
export const consolidateWafDuplicates = (clientId: number, useAi: boolean) =>
  request<WafConsolidateResult>(`/waf/clients/${clientId}/consolidate-duplicates?use_ai=${useAi}`, { method: "POST" });
export const refreshWafAdvisorScore = (clientId: number, includeInReports: boolean) =>
  request<WafScoreRefreshResult>(`/waf/admin/advisor-score/refresh`, jsonOpts("POST", { client_id: clientId, include_in_reports: includeInReports }));
```

- [ ] **Step 3: Test en `src/lib/api.test.ts`** (dentro del bloque WAF)

```ts
it("consolidateWafDuplicates POST con use_ai en la query", async () => {
  const spy = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", spy);
  const { consolidateWafDuplicates } = await import("@/lib/api");
  await consolidateWafDuplicates(3, true);
  const calls = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls;
  expect(calls[0][0]).toContain("/waf/clients/3/consolidate-duplicates?use_ai=true");
  expect((calls[0][1] as RequestInit).method).toBe("POST");
});

it("refreshWafAdvisorScore POST con client_id en el body", async () => {
  const spy = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", spy);
  const { refreshWafAdvisorScore } = await import("@/lib/api");
  await refreshWafAdvisorScore(3, false);
  const calls = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls;
  expect(calls[0][0]).toContain("/waf/admin/advisor-score/refresh");
  expect(JSON.parse((calls[0][1] as RequestInit).body as string)).toEqual({ client_id: 3, include_in_reports: false });
});
```

- [ ] **Step 4: Correr** `npx vitest run src/lib/api.test.ts` → PASS. `npx tsc -b` limpio.
- [ ] **Step 5: Commit** `git commit -m "feat(waf): API consolidar duplicados + refrescar Advisor Score"`

---

### Task 2: `ConsolidateDialog`

**Files:**
- Create: `src/components/waf/ConsolidateDialog.tsx`
- Test: `src/components/waf/ConsolidateDialog.test.tsx`

**Interfaces:**
- Produces: `ConsolidateDialog({ open, busy, onOpenChange, onConfirm }: { open: boolean; busy?: boolean; onOpenChange: (o: boolean) => void; onConfirm: (useAi: boolean) => void })`. El diálogo confirma con un checkbox "usar IA" (default true); `onConfirm(useAi)`. La llamada API la hace el padre.

- [ ] **Step 1: Test `src/components/waf/ConsolidateDialog.test.tsx`**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import ConsolidateDialog from "@/components/waf/ConsolidateDialog";

test("confirma con use_ai true por defecto", () => {
  const onConfirm = vi.fn();
  render(<ConsolidateDialog open onOpenChange={() => {}} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByRole("button", { name: /consolidar/i }));
  expect(onConfirm).toHaveBeenCalledWith(true);
});

test("permite desactivar la IA", () => {
  const onConfirm = vi.fn();
  render(<ConsolidateDialog open onOpenChange={() => {}} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByLabelText(/usar ia/i));
  fireEvent.click(screen.getByRole("button", { name: /consolidar/i }));
  expect(onConfirm).toHaveBeenCalledWith(false);
});
```

- [ ] **Step 2: Correr (RED)** `npx vitest run src/components/waf/ConsolidateDialog.test.tsx`
- [ ] **Step 3: Implementar `src/components/waf/ConsolidateDialog.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function ConsolidateDialog({ open, busy, onOpenChange, onConfirm }: {
  open: boolean; busy?: boolean; onOpenChange: (o: boolean) => void; onConfirm: (useAi: boolean) => void;
}) {
  const [useAi, setUseAi] = useState(true);
  useEffect(() => { if (open) setUseAi(true); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Consolidar duplicados</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Detecta y fusiona recomendaciones equivalentes de este cliente. La acción no se puede deshacer fácilmente.</p>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
          Usar IA para agrupar (Azure OpenAI)
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={busy} onClick={() => onConfirm(useAi)}>Consolidar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Correr (GREEN)** y `npx tsc -b` limpio.
- [ ] **Step 5: Commit** `git commit -m "feat(waf): diálogo Consolidar duplicados"`

---

### Task 3: `AdvisorScoreDialog`

**Files:**
- Create: `src/components/waf/AdvisorScoreDialog.tsx`
- Test: `src/components/waf/AdvisorScoreDialog.test.tsx`

**Interfaces:**
- Produces: `AdvisorScoreDialog({ open, busy, onOpenChange, onConfirm }: { open: boolean; busy?: boolean; onOpenChange: (o: boolean) => void; onConfirm: (includeInReports: boolean) => void })`. Checkbox "Incluir en informes" (default false); `onConfirm(includeInReports)`.

- [ ] **Step 1: Test `src/components/waf/AdvisorScoreDialog.test.tsx`**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import AdvisorScoreDialog from "@/components/waf/AdvisorScoreDialog";

test("confirma con include_in_reports false por defecto", () => {
  const onConfirm = vi.fn();
  render(<AdvisorScoreDialog open onOpenChange={() => {}} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByRole("button", { name: /actualizar/i }));
  expect(onConfirm).toHaveBeenCalledWith(false);
});

test("permite incluir en informes", () => {
  const onConfirm = vi.fn();
  render(<AdvisorScoreDialog open onOpenChange={() => {}} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByLabelText(/incluir en informes/i));
  fireEvent.click(screen.getByRole("button", { name: /actualizar/i }));
  expect(onConfirm).toHaveBeenCalledWith(true);
});
```

- [ ] **Step 2: Correr (RED)**
- [ ] **Step 3: Implementar `src/components/waf/AdvisorScoreDialog.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function AdvisorScoreDialog({ open, busy, onOpenChange, onConfirm }: {
  open: boolean; busy?: boolean; onOpenChange: (o: boolean) => void; onConfirm: (includeInReports: boolean) => void;
}) {
  const [include, setInclude] = useState(false);
  useEffect(() => { if (open) setInclude(false); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Actualizar Advisor Score</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Recalcula el Advisor Score del cliente consultando Azure. Puede tardar según el número de suscripciones.</p>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={include} onChange={(e) => setInclude(e.target.checked)} />
          Incluir en informes
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={busy} onClick={() => onConfirm(include)}>Actualizar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Correr (GREEN)** y `npx tsc -b` limpio.
- [ ] **Step 5: Commit** `git commit -m "feat(waf): diálogo Actualizar Advisor Score"`

---

### Task 4: Añadir las acciones a `WafActions` (sección Mantenimiento)

**Files:**
- Modify: `src/components/waf/WafActions.tsx`
- Modify: `src/components/waf/WafActions.test.tsx`

**Interfaces:**
- Consumes: `consolidateWafDuplicates`, `refreshWafAdvisorScore` (Task 1); `ConsolidateDialog` (Task 2); `AdvisorScoreDialog` (Task 3); `getRole` (`@/lib/auth`).

- [ ] **Step 1: Test — extender `src/components/waf/WafActions.test.tsx`**

Agregar al `vi.mock("@/lib/api", …)` existente:
```ts
  consolidateWafDuplicates: vi.fn(async () => ({ message: "ok", client_id: 3, merged: 3, ai_calls: 5 })),
  refreshWafAdvisorScore: vi.fn(async () => ({ message: "ok", clients_total: 1, clients_refreshed: 1, clients_failed: 0, results: [] })),
```
El mock de `@/lib/auth` debe exponer además `getRole: () => "admin"` (junto a `canEdit: () => true`). Agregar un test:
```tsx
test("Consolidar duplicados llama a la API y refresca", async () => {
  const { default: WafActions } = await import("@/components/waf/WafActions");
  const { consolidateWafDuplicates } = await import("@/lib/api");
  const onChanged = vi.fn();
  render(<WafActions clientId={3} onChanged={onChanged} />);
  fireEvent.click(screen.getByRole("button", { name: /opciones/i }));
  fireEvent.click(await screen.findByText(/consolidar duplicados/i));
  fireEvent.click(await screen.findByRole("button", { name: /^consolidar$/i }));
  await waitFor(() => expect(consolidateWafDuplicates).toHaveBeenCalledWith(3, true));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});
```
(Asegura que el import de `waitFor`/`fireEvent`/`findByText` esté presente.)

- [ ] **Step 2: Correr (RED)** `npx vitest run src/components/waf/WafActions.test.tsx`

- [ ] **Step 3: Implementar en `src/components/waf/WafActions.tsx`**

Imports nuevos:
```tsx
import { GitMerge, RefreshCw } from "lucide-react";
import { DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import ConsolidateDialog from "@/components/waf/ConsolidateDialog";
import AdvisorScoreDialog from "@/components/waf/AdvisorScoreDialog";
import { consolidateWafDuplicates, refreshWafAdvisorScore } from "@/lib/api";
import { canEdit, getRole } from "@/lib/auth";
```
(Combina `getRole` con el import de `canEdit` ya existente. Importa `DropdownMenuLabel`/`DropdownMenuSeparator` si no estaban.)

Estado nuevo: `const isAdmin = getRole() === "admin";` (junto a `editable`), y `const [consOpen, setConsOpen] = useState(false); const [scoreOpen, setScoreOpen] = useState(false);`

Handlers nuevos (junto a doSync/doCsv):
```tsx
async function doConsolidate(useAi: boolean) {
  setConsOpen(false);
  setBusyMsg({ title: "Consolidando duplicados", detail: useAi ? "con IA…" : "sin IA…" });
  setBusy(true);
  try {
    const r = await consolidateWafDuplicates(clientId, useAi);
    toast.success(`Consolidación completada · ${r.merged} fusionado${r.merged === 1 ? "" : "s"}`);
    onChanged();
  } catch (e) { toast.error(`Error consolidando: ${msg(e)}`); }
  finally { setBusy(false); }
}
async function doScoreRefresh(includeInReports: boolean) {
  setScoreOpen(false);
  setBusyMsg({ title: "Actualizando Advisor Score", detail: "Consultando Azure…" });
  setBusy(true);
  try {
    await refreshWafAdvisorScore(clientId, includeInReports);
    toast.success("Advisor Score actualizado.");
    onChanged();
  } catch (e) { toast.error(`Error actualizando Score: ${msg(e)}`); }
  finally { setBusy(false); }
}
```

En el `DropdownMenuContent`, tras el ítem "Importar Advisor CSV", agregar la sección de mantenimiento:
```tsx
            {(editable || isAdmin) && <DropdownMenuSeparator />}
            {(editable || isAdmin) && <DropdownMenuLabel>Mantenimiento</DropdownMenuLabel>}
            {editable && <DropdownMenuItem onClick={() => setConsOpen(true)}>Consolidar duplicados</DropdownMenuItem>}
            {isAdmin && <DropdownMenuItem onClick={() => setScoreOpen(true)}>Actualizar Advisor Score</DropdownMenuItem>}
```
> Nota: el dropdown completo hoy está envuelto en `{editable && (…)}`. Como "Consolidar" requiere `canEdit` y "Actualizar Score" requiere admin (que implica canEdit), el wrapper `editable` del dropdown sigue siendo correcto (un lector no ve "Opciones"). Mantener ese wrapper.

Antes del cierre del componente, junto a los otros diálogos, renderizar:
```tsx
      <ConsolidateDialog open={consOpen} busy={busy} onOpenChange={setConsOpen} onConfirm={doConsolidate} />
      <AdvisorScoreDialog open={scoreOpen} busy={busy} onOpenChange={setScoreOpen} onConfirm={doScoreRefresh} />
```

- [ ] **Step 4: Correr (GREEN) + gate completo** `npx vitest run && npx tsc -b && npm run build && npm run lint` — todo verde, sin lint nuevos.
- [ ] **Step 5: Commit** `git commit -m "feat(waf): Consolidar duplicados + Actualizar Advisor Score en Opciones"`

---

## Verificación en vivo (con OK del usuario)
- DEV con el .NET local + cliente con credenciales: Consolidar (admin/consultor) y Actualizar Score (solo admin) muestran overlay + toast + recargan (el Score de los pilares cambia tras refresh). Gating: consultor ve Consolidar pero no Actualizar Score; lector no ve "Opciones".
- Deploy: push a `main` solo con OK.

## Self-Review (hecho)
- Cobertura: ambas acciones en el dropdown con gating correcto (Consolidar=canEdit, Score=admin), confirmes con sus opciones (use_ai / include_in_reports), busy+toast+reload. Fuera de alcance: Excel import (B2). 
- Sin placeholders; código completo. Tipos `WafConsolidateResult`/`WafScoreRefreshResult` y firmas `consolidateWafDuplicates(clientId, useAi)`/`refreshWafAdvisorScore(clientId, includeInReports)` consistentes entre Tasks 1 y 4.
