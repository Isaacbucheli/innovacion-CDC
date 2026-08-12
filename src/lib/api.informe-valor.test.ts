import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { descargarEntregaInformeValor, subirInsumoInformeValor } from "./api";

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

describe("descargarEntregaInformeValor", () => {
  const urlGlobal = URL as unknown as {
    createObjectURL?: (b: Blob) => string; revokeObjectURL?: (u: string) => void;
  };
  const original = { crear: urlGlobal.createObjectURL, revocar: urlGlobal.revokeObjectURL };

  beforeEach(() => {
    localStorage.setItem("innovacion_cdc_token", "tok-123");
    // jsdom no implementa createObjectURL, que es como baja el blob el resto del producto.
    urlGlobal.createObjectURL = () => "blob:informe";
    urlGlobal.revokeObjectURL = () => {};
  });

  afterEach(() => {
    localStorage.clear();
    urlGlobal.createObjectURL = original.crear;
    urlGlobal.revokeObjectURL = original.revocar;
    vi.restoreAllMocks();
  });

  // La descarga sale de la ENTREGA ARCHIVADA, no de un cálculo nuevo: reemitir un informe viejo
  // contra los datos de hoy le cambiaría las cifras, que es justo lo que el archivo evita.
  it("pega en el endpoint de la entrega archivada, con el Bearer", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("<html></html>", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await descargarEntregaInformeValor(7, {
      entrega_id: 5, period_start: "2026-01-01", period_end: "2026-06-01", corte: "2026-07-15",
      variante: "cliente", bloques_publicados: [], rbac_origen: "base",
      file_name: "informe.html", blob_size_bytes: 100, generated_by: null,
      generated_at: "2026-07-16T18:30:00Z",
    });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/informe-valor/clients/7/entregas/5/descargar");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer tok-123");
  });
});
