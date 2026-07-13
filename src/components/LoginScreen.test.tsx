import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import LoginScreen from "@/components/LoginScreen";
import * as api from "@/lib/api";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

test("hace login y llama onAuthed sin cambio forzado", async () => {
  vi.spyOn(api, "login").mockResolvedValue({ access_token: "tok", role: "consultor", full_name: "Isaac" });
  const onAuthed = vi.fn();
  render(<LoginScreen onAuthed={onAuthed} />);
  fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: "a@b.com" } });
  fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: "secret" } });
  fireEvent.click(screen.getByRole("button", { name: /ingresar/i }));
  await waitFor(() => expect(onAuthed).toHaveBeenCalledWith(false));
});

test("con contraseña temporal llama onAuthed(true)", async () => {
  vi.spyOn(api, "login").mockResolvedValue({ access_token: "tok", role: "lector", full_name: "Nuevo", must_change_password: true });
  const onAuthed = vi.fn();
  render(<LoginScreen onAuthed={onAuthed} />);
  fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: "n@b.com" } });
  fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: "temporal1" } });
  fireEvent.click(screen.getByRole("button", { name: /ingresar/i }));
  await waitFor(() => expect(onAuthed).toHaveBeenCalledWith(true));
});

test("muestra el error y reactiva el botón cuando login falla", async () => {
  vi.spyOn(api, "login").mockRejectedValue(new Error("Credenciales inválidas"));
  const onAuthed = vi.fn();
  render(<LoginScreen onAuthed={onAuthed} />);
  fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: "a@b.com" } });
  fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: "secret" } });
  fireEvent.click(screen.getByRole("button", { name: /ingresar/i }));
  await waitFor(() => expect(screen.getByText(/credenciales inválidas/i)).toBeInTheDocument());
  expect(onAuthed).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /ingresar/i })).not.toBeDisabled();
});
