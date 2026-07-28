import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import SubscriptionFilter from "@/components/waf/SubscriptionFilter";
import type { WafSubscriptionOption } from "@/types";

const opts: WafSubscriptionOption[] = [
  { subscription_id: "sub-a", subscription_name: "prod", recommendations: 41, resources: 220 },
  { subscription_id: "sub-b", subscription_name: "dev", recommendations: 12, resources: 30 },
  { subscription_id: "sub-c", subscription_name: "(matriz historica)", recommendations: 7, resources: 61 },
];

/** Radix abre el menú en pointerdown, no en click (mismo patrón que los tests de WafActions). */
function abrir() {
  const trigger = screen.getByRole("button", { name: /Filtrar por suscripción/i });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);
}

test("no se muestra cuando el cliente tiene una sola suscripcion", () => {
  const { container } = render(
    <SubscriptionFilter options={[opts[0]]} selected={[]} onChange={vi.fn()} />,
  );
  expect(container).toBeEmptyDOMElement();
});

test("muestra el conteo de seleccionadas sobre el total", () => {
  render(<SubscriptionFilter options={opts} selected={["sub-a"]} onChange={vi.fn()} />);
  expect(screen.getByRole("button", { name: /Filtrar por suscripción/i })).toHaveTextContent("Suscripciones (1/3)");
});

test("sin seleccion muestra solo el total", () => {
  render(<SubscriptionFilter options={opts} selected={[]} onChange={vi.fn()} />);
  expect(screen.getByRole("button", { name: /Filtrar por suscripción/i })).toHaveTextContent("Suscripciones (3)");
});

test("marcar una suscripcion la agrega a la seleccion", () => {
  const onChange = vi.fn();
  render(<SubscriptionFilter options={opts} selected={[]} onChange={onChange} />);
  abrir();
  fireEvent.click(screen.getByText("dev"));
  expect(onChange).toHaveBeenCalledWith(["sub-b"]);
});

test("desmarcar la quita de la seleccion", () => {
  const onChange = vi.fn();
  render(<SubscriptionFilter options={opts} selected={["sub-a", "sub-b"]} onChange={onChange} />);
  abrir();
  fireEvent.click(screen.getByText("prod"));
  expect(onChange).toHaveBeenCalledWith(["sub-b"]);
});

test("Todas limpia la seleccion", () => {
  const onChange = vi.fn();
  render(<SubscriptionFilter options={opts} selected={["sub-a"]} onChange={onChange} />);
  abrir();
  fireEvent.click(screen.getByText("Todas"));
  expect(onChange).toHaveBeenCalledWith([]);
});

test("incluye las suscripciones de la matriz historica", () => {
  render(<SubscriptionFilter options={opts} selected={[]} onChange={vi.fn()} />);
  abrir();
  expect(screen.getByText("(matriz historica)")).toBeInTheDocument();
});

test("cada opcion muestra su casilla aunque no este marcada (se ve que es multiple)", () => {
  render(<SubscriptionFilter options={opts} selected={["sub-a"]} onChange={vi.fn()} />);
  abrir();
  const items = screen.getAllByRole("menuitemcheckbox");
  expect(items).toHaveLength(3);
  // Las tres tienen casilla; solo la seleccionada va rellena.
  for (const item of items) expect(item.querySelector("span[aria-hidden]")).toBeTruthy();
  const marcada = items.find((i) => i.getAttribute("aria-checked") === "true")!;
  const sinMarcar = items.find((i) => i.getAttribute("aria-checked") !== "true")!;
  expect(marcada.querySelector("span[aria-hidden]")?.className).toContain("bg-primary");
  expect(sinMarcar.querySelector("span[aria-hidden]")?.className).not.toContain("bg-primary");
});

test("marcar una segunda no reemplaza a la primera", () => {
  const onChange = vi.fn();
  render(<SubscriptionFilter options={opts} selected={["sub-a"]} onChange={onChange} />);
  abrir();
  fireEvent.click(screen.getByText("dev"));
  expect(onChange).toHaveBeenCalledWith(["sub-a", "sub-b"]);
});

test("invita a marcar una o varias", () => {
  render(<SubscriptionFilter options={opts} selected={[]} onChange={vi.fn()} />);
  abrir();
  expect(screen.getByText("Marque una o varias.")).toBeInTheDocument();
});

test("avisa que el avance no cambia con el filtro", () => {
  render(<SubscriptionFilter options={opts} selected={[]} onChange={vi.fn()} />);
  abrir();
  expect(screen.getByText(/El avance es por recomendación/i)).toBeInTheDocument();
});
