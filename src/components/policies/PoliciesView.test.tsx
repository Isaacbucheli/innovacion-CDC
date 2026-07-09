import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import PoliciesView from "@/components/policies/PoliciesView";
import type { Policy } from "@/types";

const policies: Policy[] = [{
  policy_id: 1, policy_number: 1, name: "Allowed locations", category: "Gobierno / Cumplimiento geográfico",
  policy_type: "Built-in Azure Policy", recommended_effect: "Deny", mode: "Indexed",
  key_parameters: "listOfAllowedLocations", description: null, objective: null,
  recommended_scope: "Management Group o Subscription", rollout: null, risk: null,
  example_parameters: null, azure_cli: null, powershell: null, script_notes: null,
  official_source: null, is_active: true,
}];

test("renderiza políticas y filtra por búsqueda", () => {
  render(<PoliciesView policies={policies} canEdit={false} onOpen={vi.fn()} onNew={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.getByText("Allowed locations")).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: "zzz" } });
  expect(screen.queryByText("Allowed locations")).not.toBeInTheDocument();
});

test("muestra los KPIs de la línea base", () => {
  render(<PoliciesView policies={policies} canEdit={false} onOpen={vi.fn()} onNew={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.getByText("Total políticas")).toBeInTheDocument();
  expect(screen.getByText("Deny recomendado")).toBeInTheDocument();
  expect(screen.getByText("Categorías")).toBeInTheDocument();
  expect(screen.getByText("Built-in")).toBeInTheDocument();
});

test("sin permiso de edición no muestra el botón Nueva política", () => {
  render(<PoliciesView policies={policies} canEdit={false} onOpen={vi.fn()} onNew={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.queryByRole("button", { name: /nueva política/i })).not.toBeInTheDocument();
});
