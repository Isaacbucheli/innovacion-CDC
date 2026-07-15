import { describe, expect, test } from "vitest";
import {
  humanizeSyncError, overallSyncStatus, subStatusLabel, subStatusTone,
} from "@/lib/advisorSyncStatus";
import type { SubscriptionSyncResult } from "@/types";

describe("subStatusLabel / subStatusTone", () => {
  test("mapea los tres estados a etiqueta amigable", () => {
    expect(subStatusLabel("ok")).toBe("Sincronizada");
    expect(subStatusLabel("partial")).toBe("Parcial");
    expect(subStatusLabel("error")).toBe("Con error");
  });
  test("mapea los tres estados a tono de color", () => {
    expect(subStatusTone("ok")).toBe("ok");
    expect(subStatusTone("partial")).toBe("warn");
    expect(subStatusTone("error")).toBe("error");
  });
});

describe("humanizeSyncError", () => {
  test("ok → mensaje de completado (ignora el error)", () => {
    expect(humanizeSyncError("ok", null)).toBe("Sincronización completa.");
  });

  test("partial → explica la paginación truncada y el reintento", () => {
    const m = humanizeSyncError("partial", null);
    expect(m).toContain("no entregó todas las páginas");
    expect(m).toContain("se reintentará");
  });

  test("error 404 / not found / temporarily unavailable → no disponible", () => {
    const expected = "Azure Advisor no respondió para esta suscripción (resultado no disponible); se reintentará.";
    expect(humanizeSyncError("error", "HttpResponseError: 404 The resource was not found")).toBe(expected);
    expect(humanizeSyncError("error", "Advisor is Temporarily Unavailable")).toBe(expected);
    expect(humanizeSyncError("error", "ResourceNotFound: not found")).toBe(expected);
  });

  test("error auth (401/403/unauthorized/forbidden/auth) → acceso fallido", () => {
    const expected = "Falló el acceso a Azure para esta suscripción (revisar credencial o permisos).";
    expect(humanizeSyncError("error", "401 Unauthorized")).toBe(expected);
    expect(humanizeSyncError("error", "403 Forbidden")).toBe(expected);
    expect(humanizeSyncError("error", "AuthenticationFailedError: token expired")).toBe(expected);
  });

  test("error timeout / timed out → tardó demasiado", () => {
    const expected = "La consulta a Advisor tardó demasiado; se reintentará.";
    expect(humanizeSyncError("error", "TimeoutError: request timeout")).toBe(expected);
    expect(humanizeSyncError("error", "operation timed out after 600s")).toBe(expected);
  });

  test("error genérico → texto crudo recortado a ~160 chars", () => {
    expect(humanizeSyncError("error", "Something unexpected broke")).toBe("Something unexpected broke");
    const long = "x".repeat(300);
    const out = humanizeSyncError("error", long);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBe(161); // 160 chars + elipsis
  });

  test("error vacío → mensaje de desconocido", () => {
    expect(humanizeSyncError("error", "")).toBe("Error desconocido.");
    expect(humanizeSyncError("error", null)).toBe("Error desconocido.");
  });
});

describe("overallSyncStatus", () => {
  const r = (status: SubscriptionSyncResult["status"]): SubscriptionSyncResult => ({
    subscription_id: "s", subscription_name: "Sub", status, error: null,
  });
  test("cualquier error domina", () => {
    expect(overallSyncStatus([r("ok"), r("partial"), r("error")])).toBe("error");
  });
  test("sin error pero con parcial → parcial", () => {
    expect(overallSyncStatus([r("ok"), r("partial")])).toBe("partial");
  });
  test("todo ok → ok", () => {
    expect(overallSyncStatus([r("ok"), r("ok")])).toBe("ok");
  });
});
