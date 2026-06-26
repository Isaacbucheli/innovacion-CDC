import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import LoginScreen from "@/components/LoginScreen";
import * as api from "@/lib/api";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

test("hace login y llama onAuthed", async () => {
  vi.spyOn(api, "login").mockResolvedValue({ access_token: "tok", role: "consultor", full_name: "Isaac" });
  const onAuthed = vi.fn();
  render(<LoginScreen onAuthed={onAuthed} />);
  fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: "a@b.com" } });
  fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: "secret" } });
  fireEvent.click(screen.getByRole("button", { name: /ingresar/i }));
  await waitFor(() => expect(onAuthed).toHaveBeenCalled());
});
