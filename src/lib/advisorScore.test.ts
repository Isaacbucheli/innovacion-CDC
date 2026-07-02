import { describe, expect, test, vi } from "vitest";
import { refreshAdvisorScoreBatch } from "@/lib/advisorScore";
import type { ClientAdmin } from "@/types";

const C = (over: Partial<ClientAdmin>): ClientAdmin => ({
  client_id: 1,
  client_name: "Cliente",
  tax_id: null,
  contact_name: null,
  contact_email: null,
  is_active: true,
  created_at: null,
  has_logo: false,
  ...over,
});

describe("refreshAdvisorScoreBatch", () => {
  test("llama a la ruta por-cliente una vez por cada cliente ACTIVO (no la ruta all-clients)", async () => {
    const clients = [
      C({ client_id: 1, is_active: true }),
      C({ client_id: 2, is_active: false }), // inactivo → se omite
      C({ client_id: 3, is_active: true }),
    ];
    const refreshOne = vi.fn(async () => ({}));

    const r = await refreshAdvisorScoreBatch(clients, true, undefined, refreshOne);

    expect(refreshOne).toHaveBeenCalledTimes(2);
    expect(refreshOne).toHaveBeenCalledWith(1, true);
    expect(refreshOne).toHaveBeenCalledWith(3, true);
    expect(r).toEqual({ total: 2, refreshed: 2, failed: 0 });
  });

  test("un fallo por cliente no aborta el lote: se cuenta y continúa", async () => {
    const clients = [C({ client_id: 1 }), C({ client_id: 2 }), C({ client_id: 3 })];
    const refreshOne = vi.fn(async (id: number) => {
      if (id === 2) throw new Error("boom");
      return {};
    });

    const r = await refreshAdvisorScoreBatch(clients, false, undefined, refreshOne);

    expect(refreshOne).toHaveBeenCalledTimes(3);
    expect(r).toEqual({ total: 3, refreshed: 2, failed: 1 });
  });

  test("reporta progreso done/total/nombre por cada cliente activo", async () => {
    const clients = [C({ client_id: 1, client_name: "Uno" }), C({ client_id: 2, client_name: "Dos" })];
    const progress: Array<[number, number, string]> = [];
    await refreshAdvisorScoreBatch(
      clients,
      true,
      (done, total, name) => progress.push([done, total, name]),
      async () => ({}),
    );
    expect(progress).toEqual([
      [0, 2, "Uno"],
      [1, 2, "Dos"],
    ]);
  });

  test("sin clientes activos: total 0, no llama refreshOne", async () => {
    const refreshOne = vi.fn(async () => ({}));
    const r = await refreshAdvisorScoreBatch([C({ is_active: false })], true, undefined, refreshOne);
    expect(refreshOne).not.toHaveBeenCalled();
    expect(r).toEqual({ total: 0, refreshed: 0, failed: 0 });
  });
});
