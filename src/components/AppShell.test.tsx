import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import AppShell from "@/components/AppShell";

test("muestra el título y el ítem de menú", () => {
  render(<AppShell title="Catálogo de alertas"><div>contenido</div></AppShell>);
  expect(screen.getByRole("heading", { name: "Catálogo de alertas" })).toBeInTheDocument();
  expect(screen.getByText("contenido")).toBeInTheDocument();
});
