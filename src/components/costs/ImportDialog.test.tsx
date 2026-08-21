import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import ImportDialog from "./ImportDialog";
import type { ServiceCatalogItem } from "@/types";

/**
 * La casilla "Reemplazar el inventario existente" tiene que arrancar MARCADA.
 *
 * Antes venía desmarcada y la etiqueta ofrecía "actualizar", un modo que el backend nunca
 * implementó: importar de nuevo sin reemplazar apendeaba, así que cada recurso quedaba duplicado y
 * con él cada conteo y cada monto del análisis. Pasó en dos análisis reales, uno con todo el
 * inventario al doble.
 */
const services = [
  { service_key: "vms", display_name: "Virtual Machines", is_active: true },
  { service_key: "disks", display_name: "Managed Disks", is_active: true },
] as unknown as ServiceCatalogItem[];

function abrir(onConfirm = vi.fn()) {
  render(
    <ImportDialog
      open
      services={services}
      onOpenChange={vi.fn()}
      onConfirm={onConfirm}
    />,
  );
  return onConfirm;
}

describe("ImportDialog", () => {
  test("la casilla de reemplazar arranca marcada", () => {
    abrir();

    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  test("confirmar sin tocar nada manda replace_existing en true", () => {
    const onConfirm = abrir();

    fireEvent.click(screen.getByRole("button", { name: /importar/i }));

    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  test("desmarcar manda false y avisa que la importación se rechaza", () => {
    const onConfirm = abrir();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText(/se rechaza/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /importar/i }));
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  test("la etiqueta ya no ofrece 'actualizar', que es un modo que no existe", () => {
    abrir();

    expect(screen.queryByText(/en vez de actualizar/i)).not.toBeInTheDocument();
  });
});
