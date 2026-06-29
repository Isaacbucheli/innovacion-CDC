# WAF Acciones (Slice A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar la barra de acciones de WAF Recomendaciones (Consultar Advisor con selector de suscripciones, Exportar Excel, Importar Advisor CSV), espejo del header de costos, contra el backend .NET.

**Architecture:** Funciones de API en `lib/api.ts`, helper puro en `lib/waf.ts`, dos diálogos (`AdvisorSyncDialog`, `ImportCsvDialog`) y una barra (`WafActions`) que encapsula toolbar + dropdown "Opciones" + estado `busy` + `BusyOverlay`; `WafPage` monta `<WafActions>` en el tope del body.

**Tech Stack:** React, TypeScript, Tailwind + shadcn/ui (Dialog, DropdownMenu, Button), sonner, Vitest + Testing Library.

## Global Constraints

- Front habla SOLO con el .NET vía `apiBase()` / `request<T>` (multipart vía `fetch` con token, igual que `uploadClientLogo`). Nunca prod FastAPI.
- Tokens semánticos / variantes `dark:`; debe verse bien en claro y oscuro. Verde de marca solo como acento (botón primario).
- Gating: `Consultar Advisor` e `Importar Advisor CSV` solo si `canEdit()` (admin/consultor); `Exportar Excel` para todos.
- Toda escritura/descarga: `BusyOverlay` bloqueante + toast (sonner) al terminar. `request()` ya maneja 401.
- Español latino neutro. YAGNI: Slice A NO incluye Importar matriz Excel, Consolidar duplicados, ni Advisor Score refresh.
- `advisor-sync` del .NET es **síncrono** (devuelve el resumen al terminar) → sin polling.
- Tras cada tarea: `npm run lint` y `npm run build` verdes; commits frecuentes.

---

### Task 1: Tipos + funciones de API (subscripciones, ingesta CSV, advisor-sync)

**Files:**
- Modify: `src/types.ts` (agregar al final)
- Modify: `src/lib/api.ts` (merge imports + nuevas funciones)
- Test: `src/lib/api.test.ts` (agregar casos)

**Interfaces:**
- Produces: tipos `ClientSubscription`, `WafAdvisorSyncRequest`, `WafAdvisorSyncResult`; funciones `listClientSubscriptions(clientId)`, `runWafAdvisorSync(clientId, body)`, `uploadWafIngestion(clientId, file)`.

- [ ] **Step 1: Tipos en `src/types.ts`**

```ts
/** Suscripción del cliente (GET /azure/subscriptions?client_id=, backend .NET). */
export interface ClientSubscription {
  client_subscription_id: number;
  subscription_id: string;
  subscription_name: string | null;
  is_active: boolean;
  is_managed: boolean;
}

/** Request de sync con Azure Advisor (POST /waf/clients/{id}/advisor-sync). */
export interface WafAdvisorSyncRequest {
  subscriptions: string[];
  timeout_seconds_per_subscription?: number;
}

/** Resultado (síncrono) del sync con Advisor. */
export interface WafAdvisorSyncResult {
  run_id: number;
  status: string;
  subscriptions_queued: number;
  subscriptions_processed: number;
  subscriptions_failed: number;
  new_recommendations: number;
  new_findings: number;
  resolved_findings: number;
  warnings?: string[];
}
```

- [ ] **Step 2: API en `src/lib/api.ts`**

Merge `ClientSubscription`, `WafAdvisorSyncRequest`, `WafAdvisorSyncResult` en el bloque `import type { ... } from "@/types"` del tope (orden alfabético del bloque). Luego, en la sección WAF de escrituras (después de `addWafComment`), agregar:

```ts
// ---- WAF: acciones (Slice A) ----
export const listClientSubscriptions = (clientId: number) =>
  request<ClientSubscription[]>(`/azure/subscriptions?client_id=${clientId}`);
export const runWafAdvisorSync = (clientId: number, body: WafAdvisorSyncRequest) =>
  request<WafAdvisorSyncResult>(`/waf/clients/${clientId}/advisor-sync`, jsonOpts("POST", body));

/** Sube un CSV de Advisor (multipart, campo "file"). Igual patrón que uploadClientLogo. */
export async function uploadWafIngestion(clientId: number, file: File, base: string = apiBase()): Promise<unknown> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${base}/waf/clients/${clientId}/ingestions`, { method: "POST", headers, body: form });
  if (res.status === 401) {
    clearSession();
    if (typeof location !== "undefined") location.reload();
    throw new Error("Sesión expirada");
  }
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try { detail = JSON.parse(text).detail ?? text; } catch { /* texto plano */ }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return text ? JSON.parse(text) : {};
}
```

- [ ] **Step 3: Test en `src/lib/api.test.ts`** (agregar dentro del bloque WAF existente o uno nuevo)

```ts
it("listClientSubscriptions arma la URL con client_id", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
  const { listClientSubscriptions } = await import("@/lib/api");
  await listClientSubscriptions(7);
  const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
  expect(url).toContain("/azure/subscriptions?client_id=7");
});

it("uploadWafIngestion postea multipart al endpoint de ingestions", async () => {
  const spy = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", spy);
  const { uploadWafIngestion } = await import("@/lib/api");
  await uploadWafIngestion(3, new File(["a,b"], "advisor.csv", { type: "text/csv" }));
  expect(spy.mock.calls[0][0]).toContain("/waf/clients/3/ingestions");
  expect((spy.mock.calls[0][1] as RequestInit).method).toBe("POST");
  expect((spy.mock.calls[0][1] as RequestInit).body).toBeInstanceOf(FormData);
});
```

- [ ] **Step 4: Correr tests**

Run: `npx vitest run src/lib/api.test.ts`
Expected: PASS (nuevos + existentes verdes).

- [ ] **Step 5: Verificar tipos y commit**

```bash
npx tsc -b
git add src/types.ts src/lib/api.ts src/lib/api.test.ts
git commit -m "feat(waf): API de acciones (subscripciones, ingesta CSV, advisor-sync)"
```

---

### Task 2: Helper `advisorSyncSummary` en `lib/waf.ts`

**Files:**
- Modify: `src/lib/waf.ts`
- Test: `src/lib/waf.test.ts`

**Interfaces:**
- Consumes: `WafAdvisorSyncResult` (Task 1).
- Produces: `advisorSyncSummary(r: WafAdvisorSyncResult): string`.

- [ ] **Step 1: Test en `src/lib/waf.test.ts`**

```ts
import { advisorSyncSummary } from "@/lib/waf";
import type { WafAdvisorSyncResult } from "@/types";

describe("advisorSyncSummary", () => {
  it("resume suscripciones procesadas, nuevas y resueltas", () => {
    const r: WafAdvisorSyncResult = {
      run_id: 1, status: "completed", subscriptions_queued: 3, subscriptions_processed: 3,
      subscriptions_failed: 0, new_recommendations: 58, new_findings: 312, resolved_findings: 12,
    };
    const s = advisorSyncSummary(r);
    expect(s).toContain("3");
    expect(s).toContain("58");
    expect(s).toContain("12");
  });
});
```

- [ ] **Step 2: Correr (RED)**

Run: `npx vitest run src/lib/waf.test.ts`
Expected: FAIL ("advisorSyncSummary is not exported").

- [ ] **Step 3: Implementar en `src/lib/waf.ts`** (agregar al final)

```ts
import type { WafAdvisorSyncResult } from "@/types";

export function advisorSyncSummary(r: WafAdvisorSyncResult): string {
  const subs = `${r.subscriptions_processed} suscripción${r.subscriptions_processed === 1 ? "" : "es"}`;
  return `${subs} · ${r.new_recommendations} nuevas · ${r.resolved_findings} resueltas`;
}
```

(Si el archivo ya importa de `@/types`, agregar `WafAdvisorSyncResult` al import existente en vez de uno nuevo.)

- [ ] **Step 4: Correr (GREEN)**

Run: `npx vitest run src/lib/waf.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/waf.ts src/lib/waf.test.ts
git commit -m "feat(waf): helper advisorSyncSummary para el toast"
```

---

### Task 3: `ImportCsvDialog`

**Files:**
- Create: `src/components/waf/ImportCsvDialog.tsx`
- Test: `src/components/waf/ImportCsvDialog.test.tsx`

**Interfaces:**
- Consumes: `uploadWafIngestion` (Task 1); `Dialog`/`Button`/`Label` (shadcn); `toast`.
- Produces: `ImportCsvDialog({ open, clientId, busy, onOpenChange, onConfirm }: { open: boolean; clientId: number; busy?: boolean; onOpenChange: (o: boolean) => void; onConfirm: (file: File) => void })`. El diálogo solo elige archivo y dispara `onConfirm(file)`; la subida + toast + reload los hace el padre (`WafActions`), igual que `CalculateDialog`/`onConfirm` en costos.

- [ ] **Step 1: Test en `src/components/waf/ImportCsvDialog.test.tsx`**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import ImportCsvDialog from "@/components/waf/ImportCsvDialog";

test("dispara onConfirm con el archivo elegido", () => {
  const onConfirm = vi.fn();
  render(<ImportCsvDialog open clientId={3} onOpenChange={() => {}} onConfirm={onConfirm} />);
  const file = new File(["a,b"], "advisor.csv", { type: "text/csv" });
  const input = screen.getByLabelText(/archivo csv/i) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: /importar/i }));
  expect(onConfirm).toHaveBeenCalledWith(file);
});

test("el botón importar está deshabilitado sin archivo", () => {
  render(<ImportCsvDialog open clientId={3} onOpenChange={() => {}} onConfirm={vi.fn()} />);
  expect(screen.getByRole("button", { name: /importar/i })).toBeDisabled();
});
```

- [ ] **Step 2: Correr (RED)**

Run: `npx vitest run src/components/waf/ImportCsvDialog.test.tsx`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar `src/components/waf/ImportCsvDialog.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function ImportCsvDialog({ open, clientId, busy, onOpenChange, onConfirm }: {
  open: boolean; clientId: number; busy?: boolean;
  onOpenChange: (o: boolean) => void; onConfirm: (file: File) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => { if (open) setFile(null); }, [open, clientId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Importar Advisor CSV</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Carga un export CSV de Azure Advisor para este cliente.</p>
        <div className="space-y-1.5">
          <Label htmlFor="csv">Archivo CSV</Label>
          <input id="csv" type="file" accept=".csv" className="block w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={!file || busy} onClick={() => file && onConfirm(file)}>Importar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Correr (GREEN)**

Run: `npx vitest run src/components/waf/ImportCsvDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/waf/ImportCsvDialog.tsx src/components/waf/ImportCsvDialog.test.tsx
git commit -m "feat(waf): diálogo Importar Advisor CSV"
```

---

### Task 4: `AdvisorSyncDialog`

**Files:**
- Create: `src/components/waf/AdvisorSyncDialog.tsx`
- Test: `src/components/waf/AdvisorSyncDialog.test.tsx`

**Interfaces:**
- Consumes: `listClientSubscriptions` (Task 1); `Dialog`/`Button` (shadcn); tipo `ClientSubscription`.
- Produces: `AdvisorSyncDialog({ open, clientId, busy, onOpenChange, onConfirm }: { open: boolean; clientId: number; busy?: boolean; onOpenChange: (o: boolean) => void; onConfirm: (subscriptionIds: string[]) => void })`. Carga las suscripciones del cliente al abrir (filtra `is_active && is_managed`), multi-select (todas por defecto); `onConfirm` recibe los `subscription_id` elegidos. La llamada al sync + toast + reload los hace el padre.

- [ ] **Step 1: Test en `src/components/waf/AdvisorSyncDialog.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  listClientSubscriptions: vi.fn(async () => [
    { client_subscription_id: 1, subscription_id: "sub-A", subscription_name: "Producción", is_active: true, is_managed: true },
    { client_subscription_id: 2, subscription_id: "sub-B", subscription_name: "Inactiva", is_active: false, is_managed: true },
  ]),
}));

test("lista solo suscripciones activas+administradas y confirma con sus ids", async () => {
  const { default: AdvisorSyncDialog } = await import("@/components/waf/AdvisorSyncDialog");
  const onConfirm = vi.fn();
  render(<AdvisorSyncDialog open clientId={3} onOpenChange={() => {}} onConfirm={onConfirm} />);
  await waitFor(() => expect(screen.getByText("Producción")).toBeInTheDocument());
  expect(screen.queryByText("Inactiva")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /consultar/i }));
  expect(onConfirm).toHaveBeenCalledWith(["sub-A"]);
});
```

- [ ] **Step 2: Correr (RED)**

Run: `npx vitest run src/components/waf/AdvisorSyncDialog.test.tsx`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar `src/components/waf/AdvisorSyncDialog.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { listClientSubscriptions } from "@/lib/api";
import type { ClientSubscription } from "@/types";

export default function AdvisorSyncDialog({ open, clientId, busy, onOpenChange, onConfirm }: {
  open: boolean; clientId: number; busy?: boolean;
  onOpenChange: (o: boolean) => void; onConfirm: (subscriptionIds: string[]) => void;
}) {
  const [subs, setSubs] = useState<ClientSubscription[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listClientSubscriptions(clientId)
      .then((all) => {
        const usable = all.filter((s) => s.is_active && s.is_managed);
        setSubs(usable);
        setSelected(usable.map((s) => s.subscription_id));
      })
      .catch(() => { setSubs([]); setSelected([]); })
      .finally(() => setLoading(false));
  }, [open, clientId]);

  const toggle = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Consultar Advisor</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Elige las suscripciones a sincronizar con Azure Advisor.</p>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Cargando suscripciones…</p>
        ) : subs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No hay suscripciones administradas para este cliente.</p>
        ) : (
          <div className="grid gap-1.5 my-1 max-h-64 overflow-y-auto">
            {subs.map((s) => (
              <label key={s.client_subscription_id} className="flex items-center gap-2 text-sm cursor-pointer rounded-md border p-2 hover:bg-secondary">
                <input type="checkbox" checked={selected.includes(s.subscription_id)} onChange={() => toggle(s.subscription_id)} />
                <span className="truncate flex-1">{s.subscription_name ?? s.subscription_id}</span>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={selected.length === 0 || busy} onClick={() => onConfirm(selected)}>Consultar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Correr (GREEN)**

Run: `npx vitest run src/components/waf/AdvisorSyncDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/waf/AdvisorSyncDialog.tsx src/components/waf/AdvisorSyncDialog.test.tsx
git commit -m "feat(waf): diálogo Consultar Advisor con selector de suscripciones"
```

---

### Task 5: `WafActions` (toolbar + dropdown + busy + diálogos)

**Files:**
- Create: `src/components/waf/WafActions.tsx`
- Test: `src/components/waf/WafActions.test.tsx`

**Interfaces:**
- Consumes: `runWafAdvisorSync`, `uploadWafIngestion`, `downloadFromApi` (Task 1 / existente); `advisorSyncSummary` (Task 2); `AdvisorSyncDialog` (Task 4); `ImportCsvDialog` (Task 3); `BusyOverlay` (existente); `canEdit` (`@/lib/auth`); `Button` + `DropdownMenu*` (shadcn); `toast`.
- Produces: `WafActions({ clientId, onChanged }: { clientId: number; onChanged: () => void })`. Renderiza la barra (Consultar Advisor primario + Exportar Excel + Opciones dropdown con Importar Advisor CSV), maneja `busy` + `BusyOverlay` y los dos diálogos, hace las llamadas a la API y toasts, y llama `onChanged()` tras éxito.

- [ ] **Step 1: Test en `src/components/waf/WafActions.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  runWafAdvisorSync: vi.fn(async () => ({ run_id: 1, status: "completed", subscriptions_queued: 1, subscriptions_processed: 1, subscriptions_failed: 0, new_recommendations: 5, new_findings: 9, resolved_findings: 2 })),
  uploadWafIngestion: vi.fn(async () => ({})),
  listClientSubscriptions: vi.fn(async () => [{ client_subscription_id: 1, subscription_id: "sub-A", subscription_name: "Producción", is_active: true, is_managed: true }]),
  downloadFromApi: vi.fn(async () => {}),
}));
vi.mock("@/lib/auth", () => ({ canEdit: () => true }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

test("muestra el primario, Exportar y Opciones; Exportar descarga", async () => {
  const { default: WafActions } = await import("@/components/waf/WafActions");
  const { downloadFromApi } = await import("@/lib/api");
  render(<WafActions clientId={3} onChanged={vi.fn()} />);
  expect(screen.getByRole("button", { name: /consultar advisor/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /exportar excel/i }));
  await waitFor(() => expect(downloadFromApi).toHaveBeenCalled());
});

test("Consultar Advisor: selecciona y llama al sync, luego onChanged", async () => {
  const { default: WafActions } = await import("@/components/waf/WafActions");
  const { runWafAdvisorSync } = await import("@/lib/api");
  const onChanged = vi.fn();
  render(<WafActions clientId={3} onChanged={onChanged} />);
  fireEvent.click(screen.getByRole("button", { name: /consultar advisor/i }));
  await waitFor(() => expect(screen.getByText("Producción")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /^consultar$/i }));
  await waitFor(() => expect(runWafAdvisorSync).toHaveBeenCalledWith(3, { subscriptions: ["sub-A"], timeout_seconds_per_subscription: 600 }));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});
```

- [ ] **Step 2: Correr (RED)**

Run: `npx vitest run src/components/waf/WafActions.test.tsx`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar `src/components/waf/WafActions.tsx`**

```tsx
import { useState } from "react";
import { Download, MoreHorizontal, CloudUpload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import BusyOverlay from "@/components/BusyOverlay";
import AdvisorSyncDialog from "@/components/waf/AdvisorSyncDialog";
import ImportCsvDialog from "@/components/waf/ImportCsvDialog";
import { runWafAdvisorSync, uploadWafIngestion, downloadFromApi } from "@/lib/api";
import { advisorSyncSummary } from "@/lib/waf";
import { canEdit } from "@/lib/auth";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

export default function WafActions({ clientId, onChanged }: { clientId: number; onChanged: () => void }) {
  const editable = canEdit();
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState<{ title: string; detail?: string }>({ title: "" });
  const [syncOpen, setSyncOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  async function doExport() {
    setBusyMsg({ title: "Generando Excel", detail: "Matriz WAF…" });
    setBusy(true);
    try {
      await downloadFromApi(`/waf/clients/${clientId}/export-excel`, `matriz-waf-cliente-${clientId}.xlsx`);
      toast.success("Excel de la matriz WAF descargado.");
    } catch (e) {
      toast.error(`Error exportando Excel: ${msg(e)}`);
    } finally { setBusy(false); }
  }

  async function doSync(subscriptionIds: string[]) {
    setSyncOpen(false);
    setBusyMsg({ title: "Consultando Advisor", detail: "Puede tardar; no cierres la ventana." });
    setBusy(true);
    try {
      const r = await runWafAdvisorSync(clientId, { subscriptions: subscriptionIds, timeout_seconds_per_subscription: 600 });
      toast.success(`Advisor sincronizado · ${advisorSyncSummary(r)}`);
      onChanged();
    } catch (e) {
      toast.error(`Error consultando Advisor: ${msg(e)}`);
    } finally { setBusy(false); }
  }

  async function doCsv(file: File) {
    setCsvOpen(false);
    setBusyMsg({ title: "Importando CSV", detail: file.name });
    setBusy(true);
    try {
      await uploadWafIngestion(clientId, file);
      toast.success("CSV de Advisor importado.");
      onChanged();
    } catch (e) {
      toast.error(`Error importando CSV: ${msg(e)}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <BusyOverlay show={busy} title={busyMsg.title} detail={busyMsg.detail} />
      {editable && (
        <Button size="sm" disabled={busy} onClick={() => setSyncOpen(true)}>
          <CloudUpload className="w-4 h-4 mr-1" /> Consultar Advisor
        </Button>
      )}
      <Button variant="outline" size="sm" disabled={busy} onClick={doExport}>
        <Download className="w-4 h-4 mr-1" /> Exportar Excel
      </Button>
      {editable && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={busy}>
              <MoreHorizontal className="w-4 h-4 mr-1" /> Opciones
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Cargar datos</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setCsvOpen(true)}>Importar Advisor CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <AdvisorSyncDialog open={syncOpen} clientId={clientId} busy={busy} onOpenChange={setSyncOpen} onConfirm={doSync} />
      <ImportCsvDialog open={csvOpen} clientId={clientId} busy={busy} onOpenChange={setCsvOpen} onConfirm={doCsv} />
    </div>
  );
}
```

- [ ] **Step 4: Correr (GREEN)**

Run: `npx vitest run src/components/waf/WafActions.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/waf/WafActions.tsx src/components/waf/WafActions.test.tsx
git commit -m "feat(waf): barra de acciones (Consultar Advisor, Exportar, Importar CSV)"
```

---

### Task 6: Montar `WafActions` en `WafPage`

**Files:**
- Modify: `src/components/waf/WafPage.tsx`
- Test: `src/components/waf/WafPage.test.tsx`

**Interfaces:**
- Consumes: `WafActions` (Task 5).

- [ ] **Step 1: Actualizar el test `src/components/waf/WafPage.test.tsx`**

Agregar al mock de `@/lib/api` las funciones que usa `WafActions` (para que el render no falle):
```tsx
// dentro del vi.mock("@/lib/api", () => ({ ... })) existente, añadir:
  runWafAdvisorSync: vi.fn(),
  uploadWafIngestion: vi.fn(),
  listClientSubscriptions: vi.fn(async () => []),
  downloadFromApi: vi.fn(),
```
Y añadir una aserción al test existente:
```tsx
expect(screen.getByRole("button", { name: /consultar advisor/i })).toBeInTheDocument();
```
(El mock de `@/lib/auth` debe exponer `canEdit: () => true` — si el test aún no lo mockea, agrégalo: `vi.mock("@/lib/auth", () => ({ canEdit: () => true, getRole: () => "admin", getName: () => "BIT" }))`. Si ya existe un mock de auth, solo asegúrate de que `canEdit` devuelva true.)

- [ ] **Step 2: Correr (RED)**

Run: `npx vitest run src/components/waf/WafPage.test.tsx`
Expected: FAIL (no existe el botón "Consultar Advisor" todavía).

- [ ] **Step 3: Montar en `src/components/waf/WafPage.tsx`**

Agregar el import:
```tsx
import WafActions from "@/components/waf/WafActions";
```
Y renderizar la barra como primer hijo del contenedor del body (antes de `<WafKpis …>`), solo cuando hay cliente:
```tsx
        {waf.clientId != null && <WafActions clientId={waf.clientId} onChanged={waf.reloadData} />}
```
(Colócalo dentro del `<div className="space-y-5">` existente, como primer elemento.)

- [ ] **Step 4: Correr (GREEN) + gate completo**

Run: `npx vitest run && npx tsc -b && npm run build && npm run lint`
Expected: toda la suite verde; build OK; sin lint nuevos (2 warnings preexistentes de `ui/` ok).

- [ ] **Step 5: Commit**

```bash
git add src/components/waf/WafPage.tsx src/components/waf/WafPage.test.tsx
git commit -m "feat(waf): montar barra de acciones en WafPage"
```

---

## Verificación en vivo (tras implementar, con OK del usuario)
- Confirmar contra el .NET el campo multipart (`file`) y la forma del resultado de `ingestions` (el toast cae a mensaje genérico si difiere).
- DEV con el .NET local + cliente con suscripciones administradas y credenciales: probar Exportar Excel (descarga), Importar CSV (subida + recarga), Consultar Advisor (selector → sync síncrono con overlay → toast con resumen → recarga de KPIs/pilares/tabla), en claro y oscuro, y el gating con rol `lector`.
- Deploy: push a `main` solo con OK del usuario.

## Self-Review (hecho)
- **Cobertura del spec:** toolbar espejo de costos con gating (Task 5/6), Exportar Excel blob (Task 5), Importar CSV multipart sin reemplazo (Tasks 1/3/5), Consultar Advisor con selector + sync síncrono + toast resumen + reload (Tasks 1/2/4/5), BusyOverlay en todas. Fuera de alcance respetado (sin Excel-preview/Consolidar/Score).
- **Placeholders:** ninguno; código completo.
- **Consistencia de tipos:** `WafAdvisorSyncRequest`/`WafAdvisorSyncResult`/`ClientSubscription` y las firmas `runWafAdvisorSync(clientId, body)`, `uploadWafIngestion(clientId, file)`, `listClientSubscriptions(clientId)`, `advisorSyncSummary(result)` se usan idénticas en Tasks 1, 2, 4, 5. `onConfirm(subscriptionIds)` / `onConfirm(file)` consistentes entre diálogos y `WafActions`.
