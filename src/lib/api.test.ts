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
      JSON.stringify({ csrf_token: "csrf", role: "consultor", full_name: "Isaac" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  ));
  const r = await login("isaac@bit.com", "secret");
  expect(r.csrf_token).toBe("csrf");
  expect(getToken()).toBe("");
  expect(getRole()).toBe("consultor");
  expect(getName()).toBe("Isaac");
});

test("login usa email como nombre cuando falta full_name", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ csrf_token: "csrf", role: "consultor", email: "isaac@bit.com" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  ));
  await login("isaac@bit.com", "secret");
  expect(getName()).toBe("isaac@bit.com");
});

test("login envía 'username' (no 'email') en el body, según el contrato de la API", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ csrf_token: "csrf", role: "lector" }),
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

  it("consolidateWafDuplicates POST con use_ai en la query", async () => {
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    const { consolidateWafDuplicates } = await import("@/lib/api");
    await consolidateWafDuplicates(3, true);
    const calls = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain("/waf/clients/3/consolidate-duplicates?use_ai=true");
    expect((calls[0][1] as RequestInit).method).toBe("POST");
  });

  // Ruta por cliente (no la admin): el client_id va en la URL, no en el body, para que el
  // backend pueda validar el acceso al cliente y el consultor no pueda apuntar a otro.
  it("refreshWafAdvisorScore POST a la ruta del cliente, sin client_id en el body", async () => {
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    const { refreshWafAdvisorScore } = await import("@/lib/api");
    await refreshWafAdvisorScore(3, false);
    const calls = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain("/waf/clients/3/advisor-score/refresh");
    expect(calls[0][0]).not.toContain("/waf/admin/");
    expect(JSON.parse((calls[0][1] as RequestInit).body as string)).toEqual({ include_in_reports: false });
  });

  it("refreshWafAdvisorScoreAll sigue usando la ruta admin (barrido de todos)", async () => {
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    const { refreshWafAdvisorScoreAll } = await import("@/lib/api");
    await refreshWafAdvisorScoreAll(true);
    const calls = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain("/waf/admin/advisor-score/refresh");
    expect(JSON.parse((calls[0][1] as RequestInit).body as string)).toEqual({ include_in_reports: true });
  });

  it("previewWafExcel postea multipart con use_ai", async () => {
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    const { previewWafExcel } = await import("@/lib/api");
    await previewWafExcel(3, new File(["x"], "m.xlsx"), true);
    const calls = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain("/waf/clients/3/excel-import/preview?use_ai=true");
    expect((calls[0][1] as RequestInit).body).toBeInstanceOf(FormData);
  });
  it("applyWafExcel postea el body con rows", async () => {
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    const { applyWafExcel } = await import("@/lib/api");
    await applyWafExcel(3, { rows: [{ row_number: 1, action: "update", approved: true, canonical_id: 9 }] });
    const calls = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain("/waf/clients/3/excel-import/apply");
    expect(JSON.parse((calls[0][1] as RequestInit).body as string).rows[0].canonical_id).toBe(9);
  });

  it("getWafCostReference arma la URL", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    const { getWafCostReference } = await import("@/lib/api");
    await getWafCostReference(3);
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain("/waf/clients/3/cost-reference");
  });
  it("getWafIngestionRuns arma la URL", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    const { getWafIngestionRuns } = await import("@/lib/api");
    await getWafIngestionRuns(3);
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain("/waf/clients/3/ingestion-runs");
  });

  it("getWafCatalog agrega review_status y excluded a la query", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    const { getWafCatalog } = await import("@/lib/api");
    await getWafCatalog({ review_status: "pending", excluded: false });
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain("/waf/admin/catalog?");
    expect(calls[0][0]).toContain("review_status=pending");
    expect(calls[0][0]).toContain("excluded=false");
  });
  it("analyzeAllWafCanonicals postea limit+apply", async () => {
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    const { analyzeAllWafCanonicals } = await import("@/lib/api");
    await analyzeAllWafCanonicals({ limit: 50, apply: true });
    const calls = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain("/waf/admin/ai/recommendations/analyze-all");
    expect(JSON.parse((calls[0][1] as RequestInit).body as string)).toEqual({ limit: 50, apply: true });
  });
});

test("getPowerHistoryStatus arma la URL de status", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "none" }), { status: 200, headers: { "Content-Type": "application/json" } })));
  const { getPowerHistoryStatus } = await import("@/lib/api");
  await getPowerHistoryStatus(5);
  const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
  expect(calls[0][0]).toContain("/analysis/5/power-history/status");
});

describe("Optimización api", () => {
  it("runOptimizationScan POST a /optimization/clients/{id}/scan", async () => {
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    const { runOptimizationScan } = await import("@/lib/api");
    await runOptimizationScan(6);
    const calls = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain("/optimization/clients/6/scan");
    expect((calls[0][1] as RequestInit).method).toBe("POST");
  });
  it("getScanFindings arma la URL del scan", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    const { getScanFindings } = await import("@/lib/api");
    await getScanFindings(42);
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain("/optimization/scans/42/findings");
  });
  it("listOptimizationScans arma la URL del historial", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    const { listOptimizationScans } = await import("@/lib/api");
    await listOptimizationScans(6);
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain("/optimization/clients/6/scans");
  });
  it("updateFindingState PUT con estado y nota en el body", async () => {
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    const { updateFindingState } = await import("@/lib/api");
    await updateFindingState("abcd", "resuelto", "ya migrado");
    const calls = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain("/optimization/findings/abcd/state");
    expect((calls[0][1] as RequestInit).method).toBe("PUT");
    expect(JSON.parse((calls[0][1] as RequestInit).body as string)).toEqual({ state: "resuelto", notes: "ya migrado" });
  });
});
