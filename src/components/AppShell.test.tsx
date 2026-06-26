import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import AppShell from "@/components/AppShell";

test("muestra el título y el ítem de menú", () => {
  render(
    <AppShell title="Catálogo de alertas" active="alerts">
      <div>contenido</div>
    </AppShell>,
  );
  // Cabecera
  expect(screen.getByRole("heading", { name: "Catálogo de alertas" })).toBeInTheDocument();
  expect(screen.getByText("contenido")).toBeInTheDocument();
  // Logo de marca (Business IT) + botón salir
  expect(screen.getByAltText("Business IT")).toBeInTheDocument();
  expect(screen.getByText("Gestión CDC")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Salir/i })).toBeInTheDocument();
  // Ítem de menú del sidebar y su estado activo (verde de marca)
  const navItem = screen.getByRole("button", { name: /Catálogo de alertas/i });
  expect(navItem).toBeInTheDocument();
  expect(navItem).toHaveClass("bg-[#A3C243]");
});
