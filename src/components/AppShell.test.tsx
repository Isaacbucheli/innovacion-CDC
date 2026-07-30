import { act, render, screen, fireEvent, within } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { beforeEach, expect, test, vi } from "vitest";
import AppShell from "@/components/AppShell";

// Admin ve el menú completo (estas pruebas cubren estructura/navegación, no el
// filtrado por permisos de módulo — eso vive en el guard central, App.tsx).
vi.mock("@/lib/auth", () => ({
  getRole: () => "admin",
  getName: () => "Admin BIT",
  clearSession: vi.fn(),
  canViewModule: () => true,
}));

// El menú contraído/expandido se recuerda en localStorage: cada prueba arranca limpia.
beforeEach(() => localStorage.clear());

function renderShell(active = "alerts", onNavigate?: (key: string) => void) {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <AppShell title="Catálogo de alertas" active={active} onNavigate={onNavigate}>
        <div>contenido</div>
      </AppShell>
    </ThemeProvider>,
  );
}

/** Contrae el menú y devuelve el icono-disparador del grupo indicado. */
function collapseAndGetTrigger(group: string) {
  fireEvent.click(screen.getByRole("button", { name: "Contraer menú" }));
  return screen.getByRole("button", { name: group });
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

test("el menú ya no tiene placeholders 'pronto' (todo migrado)", () => {
  renderShell();
  // Se expande "Matriz costos Azure": "Catálogo de servicios" ya es navegable, sin 'pronto'.
  fireEvent.click(screen.getByRole("button", { name: /Matriz costos Azure/i }));
  expect(screen.getByRole("button", { name: /^Catálogo de servicios$/i })).toBeInTheDocument();
  expect(screen.queryByText(/pronto/i)).not.toBeInTheDocument();
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

// --- Menú contraído estilo Azure (rail de iconos + flyout al pasar el mouse) ---

test("contraer el menú deja solo los iconos: sin etiquetas de grupo ni submenú", () => {
  renderShell();
  expect(screen.getByText("Gestión CDC")).toBeInTheDocument();
  collapseAndGetTrigger("Gestión CDC");
  // Ya no hay texto: el grupo queda como icono con nombre accesible.
  expect(screen.queryByText("Gestión CDC")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Catálogo de alertas$/ })).not.toBeInTheDocument();
  expect(screen.queryByText("Plataforma de optimización Azure")).not.toBeInTheDocument();
  // El botón ahora ofrece expandir de vuelta.
  expect(screen.getByRole("button", { name: "Expandir menú" })).toBeInTheDocument();
});

test("al pasar el mouse por un icono contraído se abre el flyout con sus opciones", () => {
  const onNavigate = vi.fn();
  renderShell("alerts", onNavigate);
  const trigger = collapseAndGetTrigger("Gestión CDC");
  expect(trigger).toHaveAttribute("aria-expanded", "false");

  fireEvent.mouseEnter(trigger.parentElement!);
  expect(trigger).toHaveAttribute("aria-expanded", "true");

  const flyout = screen.getByRole("group", { name: "Gestión CDC" });
  expect(within(flyout).getByText("Gestión CDC")).toBeInTheDocument();
  // Están las 7 opciones del grupo y la activa se marca con el verde de marca.
  expect(within(flyout).getByRole("button", { name: "Reservas por vencer" })).toBeInTheDocument();
  expect(within(flyout).getByRole("button", { name: "Pendientes Infra & SSAA" })).toBeInTheDocument();
  expect(within(flyout).getByRole("button", { name: "Catálogo de alertas" })).toHaveClass("bg-primary");

  fireEvent.click(within(flyout).getByRole("button", { name: "Catálogo de políticas" }));
  expect(onNavigate).toHaveBeenCalledWith("policies");
  // Navegar cierra el flyout (el menú sigue contraído).
  expect(screen.queryByRole("group", { name: "Gestión CDC" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Expandir menú" })).toBeInTheDocument();
});

test("el flyout se cierra con Escape, al salir con el mouse y al tocar fuera", () => {
  vi.useFakeTimers();
  try {
    renderShell();
    const trigger = collapseAndGetTrigger("Informes");
    const rail = trigger.parentElement!;

    // Clic/toque en el icono: abre (nunca alterna, ver comentario en AppShell).
    fireEvent.click(trigger);
    expect(screen.getByRole("group", { name: "Informes" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Informes" })).not.toBeInTheDocument();

    // Salir del icono SIN salir del menú no cierra: el trayecto diagonal hacia el
    // panel roza el nav y cerrar ahí provocaba parpadeo. Se simula como lo hace
    // el navegador —mouseout con relatedTarget— porque un `mouseLeave` pelado
    // hace que React sintetice la salida de TODOS los ancestros.
    const nav = screen.getByRole("navigation", { name: "Menú principal" });
    fireEvent.mouseEnter(rail);
    expect(screen.getByRole("group", { name: "Informes" })).toBeInTheDocument();
    fireEvent.mouseOut(rail, { relatedTarget: nav });
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.getByRole("group", { name: "Informes" })).toBeInTheDocument();

    // Salir del menú entero sí cierra, tras el margen de gracia.
    fireEvent.mouseOut(nav, { relatedTarget: document.body });
    expect(screen.getByRole("group", { name: "Informes" })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByRole("group", { name: "Informes" })).not.toBeInTheDocument();

    // Toque fuera del menú (en táctil no hay "salir con el mouse").
    fireEvent.click(trigger);
    expect(screen.getByRole("group", { name: "Informes" })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("group", { name: "Informes" })).not.toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test("con teclado, la flecha derecha abre el flyout y pone el foco en la primera opción", () => {
  renderShell();
  const trigger = collapseAndGetTrigger("Matriz mejoras Azure");
  fireEvent.keyDown(trigger, { key: "ArrowRight" });
  const flyout = screen.getByRole("group", { name: "Matriz mejoras Azure" });
  expect(within(flyout).getByRole("button", { name: "Recomendaciones" })).toHaveFocus();
});

test("recuerda el estado contraído entre recargas", () => {
  const { unmount } = renderShell();
  collapseAndGetTrigger("Informes");
  unmount();

  renderShell();
  expect(screen.getByRole("button", { name: "Expandir menú" })).toBeInTheDocument();
  expect(screen.queryByText("Gestión CDC")).not.toBeInTheDocument();

  // Y al expandir vuelve el menú completo con etiquetas.
  fireEvent.click(screen.getByRole("button", { name: "Expandir menú" }));
  expect(screen.getByText("Gestión CDC")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Contraer menú" })).toBeInTheDocument();
});
