import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import ChangePasswordScreen from "@/components/ChangePasswordScreen";
import * as api from "@/lib/api";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

function fill(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText(/contraseña temporal/i), { target: { value: current } });
  fireEvent.change(screen.getByLabelText(/^nueva contraseña$/i), { target: { value: next } });
  fireEvent.change(screen.getByLabelText(/confirmar nueva contraseña/i), { target: { value: confirm } });
}

test("cambia la contraseña y llama onChanged", async () => {
  const spy = vi.spyOn(api, "changePassword").mockResolvedValue({ changed: true, must_change_password: false });
  const onChanged = vi.fn();
  render(<ChangePasswordScreen onChanged={onChanged} />);
  fill("Temporal123", "Definitiva456", "Definitiva456");
  fireEvent.click(screen.getByRole("button", { name: /guardar y continuar/i }));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  expect(spy).toHaveBeenCalledWith("Temporal123", "Definitiva456");
});

test("valida mínimo 8, distinta a la temporal y confirmación sin llamar a la API", async () => {
  const spy = vi.spyOn(api, "changePassword");
  const onChanged = vi.fn();
  render(<ChangePasswordScreen onChanged={onChanged} />);

  fill("Temporal123", "corta", "corta");
  fireEvent.click(screen.getByRole("button", { name: /guardar y continuar/i }));
  await waitFor(() => expect(screen.getByText(/al menos 8 caracteres/i)).toBeInTheDocument());

  fill("Temporal123", "Temporal123", "Temporal123");
  fireEvent.click(screen.getByRole("button", { name: /guardar y continuar/i }));
  await waitFor(() => expect(screen.getByText(/distinta a la temporal/i)).toBeInTheDocument());

  fill("Temporal123", "Definitiva456", "OtraCosa789");
  fireEvent.click(screen.getByRole("button", { name: /guardar y continuar/i }));
  await waitFor(() => expect(screen.getByText(/no coincide/i)).toBeInTheDocument());

  expect(spy).not.toHaveBeenCalled();
  expect(onChanged).not.toHaveBeenCalled();
});

test("muestra el error del backend cuando la temporal es incorrecta", async () => {
  vi.spyOn(api, "changePassword").mockRejectedValue(new Error("La contraseña actual no es correcta"));
  const onChanged = vi.fn();
  render(<ChangePasswordScreen onChanged={onChanged} />);
  fill("Equivocada1", "Definitiva456", "Definitiva456");
  fireEvent.click(screen.getByRole("button", { name: /guardar y continuar/i }));
  await waitFor(() => expect(screen.getByText(/no es correcta/i)).toBeInTheDocument());
  expect(onChanged).not.toHaveBeenCalled();
});
