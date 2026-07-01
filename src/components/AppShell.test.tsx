import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { expect, test } from "vitest";
import AppShell from "@/components/AppShell";

function renderShell(active = "alerts") {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <AppShell title="Catálogo de alertas" active={active}>
        <div>contenido</div>
      </AppShell>
    </ThemeProvider>,
  );
}

test("muestra el título, el contenido, la marca y el botón salir", () => {
  renderShell();
  expect(screen.getByRole("heading", { name: "Catálogo de alertas" })).toBeInTheDocument();
  expect(screen.getByText("contenido")).toBeInTheDocument();
  expect(screen.getByAltText("Business IT")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Salir/i })).toBeInTheDocument();
});

test("replica los grupos jerárquicos del menú de PRD", () => {
  renderShell();
  for (const grupo of ["Matriz costos Azure", "Matriz mejoras Azure", "Informes", "Gestión CDC"]) {
    expect(screen.getByRole("button", { name: new RegExp(grupo, "i") })).toBeInTheDocument();
  }
});

test("marca como activo el ítem de la sección actual (verde de marca)", () => {
  renderShell("alerts");
  const navItem = screen.getByRole("button", { name: /Catálogo de alertas/i });
  // bg-primary = verde de marca #A3C243 (token que conmuta con el tema).
  expect(navItem).toHaveClass("bg-primary");
});

test("muestra placeholders 'pronto' para vistas aún no migradas", () => {
  renderShell();
  // Se expande "Matriz costos Azure": "Catálogo de servicios" sigue como placeholder ('pronto').
  fireEvent.click(screen.getByRole("button", { name: /Matriz costos Azure/i }));
  expect(screen.getAllByText(/pronto/i).length).toBeGreaterThan(0);
});

test("incluye el conmutador de modo claro/oscuro", () => {
  renderShell();
  expect(screen.getByRole("button", { name: /modo (oscuro|claro)/i })).toBeInTheDocument();
});

test("el ítem Recomendaciones es navegable (no placeholder)", () => {
  renderShell("waf");
  const item = screen.getByRole("button", { name: /^Recomendaciones$/i });
  expect(item).toHaveClass("bg-primary");
});
