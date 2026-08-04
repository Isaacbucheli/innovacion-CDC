import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import { fmtDate } from "@/components/boletin/boletinMeta";
import type { MigracionAnnouncement, MigracionRuta, MigracionSection, MigracionSugerencia } from "@/types";

vi.mock("@/lib/api", () => ({
  sugerirMigracion: vi.fn(),
  getMigracionCatalogo: vi.fn(async () => []),
  createMigracionEntry: vi.fn(async () => ({ id: 1 })),
  updateMigracionEntry: vi.fn(async () => ({})),
  deleteMigracionEntry: vi.fn(async () => ({})),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function announcement(overrides: Partial<MigracionAnnouncement>): MigracionAnnouncement {
  return {
    source: "advisor",
    announcement_key: "basic-ip",
    title: "Basic SKU public IP retirement",
    title_es: "Retiro de IP pública SKU Basic",
    retirement_date: "2025-09-30",
    urgency: "retirado",
    resource_count: 3,
    ...overrides,
  };
}

function ruta(overrides: Partial<MigracionRuta>): MigracionRuta {
  return {
    id: 1,
    clave: "basic-a-standard-ip",
    desde: "IP pública Basic",
    hacia: "IP pública Standard",
    notas: "Migrar antes del retiro.",
    learn_more_url: "https://aka.ms/basicip",
    announcements: [announcement({})],
    nearest_date: "2025-09-30",
    total_resources: 3,
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

async function renderTab(section: MigracionSection, opts?: { english?: boolean; canEdit?: boolean }) {
  const { default: MigracionTab } = await import("@/components/boletin/MigracionTab");
  return render(
    <MigracionTab
      clientId={7}
      section={section}
      english={opts?.english ?? false}
      canEdit={opts?.canEdit ?? false}
      onChanged={() => {}}
    />,
  );
}

test("la tabla de rutas muestra desde -> hacia, recursos, fecha límite y el título ES del anuncio por defecto", async () => {
  const r = ruta({});
  await renderTab({ rutas: [r], sin_ruta: [] });

  expect(screen.getByText("IP pública Basic")).toBeInTheDocument();
  expect(screen.getByText("IP pública Standard")).toBeInTheDocument();
  expect(screen.getByText("3")).toBeInTheDocument();
  expect(screen.getByText(fmtDate("2025-09-30"))).toBeInTheDocument();
  expect(screen.getByText("Retiro de IP pública SKU Basic")).toBeInTheDocument();
});

test("el toggle english cambia el título del anuncio al original de Azure en la tabla de rutas", async () => {
  const r = ruta({});
  const { rerender } = await renderTab({ rutas: [r], sin_ruta: [] }, { english: false });
  expect(await screen.findByText("Retiro de IP pública SKU Basic")).toBeInTheDocument();

  const { default: MigracionTab } = await import("@/components/boletin/MigracionTab");
  rerender(
    <MigracionTab clientId={7} section={{ rutas: [r], sin_ruta: [] }} english canEdit={false} onChanged={() => {}} />,
  );

  expect(await screen.findByText("Basic SKU public IP retirement")).toBeInTheDocument();
  expect(screen.queryByText("Retiro de IP pública SKU Basic")).not.toBeInTheDocument();
});

test("'Sin ruta definida (M)' lista los anuncios sin ruta; el botón Sugerir con IA respeta canEdit y M=0", async () => {
  const a1 = announcement({ announcement_key: "a1", title_es: "Anuncio A" });
  const { rerender } = await renderTab({ rutas: [], sin_ruta: [a1] }, { canEdit: false });

  expect(await screen.findByText("Sin ruta definida (1)")).toBeInTheDocument();
  expect(screen.getByText("Anuncio A")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Sugerir con IA/i })).not.toBeInTheDocument();

  const { default: MigracionTab } = await import("@/components/boletin/MigracionTab");
  rerender(
    <MigracionTab clientId={7} section={{ rutas: [], sin_ruta: [] }} english={false} canEdit onChanged={() => {}} />,
  );

  expect(screen.getByText("Sin ruta definida (0)")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Sugerir con IA/i })).toBeDisabled();
});

test("Sugerir con IA pinta las sugerencias y sin_sugerencia; 'Revisar y guardar' abre el catálogo con los campos prefilled", async () => {
  const a1 = announcement({ announcement_key: "a1", title_es: "Anuncio sin ruta" });
  const api = await import("@/lib/api");
  const sugerencia: MigracionSugerencia = {
    clave: "vm-classic-a-arm",
    desde: "VM clásica",
    hacia: "VM ARM",
    notas: "Migrar con az vm migration.",
    match_pattern: "classic vm",
    learn_more_url: "https://aka.ms/classicvm",
    announcement_title: "Anuncio sin ruta",
  };
  (api.sugerirMigracion as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    sugerencias: [sugerencia],
    sin_sugerencia: ["Otro anuncio sin match"],
  });

  await renderTab({ rutas: [], sin_ruta: [a1] }, { canEdit: true });
  fireEvent.click(screen.getByRole("button", { name: /Sugerir con IA/i }));

  expect(await screen.findByText("VM clásica")).toBeInTheDocument();
  expect(screen.getByText("VM ARM")).toBeInTheDocument();
  expect(screen.getByText(/La IA no encontró ruta en el texto de: Otro anuncio sin match/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Revisar y guardar" }));

  await screen.findByRole("dialog");
  expect((await screen.findByLabelText("Desde")) as HTMLInputElement).toHaveValue("VM clásica");
  expect(screen.getByLabelText("Hacia")).toHaveValue("VM ARM");
  expect(screen.getByLabelText(/^Patrón/)).toHaveValue("classic vm");
  expect(screen.getByLabelText("Clave")).toHaveValue("vm-classic-a-arm");
});

test("error al sugerir con IA muestra toast.error con el detail del backend", async () => {
  const api = await import("@/lib/api");
  const { toast } = await import("sonner");
  (api.sugerirMigracion as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
    new Error("Azure OpenAI no disponible temporalmente"),
  );

  await renderTab({ rutas: [], sin_ruta: [announcement({})] }, { canEdit: true });
  fireEvent.click(screen.getByRole("button", { name: /Sugerir con IA/i }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
    expect.stringContaining("Azure OpenAI no disponible temporalmente"),
  ));
});

test("'Catálogo de rutas' solo se ve con canEdit", async () => {
  const { rerender } = await renderTab({ rutas: [], sin_ruta: [] }, { canEdit: false });
  expect(screen.queryByRole("button", { name: /Catálogo de rutas/i })).not.toBeInTheDocument();

  const { default: MigracionTab } = await import("@/components/boletin/MigracionTab");
  rerender(
    <MigracionTab clientId={7} section={{ rutas: [], sin_ruta: [] }} english={false} canEdit onChanged={() => {}} />,
  );
  expect(screen.getByRole("button", { name: /Catálogo de rutas/i })).toBeInTheDocument();
});
