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

test("login envía 'username' (no 'email') en el body, según el contrato de la API", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ access_token: "abc", role: "lector" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  );
  vi.stubGlobal("fetch", fetchMock);
  await login("isaac@bit.com", "secret");
  const [, init] = fetchMock.mock.calls[0];
  const body = JSON.parse(init.body as string);
  expect(body.username).toBe("isaac@bit.com");
  expect(body.email).toBeUndefined();
  expect(body.password).toBe("secret");
});

import { describe, it, beforeEach } from "vitest";

describe("WAF api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
  });
  it("getWafRecommendations agrega el filtro de pilar", async () => {
    const { getWafRecommendations } = await import("@/lib/api");
    await getWafRecommendations(3, 5);
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("/waf/clients/3/recommendations?pillar=5");
  });
  it("getWafRecommendations sin pilar no agrega query", async () => {
    const { getWafRecommendations } = await import("@/lib/api");
    await getWafRecommendations(3);
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("/waf/clients/3/recommendations");
    expect(url).not.toContain("?pillar");
  });

  it("listClientSubscriptions arma la URL con client_id", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    const { listClientSubscriptions } = await import("@/lib/api");
    await listClientSubscriptions(7);
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("/azure/subscriptions?client_id=7");
  });

  it("uploadWafIngestion postea multipart al endpoint de ingestions", async () => {
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    const { uploadWafIngestion } = await import("@/lib/api");
    await uploadWafIngestion(3, new File(["a,b"], "advisor.csv", { type: "text/csv" }));
    const calls = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain("/waf/clients/3/ingestions");
    expect((calls[0][1] as RequestInit).method).toBe("POST");
    expect((calls[0][1] as RequestInit).body).toBeInstanceOf(FormData);
  });
});
