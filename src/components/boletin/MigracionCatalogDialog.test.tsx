import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import type { MigracionEntry } from "@/types";

vi.mock("@/lib/api", () => ({
  getMigracionCatalogo: vi.fn(),
  createMigracionEntry: vi.fn(async () => ({ id: 99 })),
  updateMigracionEntry: vi.fn(async () => ({})),
  deleteMigracionEntry: vi.fn(async () => ({})),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const entryA: MigracionEntry = {
  id: 1, clave: "a-clave", desde: "Desde A", hacia: "Hacia A", notas: "Notas A",
  match_pattern: "patron a", learn_more_url: null, is_active: true,
};
const entryB: MigracionEntry = {
  id: 2, clave: "b-clave", desde: "Desde B", hacia: "Hacia B", notas: "Notas B",
  match_pattern: "patron b", learn_more_url: null, is_active: true,
};

beforeEach(() => vi.clearAllMocks());

async function renderDialog(props?: { draft?: Partial<MigracionEntry> }) {
  const { default: MigracionCatalogDialog } = await import("@/components/boletin/MigracionCatalogDialog");
  const { getMigracionCatalogo } = await import("@/lib/api");
  (getMigracionCatalogo as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([entryA, entryB]);
  render(<MigracionCatalogDialog open onOpenChange={() => {}} draft={props?.draft} />);
  await screen.findByRole("button", { name: "Editar a-clave" });
}

test("editar B sin cerrar el form de A remonta el form y muestra los valores de B (no arrastra los de A)", async () => {
  await renderDialog();

  fireEvent.click(screen.getByRole("button", { name: "Editar a-clave" }));
  expect((screen.getByLabelText("Desde") as HTMLInputElement).value).toBe("Desde A");
  expect((screen.getByLabelText("Clave") as HTMLInputElement).value).toBe("a-clave");

  // Editar B SIN cerrar el form de A: regresión exacta del bug de LifecycleForm. Sin `key` en
  // <MigracionForm>, React reutiliza la misma instancia y el estado se queda con los valores de A.
  fireEvent.click(screen.getByRole("button", { name: "Editar b-clave" }));

  expect((screen.getByLabelText("Desde") as HTMLInputElement).value).toBe("Desde B");
  expect((screen.getByLabelText("Clave") as HTMLInputElement).value).toBe("b-clave");
});

test("guardar en edición llama updateMigracionEntry(B.id, payload) y el payload no trae id ni is_active", async () => {
  await renderDialog();
  const { updateMigracionEntry } = await import("@/lib/api");

  fireEvent.click(screen.getByRole("button", { name: "Editar b-clave" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

  await waitFor(() => expect(updateMigracionEntry).toHaveBeenCalled());
  const [id, payload] = (updateMigracionEntry as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(id).toBe(2);
  expect(payload).not.toHaveProperty("id");
  expect(payload).not.toHaveProperty("is_active");
  expect(payload).toMatchObject({ clave: "b-clave", desde: "Desde B", hacia: "Hacia B" });
});

test("crear llama createMigracionEntry con el match_pattern del form", async () => {
  await renderDialog();
  const { createMigracionEntry } = await import("@/lib/api");

  fireEvent.click(screen.getByRole("button", { name: /Nueva ruta/i }));
  fireEvent.change(screen.getByLabelText("Clave"), { target: { value: "nueva-clave" } });
  fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "Origen" } });
  fireEvent.change(screen.getByLabelText("Hacia"), { target: { value: "Destino" } });
  fireEvent.change(screen.getByLabelText(/^Patrón/), { target: { value: "patron nuevo" } });
  fireEvent.change(screen.getByLabelText("Notas"), { target: { value: "Notas nuevas" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

  await waitFor(() => expect(createMigracionEntry).toHaveBeenCalledWith(
    expect.objectContaining({ clave: "nueva-clave", desde: "Origen", hacia: "Destino", match_pattern: "patron nuevo" }),
  ));
});

test("'Nueva ruta' abre el form vacío", async () => {
  await renderDialog();

  fireEvent.click(screen.getByRole("button", { name: /Nueva ruta/i }));

  expect((screen.getByLabelText("Clave") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Desde") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Hacia") as HTMLInputElement).value).toBe("");
});

test("borrar llama deleteMigracionEntry(id)", async () => {
  await renderDialog();
  const { deleteMigracionEntry } = await import("@/lib/api");

  fireEvent.click(screen.getByRole("button", { name: "Eliminar a-clave" }));
  fireEvent.click(await screen.findByRole("button", { name: "Eliminar" }));

  await waitFor(() => expect(deleteMigracionEntry).toHaveBeenCalledWith(1));
});

test("abrir con un draft entra directo al form de creación prefilled con esos valores", async () => {
  const draft: Partial<MigracionEntry> = {
    clave: "sug-clave", desde: "Origen sugerido", hacia: "Destino sugerido",
    notas: "Notas de la IA", match_pattern: "patron ia", learn_more_url: null,
  };
  await renderDialog({ draft });

  expect((await screen.findByLabelText("Desde")) as HTMLInputElement).toHaveValue("Origen sugerido");
  expect(screen.getByLabelText("Hacia")).toHaveValue("Destino sugerido");
  expect(screen.getByLabelText("Clave")).toHaveValue("sug-clave");
});
