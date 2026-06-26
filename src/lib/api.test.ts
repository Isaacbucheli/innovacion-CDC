import { afterEach, expect, test, vi } from "vitest";
import { request } from "@/lib/api";
import { setSession } from "@/lib/auth";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

test("adjunta Bearer y parsea JSON", async () => {
  setSession("tok", "admin", "x");
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify([{ ok: 1 }]), { status: 200, headers: { "Content-Type": "application/json" } })
  );
  vi.stubGlobal("fetch", fetchMock);
  const data = await request<{ ok: number }[]>("/alert-catalog");
  expect(data[0].ok).toBe(1);
  const [, init] = fetchMock.mock.calls[0];
  expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
});

test("lanza con el detail del error en !ok", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ detail: "Boom" }), { status: 400 })
  ));
  await expect(request("/x")).rejects.toThrow("Boom");
});
