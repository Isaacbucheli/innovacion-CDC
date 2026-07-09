import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import PolicyFormDialog from "@/components/policies/PolicyFormDialog";
import * as api from "@/lib/api";
import type { Policy } from "@/types";

afterEach(() => vi.restoreAllMocks());

test("crea una política nueva y llama onSaved", async () => {
  vi.spyOn(api, "createPolicy").mockResolvedValue({ policy_id: 9 });
  const onSaved = vi.fn();
  render(<PolicyFormDialog open policy={null} onOpenChange={() => {}} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Nueva política X" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
  await waitFor(() => expect(api.createPolicy).toHaveBeenCalledWith(expect.objectContaining({ name: "Nueva política X" })));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
});

test("edita una política existente y llama updatePolicy con su id", async () => {
  const update = vi.spyOn(api, "updatePolicy").mockResolvedValue({});
  const onSaved = vi.fn();
  const policy: Policy = {
    policy_id: 42,
    policy_number: 7,
    name: "Política existente",
    category: null,
    policy_type: null,
    recommended_effect: null,
    mode: null,
    key_parameters: null,
    description: null,
    objective: null,
    recommended_scope: null,
    rollout: null,
    risk: null,
    example_parameters: null,
    azure_cli: null,
    powershell: null,
    script_notes: null,
    official_source: null,
    is_active: true,
  };
  render(<PolicyFormDialog open policy={policy} onOpenChange={() => {}} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Política editada" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
  await waitFor(() => expect(update).toHaveBeenCalledWith(42, expect.objectContaining({ name: "Política editada" })));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
});

test("muestra error cuando la API falla y no llama onSaved", async () => {
  vi.spyOn(api, "createPolicy").mockRejectedValue(new Error("Sin permiso"));
  const onSaved = vi.fn();
  render(<PolicyFormDialog open policy={null} onOpenChange={() => {}} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Política X" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
  await waitFor(() => expect(screen.getByText(/sin permiso/i)).toBeTruthy());
  expect(onSaved).not.toHaveBeenCalled();
});
