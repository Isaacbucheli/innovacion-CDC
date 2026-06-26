import { afterEach, expect, test, vi } from "vitest";
import { login, request } from "@/lib/api";
import { getName, getRole, getToken, setSession } from "@/lib/auth";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

test("adjunta Bearer y parsea JSON", async () => {
  setSession("tok", "admin", "x");
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify([{ ok: 1 }]), { status: 200, headers: { "Content-Type": "application/json" } })
  );
  vi.stubGlobal("fetch", fetchMock);
  const data = await request<{ ok: number }[]>("/alert-catalog");
  expect(data[0].ok).toBe(1);
  const [, init] = fetchMock.mock.calls[0];
  expect((init.headers as Headers).get("Authorization")).toBe("Bearer tok");
});

test("preserva headers pasados como Headers (HeadersInit no plano)", async () => {
  setSession("tok", "admin", "x");
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({}), { status: 200 })
  );
  vi.stubGlobal("fetch", fetchMock);
  await request("/x", { headers: new Headers({ "X-Custom": "1" }) });
  const [, init] = fetchMock.mock.calls[0];
  expect((init.headers as Headers).get("X-Custom")).toBe("1");
  expect((init.headers as Headers).get("Authorization")).toBe("Bearer tok");
});

test("lanza con el detail del error en !ok", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ detail: "Boom" }), { status: 400 })
  ));
  await expect(request("/x")).rejects.toThrow("Boom");
});

test("401 limpia la sesión, recarga y lanza 'Sesión expirada'", async () => {
  setSession("tok", "admin", "Isaac");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    new Response("", { status: 401 })
  ));
  const reload = vi.fn();
  vi.stubGlobal("location", { reload });
  await expect(request("/x")).rejects.toThrow("Sesión expirada");
  expect(getToken()).toBe("");
  expect(getRole()).toBe("lector");
  expect(reload).toHaveBeenCalled();
});

test("login persiste la sesión vía setSession", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ access_token: "abc", role: "consultor", full_name: "Isaac" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  ));
  const r = await login("isaac@bit.com", "secret");
  expect(r.access_token).toBe("abc");
  expect(getToken()).toBe("abc");
  expect(getRole()).toBe("consultor");
  expect(getName()).toBe("Isaac");
});

test("login usa email como nombre cuando falta full_name", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ access_token: "abc", role: "consultor", email: "isaac@bit.com" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  ));
  await login("isaac@bit.com", "secret");
  expect(getName()).toBe("isaac@bit.com");
});
