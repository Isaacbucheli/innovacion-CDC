import { describe, expect, test, vi } from "vitest";
import { pollPowerHistory, powerToastMessage } from "@/lib/powerHistory";
import type { PowerHistoryJobStatus } from "@/types";

const noDelay = () => Promise.resolve();

describe("pollPowerHistory", () => {
  test("resuelve al llegar 'completed' e itera mientras 'running'", async () => {
    const seq: PowerHistoryJobStatus[] = [
      { status: "running" },
      { status: "running" },
      { status: "completed", summary: { updated_count: 5, source: "activity_log", period_start: "2026-05-01T00:00:00Z" } },
    ];
    const getStatus = vi.fn().mockImplementation(() => Promise.resolve(seq.shift()!));
    const result = await pollPowerHistory(1, { getStatus, delay: noDelay, maxAttempts: 10 });
    expect(result.status).toBe("completed");
    expect(getStatus).toHaveBeenCalledTimes(3);
  });

  test("resuelve al llegar 'failed'", async () => {
    const getStatus = vi.fn().mockResolvedValue({ status: "failed", error: "boom" });
    const result = await pollPowerHistory(1, { getStatus, delay: noDelay, maxAttempts: 10 });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("boom");
  });

  test("corta al llegar al tope de intentos y devuelve el último estado", async () => {
    const getStatus = vi.fn().mockResolvedValue({ status: "running" });
    const result = await pollPowerHistory(1, { getStatus, delay: noDelay, maxAttempts: 4 });
    expect(result.status).toBe("running");
    expect(getStatus).toHaveBeenCalledTimes(4);
  });
});

describe("powerToastMessage", () => {
  test("completed con resumen → ok con conteo, periodo y fuente", () => {
    const m = powerToastMessage({
      status: "completed",
      summary: { updated_count: 5, source: "activity_log", period_start: "2026-05-01T00:00:00Z" },
    });
    expect(m.ok).toBe(true);
    expect(m.text).toContain("5");
    expect(m.text).toContain("2026-05");
  });

  test("failed → no ok con el error", () => {
    const m = powerToastMessage({ status: "failed", error: "sin permiso" });
    expect(m.ok).toBe(false);
    expect(m.text).toContain("sin permiso");
  });

  test("running (timeout) → no ok, mensaje de que sigue en proceso", () => {
    const m = powerToastMessage({ status: "running" });
    expect(m.ok).toBe(false);
    expect(m.text.toLowerCase()).toContain("proceso");
  });
});
