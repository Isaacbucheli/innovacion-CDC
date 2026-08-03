import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import type { LifecycleEntry } from "@/types";

vi.mock("@/lib/api", () => ({
  listLifecycle: vi.fn(),
  createLifecycle: vi.fn(async () => ({ id: 99 })),
  updateLifecycle: vi.fn(async () => ({})),
  deleteLifecycle: vi.fn(async () => ({})),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const entryA: LifecycleEntry = {
  id: 1, clave: "a-clave", producto: "Producto A", categoria: "so", match_field: "os_name",
  match_pattern: "patron a", end_of_support: "2025-01-01", recomendacion: "Reco A",
  learn_more_url: null, is_active: true,
};
const entryB: LifecycleEntry = {
  id: 2, clave: "b-clave", producto: "Producto B", categoria: "bd", match_field: "sql_image_offer",
  match_pattern: "patron b", end_of_support: "2026-01-01", recomendacion: "Reco B",
  learn_more_url: null, is_active: true,
};

beforeEach(() => vi.clearAllMocks());

async function renderDialog() {
  const { default: LifecycleCatalogDialog } = await import("@/components/boletin/LifecycleCatalogDialog");
  const { listLifecycle } = await import("@/lib/api");
  (listLifecycle as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([entryA, entryB]);
  render(<LifecycleCatalogDialog open onOpenChange={() => {}} />);
  // Espera a que termine de cargar el catálogo (evita el aria-label "Editar ..." mientras dice "Cargando…").
  await screen.findByRole("button", { name: "Editar Producto A" });
}

test("editar B sin cerrar el form de A remonta el form y muestra los valores de B (no arrastra los de A)", async () => {
  await renderDialog();

  fireEvent.click(screen.getByRole("button", { name: "Editar Producto A" }));
  expect((screen.getByLabelText("Producto") as HTMLInputElement).value).toBe("Producto A");
  expect((screen.getByLabelText("Clave") as HTMLInputElement).value).toBe("a-clave");

  // Editar B SIN cerrar el form de A: es la regresión exacta del Critical. Sin `key` en
  // <LifecycleForm>, React reutiliza la misma instancia y el estado se queda con los valores de A.
  fireEvent.click(screen.getByRole("button", { name: "Editar Producto B" }));

  expect((screen.getByLabelText("Producto") as HTMLInputElement).value).toBe("Producto B");
  expect((screen.getByLabelText("Clave") as HTMLInputElement).value).toBe("b-clave");
});

test("guardar en edición llama updateLifecycle(B.id, payload) y el payload no trae id ni is_active", async () => {
  await renderDialog();
  const { updateLifecycle } = await import("@/lib/api");

  fireEvent.click(screen.getByRole("button", { name: "Editar Producto B" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

  await waitFor(() => expect(updateLifecycle).toHaveBeenCalled());
  const [id, payload] = (updateLifecycle as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(id).toBe(2);
  expect(payload).not.toHaveProperty("id");
  expect(payload).not.toHaveProperty("is_active");
  expect(payload).toMatchObject({ clave: "b-clave", producto: "Producto B", categoria: "bd" });
});

test("'Nueva entrada' abre el form vacío con defaults categoria=so, match_field=os_name", async () => {
  await renderDialog();

  fireEvent.click(screen.getByRole("button", { name: /Nueva entrada/i }));

  expect((screen.getByLabelText("Clave") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Producto") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Categoría") as HTMLSelectElement).value).toBe("so");
  expect((screen.getByLabelText("Campo de match") as HTMLSelectElement).value).toBe("os_name");
});
