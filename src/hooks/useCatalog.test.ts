import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { useCatalog } from "@/hooks/useCatalog";
import * as api from "@/lib/api";
import type { Alert, KqlQuery } from "@/types";

vi.mock("@/lib/api");

const alert: Alert = {
  alert_id: 1, alert_number: 1, name: "Rol RBAC", resource: "Suscripción", alert_type: "Seguridad",
  description: null, severity: "ALTA", origin: "Activity Log", detail: null, action_group: null,
  kql_code: null, technical_requirement: null, is_active: true,
};
const kql: KqlQuery = { kql_id: 1, name: "Q1", description: null, kql_query: null, is_active: true };

beforeEach(() => {
  vi.mocked(api.listAlerts).mockReset();
  vi.mocked(api.listKql).mockReset();
});

test("carga inicial puebla alerts y kql y deja loading en false", async () => {
  vi.mocked(api.listAlerts).mockResolvedValue([alert]);
  vi.mocked(api.listKql).mockResolvedValue([kql]);

  const { result } = renderHook(() => useCatalog());
  expect(result.current.loading).toBe(true);

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.alerts).toEqual([alert]);
  expect(result.current.kql).toEqual([kql]);
  expect(result.current.error).toBe("");
});

test("error en la carga expone el mensaje y deja loading en false", async () => {
  vi.mocked(api.listAlerts).mockRejectedValue(new Error("boom"));
  vi.mocked(api.listKql).mockResolvedValue([kql]);

  const { result } = renderHook(() => useCatalog());

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe("boom");
  expect(result.current.alerts).toEqual([]);
});

test("reload vuelve a invocar las funciones de carga", async () => {
  vi.mocked(api.listAlerts).mockResolvedValue([alert]);
  vi.mocked(api.listKql).mockResolvedValue([kql]);

  const { result } = renderHook(() => useCatalog());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(api.listAlerts).toHaveBeenCalledTimes(1);
  expect(api.listKql).toHaveBeenCalledTimes(1);

  await result.current.reload();
  expect(api.listAlerts).toHaveBeenCalledTimes(2);
  expect(api.listKql).toHaveBeenCalledTimes(2);
});
