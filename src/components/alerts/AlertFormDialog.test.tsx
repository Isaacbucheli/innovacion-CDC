import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AlertFormDialog from "@/components/alerts/AlertFormDialog";
import * as api from "@/lib/api";

afterEach(() => vi.restoreAllMocks());

test("crea una alerta nueva y llama onSaved", async () => {
  vi.spyOn(api, "createAlert").mockResolvedValue({ alert_id: 9 });
  const onSaved = vi.fn();
  render(<AlertFormDialog open alert={null} onOpenChange={() => {}} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Nueva alerta X" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
  await waitFor(() => expect(api.createAlert).toHaveBeenCalled());
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
});
