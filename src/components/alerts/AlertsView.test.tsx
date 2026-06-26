import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import AlertsView from "@/components/alerts/AlertsView";
import type { Alert } from "@/types";

const alerts: Alert[] = [{
  alert_id: 1, alert_number: 1, name: "Rol RBAC", resource: "Suscripción", alert_type: "Seguridad",
  description: null, severity: "ALTA", origin: "Activity Log", detail: null, action_group: null,
  kql_code: null, technical_requirement: null, is_active: true,
}];

test("renderiza tarjetas y filtra por búsqueda", () => {
  render(<AlertsView alerts={alerts} kqlCount={3} canEdit={false} onOpen={vi.fn()} onNew={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.getByText("Rol RBAC")).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: "zzz" } });
  expect(screen.queryByText("Rol RBAC")).not.toBeInTheDocument();
});
