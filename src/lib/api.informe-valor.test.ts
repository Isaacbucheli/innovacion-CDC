import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { subirInsumoInformeValor } from "./api";

describe("subirInsumoInformeValor", () => {
  beforeEach(() => {
    localStorage.setItem("innovacion_cdc_token", "tok-123");
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("manda multipart sin fijar Content-Type y con el Bearer", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ingesta_id: 1, rows_total: 3, rows_processed: 2, rows_skipped: 1, warnings: [] }),
        { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const file = new File(["x"], "bitcost.xlsx");
    const r = await subirInsumoInformeValor(7, "facturacion", file, "http://api");

    expect(r.rows_processed).toBe(2);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://api/informe-valor/clients/7/insumos/facturacion");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    // El browser fija el boundary: si lo ponemos a mano, el server no puede parsear.
    expect((init.headers as Headers).has("Content-Type")).toBe(false);
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer tok-123");
  });

  it("desempaqueta el detail del error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "El archivo debe ser un Excel (.xlsx)." }), { status: 400 })));
    await expect(subirInsumoInformeValor(7, "facturacion", new File(["x"], "a.txt"), "http://api"))
      .rejects.toThrow("El archivo debe ser un Excel (.xlsx).");
  });
});
