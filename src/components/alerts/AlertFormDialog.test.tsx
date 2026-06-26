import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AlertFormDialog from "@/components/alerts/AlertFormDialog";
import * as api from "@/lib/api";
import type { Alert } from "@/types";

afterEach(() => vi.restoreAllMocks());

test("crea una alerta nueva y llama onSaved", async () => {
  vi.spyOn(api, "createAlert").mockResolvedValue({ alert_id: 9 });
  const onSaved = vi.fn();
  render(<AlertFormDialog open alert={null} onOpenChange={() => {}} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Nueva alerta X" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
  await waitFor(() => expect(api.createAlert).toHaveBeenCalledWith(expect.objectContaining({ name: "Nueva alerta X" })));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
});

test("edita una alerta existente y llama updateAlert con su id", async () => {
  const update = vi.spyOn(api, "updateAlert").mockResolvedValue({});
  const onSaved = vi.fn();
  const alert: Alert = {
    alert_id: 42,
    alert_number: 7,
    name: "Alerta existente",
    resource: null,
    alert_type: null,
    description: null,
    severity: null,
    origin: null,
    detail: null,
    action_group: null,
    kql_code: null,
    technical_requirement: null,
    is_active: true,
  };
  render(<AlertFormDialog open alert={alert} onOpenChange={() => {}} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Alerta editada" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
  await waitFor(() => expect(update).toHaveBeenCalledWith(42, expect.objectContaining({ name: "Alerta editada" })));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
});

test("muestra error cuando la API falla y no llama onSaved", async () => {
  vi.spyOn(api, "createAlert").mockRejectedValue(new Error("Sin permiso"));
  const onSaved = vi.fn();
  render(<AlertFormDialog open alert={null} onOpenChange={() => {}} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Alerta X" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
  await waitFor(() => expect(screen.getByText(/sin permiso/i)).toBeTruthy());
  expect(onSaved).not.toHaveBeenCalled();
});
