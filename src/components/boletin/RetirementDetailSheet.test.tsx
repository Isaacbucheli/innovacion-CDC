import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import RetirementDetailSheet from "@/components/boletin/RetirementDetailSheet";
import type { BoletinGroup, BoletinSubscription } from "@/types";

const baseGroup: BoletinGroup = {
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
  subscription_ids: ["11111111-1111-1111-1111-111111111111"],
  resources: [
    {
      fingerprint: "fp-1",
      subscription_id: "11111111-1111-1111-1111-111111111111",
      resource_id: "/subscriptions/1111.../ip1",
      resource_name: "ip1",
      resource_type: "Microsoft.Network/publicIPAddresses",
      derived: false,
    },
  ],
};

const subs: BoletinSubscription[] = [
  { subscription_id: "11111111-1111-1111-1111-111111111111", name: "Producción" },
];

test("muestra el nombre de la suscripcion (no el GUID) en la columna Suscripcion, con nombre completo + GUID en el hover", () => {
  render(
    <RetirementDetailSheet group={baseGroup} subscriptions={subs} open onOpenChange={() => {}} />,
  );

  const cell = screen.getByText("Producción");
  expect(cell).toBeInTheDocument();
  // El hover lleva el nombre COMPLETO (la celda trunca) y el GUID como referencia.
  expect(cell.getAttribute("title")).toBe("Producción (11111111-1111-1111-1111-111111111111)");
  expect(screen.queryByText("11111111-1111-1111-1111-111111111111")).not.toBeInTheDocument();
});

test("cae al GUID si la suscripcion no tiene nombre conocido", () => {
  render(
    <RetirementDetailSheet group={baseGroup} subscriptions={[]} open onOpenChange={() => {}} />,
  );

  expect(screen.getByText("11111111-1111-1111-1111-111111111111")).toBeInTheDocument();
});

test("aviso a nivel de suscripcion muestra el nombre en la lista (nombre completo + GUID en el hover)", () => {
  const subLevelGroup: BoletinGroup = {
    ...baseGroup,
    source: "service_health",
    resource_count: 0,
    derived_resource_count: 0,
    resources: [],
    subscription_ids: ["22222222-2222-2222-2222-222222222222"],
  };
  const subLevelSubs: BoletinSubscription[] = [
    { subscription_id: "22222222-2222-2222-2222-222222222222", name: "Desarrollo" },
  ];

  render(
    <RetirementDetailSheet group={subLevelGroup} subscriptions={subLevelSubs} open onOpenChange={() => {}} />,
  );

  const item = screen.getByText("Desarrollo");
  expect(item).toBeInTheDocument();
  expect(item.getAttribute("title")).toBe("Desarrollo (22222222-2222-2222-2222-222222222222)");
});

test("marca los recursos derivados del inventario con su badge y nota", () => {
  const group: BoletinGroup = {
    ...baseGroup,
    resource_count: 2,
    derived_resource_count: 1,
    resources: [
      { fingerprint: "f1", subscription_id: "11111111-1111-1111-1111-111111111111", resource_id: "/r/1", resource_name: "conf", resource_type: "T", derived: false },
      { fingerprint: "f2", subscription_id: "11111111-1111-1111-1111-111111111111", resource_id: "/r/2", resource_name: "inf", resource_type: "T", derived: true },
    ],
  };
  render(<RetirementDetailSheet group={group} subscriptions={[]} open onOpenChange={() => {}} />);
  expect(screen.getByText("Inventario")).toBeInTheDocument();
  expect(screen.getByText(/derivados del inventario/i)).toBeInTheDocument();

  // Defer E1: el recurso NO derivado (fp-1: "conf") no debe llevar el badge "Inventario".
  const confRow = screen.getByText("conf").closest("tr");
  expect(confRow).not.toBeNull();
  expect(within(confRow as HTMLElement).queryByText("Inventario")).not.toBeInTheDocument();
});
