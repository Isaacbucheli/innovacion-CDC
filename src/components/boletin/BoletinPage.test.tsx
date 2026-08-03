import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { BoletinGroup, BoletinView } from "@/types";

const group: BoletinGroup = {
  source: "advisor",
  announcement_key: "Basic SKU",
  title: "Basic SKU public IP addresses will be retired",
  retiring_feature: "Basic SKU",
  retirement_date: "2025-09-30",
  urgency: "retirado",
  recommended_action: "Migrar a Standard SKU",
  learn_more_url: "https://aka.ms/basicip",
  summary: null,
  title_es: "Las direcciones IP públicas SKU Basic se retirarán",
  summary_es: null,
  recommended_action_es: "Migrar a Standard SKU",
  resource_count: 1,
  derived_resource_count: 0,
  subscription_ids: ["sub-1"],
  resources: [
    { fingerprint: "fp-1", subscription_id: "sub-1", resource_id: "/r/ip1", resource_name: "ip1", resource_type: "t", derived: false },
  ],
};

const view: BoletinView = {
  last_sync: null,
  kpis: {
    announcements: 1, due_soon: 0, already_retired: 1, resources: 1,
    subscriptions_impacted: 1, subscriptions_total: 1, eol_products: 0, eol_resources: 0,
  },
  groups: [group],
  subscriptions: [{ subscription_id: "sub-1", name: "Producción" }],
};

const mockState = {
  clients: [{ client_id: 6, client_name: "BICSA", has_logo: false }],
  clientId: 6 as number | null,
  view: view as BoletinView | null,
  loading: false, dataLoading: false, syncing: false, error: "",
  selectClient: vi.fn(), sync: vi.fn(),
};

vi.mock("@/hooks/useBoletin", () => ({ useBoletin: () => ({ ...mockState }) }));

beforeEach(() => {
  mockState.view = view;
});

// El test de eol reasigna mockState.view a un objeto con grupos extra: restaurar acá (no solo en
// beforeEach) evita que un test futuro agregado después herede esa mutación si cambia el orden.
afterEach(() => {
  mockState.view = view;
});

async function renderPage() {
  const { default: BoletinPage } = await import("@/components/boletin/BoletinPage");
  return render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <BoletinPage onNavigate={() => {}} />
    </ThemeProvider>,
  );
}

test("Enter en el enlace 'Más información' navega el link y NO abre el detalle de la fila", async () => {
  await renderPage();
  // Radix Tabs selecciona en onMouseDown (no en el evento "click" sintético), así que hay que
  // disparar mousedown para que el TabsContent de "retiros" monte.
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Retiros y deprecaciones/i }));

  const link = screen.getByRole("link", { name: /Más información/i });
  fireEvent.keyDown(link, { key: "Enter", code: "Enter" });

  // El sheet de detalle (Radix Dialog, role="dialog") solo monta cuando abre con un grupo: si el
  // keydown del link se hubiera propagado a la fila (bug de la re-revisión), abriría el sheet.
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("click en la fila (fuera del enlace) sí abre el detalle", async () => {
  await renderPage();
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Retiros y deprecaciones/i }));

  fireEvent.click(screen.getByRole("button", { name: /Ver detalle de Basic SKU/i }));

  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

test("el toggle Inglés alterna el título al original de Azure", async () => {
  await renderPage();
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Retiros y deprecaciones/i }));

  await screen.findByText("Las direcciones IP públicas SKU Basic se retirarán");
  fireEvent.click(screen.getByRole("button", { name: "Alternar idioma inglés" }));
  expect(await screen.findByText("Basic SKU public IP addresses will be retired")).toBeInTheDocument();
});

test("los grupos eol NO aparecen en Retiros y SÍ en Fin de soporte", async () => {
  const eolGroup: BoletinGroup = {
    source: "eol",
    announcement_key: "ws2012r2",
    title: "Windows Server 2012 R2 end of support",
    retiring_feature: "Windows Server 2012 R2",
    retirement_date: "2023-10-10",
    urgency: "retirado",
    recommended_action: "Actualizar a una versión soportada",
    learn_more_url: null,
    summary: null,
    title_es: "Fin de soporte de Windows Server 2012 R2",
    summary_es: null,
    recommended_action_es: "Actualizar a una versión soportada",
    resource_count: 1,
    derived_resource_count: 0,
    subscription_ids: ["sub-1"],
    resources: [
      { fingerprint: "fp-2", subscription_id: "sub-1", resource_id: "/r/vm1", resource_name: "vm1", resource_type: "t", derived: false },
    ],
  };
  mockState.view = {
    ...view,
    kpis: { ...view.kpis, eol_products: 1, eol_resources: 1 },
    groups: [group, eolGroup],
  };

  await renderPage();
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Fin de soporte/ }));
  expect(await screen.findByText(/Windows Server 2012 R2/)).toBeInTheDocument();

  fireEvent.mouseDown(screen.getByRole("tab", { name: /Retiros y deprecaciones/ }));
  expect(screen.queryByText(/Windows Server 2012 R2/)).not.toBeInTheDocument();
});
