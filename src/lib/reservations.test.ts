import { expect, test } from "vitest";
import { situacion, utilNum, utilBucket, isInactive, avgUtilization7d, appliedScopeText, daysLabel } from "@/lib/reservations";

test("situación según días y aviso", () => {
  expect(situacion({ expired: true, days_remaining: -10 }, 30)).toBe("venc");
  expect(situacion({ expired: false, days_remaining: -1 }, 30)).toBe("venc");
  expect(situacion({ expired: false, days_remaining: 15 }, 30)).toBe("por");
  expect(situacion({ expired: false, days_remaining: 90 }, 30)).toBe("vig");
});

test("utilNum y utilBucket", () => {
  expect(utilNum("n/d")).toBe(null);
  expect(utilNum("37%")).toBe(37);
  expect(utilNum(0)).toBe(0);
  expect(utilBucket(null)).toBe("nd");
  expect(utilBucket("10%")).toBe("low");
  expect(utilBucket("50%")).toBe("mid");
  expect(utilBucket("80%")).toBe("high");
});

test("isInactive por estado", () => {
  expect(isInactive({ state: "Expired" })).toBe(true);
  expect(isInactive({ state: "Cancelled" })).toBe(true);
  expect(isInactive({ state: "Succeeded" })).toBe(false);
});

test("avgUtilization7d ignora n/d", () => {
  expect(avgUtilization7d([{ utilization7d: "40%" }, { utilization7d: "60%" }, { utilization7d: null }])).toBe(50);
  expect(avgUtilization7d([{ utilization7d: null }])).toBe(null);
});

test("appliedScopeText", () => {
  expect(appliedScopeText({ applied_scope_type: "Shared", applied_scopes: [] })).toMatch(/Compartida/);
  expect(appliedScopeText({ applied_scope_type: "Single", applied_scopes: ["/subscriptions/abc/x"] })).toMatch(/Suscripción específica: x/);
});

test("daysLabel", () => {
  expect(daysLabel({ expired: true, days_remaining: -5 })).toBe("Vencida (-5)");
  expect(daysLabel({ expired: false, days_remaining: 12 })).toBe("12 días");
});
