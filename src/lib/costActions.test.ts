import { beforeEach, expect, test, vi } from "vitest";
import * as api from "@/lib/api";
import { COST_CALCULATION_BATCH_SIZE, bestEffortRefresh, runCalculation } from "@/lib/costActions";

vi.mock("@/lib/api", () => ({
  calculateCosts: vi.fn(),
  recalcScenarios: vi.fn(),
  refreshRiCoverage: vi.fn(),
  refreshPowerHistory: vi.fn(),
}));

const mocked = api as unknown as {
  calculateCosts: ReturnType<typeof vi.fn>;
  recalcScenarios: ReturnType<typeof vi.fn>;
  refreshRiCoverage: ReturnType<typeof vi.fn>;
  refreshPowerHistory: ReturnType<typeof vi.fn>;
};

beforeEach(() => vi.clearAllMocks());

test("itera lotes mientras has_more; replace_existing solo en el primer lote", async () => {
  mocked.calculateCosts
    .mockResolvedValueOnce({ analysis_id: 1, summary: { vms: { has_more: true } } })
    .mockResolvedValueOnce({ analysis_id: 1, summary: { vms: { has_more: false } } });

  await runCalculation(1, ["vms"], { autoBuildScenarios: false });

  expect(mocked.calculateCosts).toHaveBeenCalledTimes(2);
  expect(mocked.calculateCosts.mock.calls[0][1]).toMatchObject({
    resource_offset: 0,
    replace_existing: true,
    resource_limit: COST_CALCULATION_BATCH_SIZE,
  });
  expect(mocked.calculateCosts.mock.calls[1][1]).toMatchObject({
    resource_offset: COST_CALCULATION_BATCH_SIZE,
    replace_existing: false,
  });
  expect(mocked.recalcScenarios).not.toHaveBeenCalled();
});

test("autoBuildScenarios arma escenarios al final", async () => {
  mocked.calculateCosts.mockResolvedValue({ analysis_id: 1, summary: { disks: { has_more: false } } });
  await runCalculation(1, ["disks"], { autoBuildScenarios: true });
  expect(mocked.recalcScenarios).toHaveBeenCalledWith(1);
});

test("bestEffortRefresh no lanza aunque ambos pasos fallen", async () => {
  mocked.refreshRiCoverage.mockRejectedValue(new Error("x"));
  mocked.refreshPowerHistory.mockRejectedValue(new Error("y"));
  await expect(bestEffortRefresh(1)).resolves.toBeUndefined();
});
