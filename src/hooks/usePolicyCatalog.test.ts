import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { usePolicyCatalog } from "@/hooks/usePolicyCatalog";
import * as api from "@/lib/api";
import type { Policy } from "@/types";

vi.mock("@/lib/api");

const policy: Policy = {
  policy_id: 1, policy_number: 1, name: "Allowed locations", category: "Gobierno / Cumplimiento geográfico",
  policy_type: "Built-in Azure Policy", recommended_effect: "Deny", mode: "Indexed",
  key_parameters: "listOfAllowedLocations", description: null, objective: null, recommended_scope: null,
  rollout: null, risk: null, example_parameters: null, azure_cli: null, powershell: null,
  script_notes: null, official_source: null, is_active: true,
};

beforeEach(() => {
  vi.mocked(api.listPolicies).mockReset();
});

test("carga inicial puebla policies y deja loading en false", async () => {
  vi.mocked(api.listPolicies).mockResolvedValue([policy]);

  const { result } = renderHook(() => usePolicyCatalog());
  expect(result.current.loading).toBe(true);

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.policies).toEqual([policy]);
  expect(result.current.error).toBe("");
});

test("error en la carga expone el mensaje y deja loading en false", async () => {
  vi.mocked(api.listPolicies).mockRejectedValue(new Error("boom"));

  const { result } = renderHook(() => usePolicyCatalog());

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe("boom");
  expect(result.current.policies).toEqual([]);
});

test("reload vuelve a invocar la función de carga", async () => {
  vi.mocked(api.listPolicies).mockResolvedValue([policy]);

  const { result } = renderHook(() => usePolicyCatalog());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(api.listPolicies).toHaveBeenCalledTimes(1);

  await result.current.reload();
  expect(api.listPolicies).toHaveBeenCalledTimes(2);
});
