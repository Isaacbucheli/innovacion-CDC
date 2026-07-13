import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AuthGate from "@/components/AuthGate";
import * as api from "@/lib/api";
import { getToken, setSession } from "@/lib/auth";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

test("sin token muestra LoginScreen sin llamar a me()", async () => {
  const meSpy = vi.spyOn(api, "me");
  render(<AuthGate><div>contenido protegido</div></AuthGate>);
  await waitFor(() => expect(screen.getByText(/ingresar/i)).toBeInTheDocument());
  expect(screen.queryByText(/contenido protegido/i)).not.toBeInTheDocument();
  expect(meSpy).not.toHaveBeenCalled();
});

test("con token válido y me() resuelto muestra los children", async () => {
  setSession("tok", "consultor", "Isaac");
  vi.spyOn(api, "me").mockResolvedValue({ role: "consultor", full_name: "Isaac" });
  render(<AuthGate><div>contenido protegido</div></AuthGate>);
  await waitFor(() => expect(screen.getByText(/contenido protegido/i)).toBeInTheDocument());
});

test("con token pero me() rechaza limpia la sesión y muestra LoginScreen", async () => {
  setSession("tok", "consultor", "Isaac");
  vi.spyOn(api, "me").mockRejectedValue(new Error("401"));
  render(<AuthGate><div>contenido protegido</div></AuthGate>);
  await waitFor(() => expect(screen.getByText(/ingresar/i)).toBeInTheDocument());
  expect(screen.queryByText(/contenido protegido/i)).not.toBeInTheDocument();
  expect(getToken()).toBe("");
});

test("con contraseña temporal fuerza la pantalla de cambio en lugar de los children", async () => {
  setSession("tok", "lector", "Nuevo");
  vi.spyOn(api, "me").mockResolvedValue({ role: "lector", full_name: "Nuevo", must_change_password: true });
  render(<AuthGate><div>contenido protegido</div></AuthGate>);
  await waitFor(() => expect(screen.getByText(/cambia tu contraseña/i)).toBeInTheDocument());
  expect(screen.queryByText(/contenido protegido/i)).not.toBeInTheDocument();
});
