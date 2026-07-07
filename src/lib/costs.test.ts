import {
  applySubscriptionFilter,
  bestScenario,
  computeKpis,
  filterResults,
  formatMoney,
  formatPct,
  groupByService,
  pricingKind,
  powerHoursLabel,
  powerUptimeLabel,
  riConfirmed,
  rowPayg,
  statusMeta,
  subscriptionNames,
  translateNote,
  visibleServiceKey,
} from "@/lib/costs";
import type { CostResult, Scenario } from "@/types";

const R = (over: Partial<CostResult>): CostResult => ({
  cost_result_id: 1, resource_id: 1, service_key: "vms",
  resource_name: null, resource_type: null, location: null,
  subscription_name: null, resource_group: null, azure_resource_id: null,
  payg_hourly: null, payg_monthly: null, ri_1y_monthly: null, ri_3y_monthly: null,
  savings_1y_pct: null, savings_3y_pct: null, savings_1y_monthly: null, savings_3y_monthly: null,
  sql_addon_monthly: null, ahb_discount_monthly: null, storage_monthly: null,
  calculation_status: "calculated", is_variable_pricing: null, is_manual_cost: null,
  manual_monthly_cost: null, manual_cost_note: null, ri_applies: null,
  ri_not_applicable_reason: null, ri_coverage: null, ri_reservation_name: null, ri_term: null,
  ri_eligibility: null,
  power_running_hours: null, power_uptime_pct: null, power_period_start: null, power_period_end: null,
  calculation_notes: null, calculated_at: null, ...over,
});

const S = (over: Partial<Scenario>): Scenario => ({
  scenario_id: 1, number: 1, name: "Escenario", description: null,
  total_monthly: 0, total_annual: 0, savings_monthly: 0, savings_annual: 0, savings_pct: 0,
  config: { use_ri_1y: false, use_ri_3y: false, eliminate_stopped_vm_disks: false, eliminate_orphan_disks: false, eliminate_orphan_ips: false },
  calculated_at: null, breakdown: [], ...over,
});

describe("formatMoney", () => {
  test("formatea USD con 2 decimales", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50");
    expect(formatMoney(0)).toBe("$0.00");
  });
  test("nulo/vacío/no finito → '-'", () => {
    expect(formatMoney(null)).toBe("-");
    expect(formatMoney(undefined)).toBe("-");
    expect(formatMoney("")).toBe("-");
    expect(formatMoney("abc")).toBe("-");
  });
});

describe("formatPct", () => {
  test("fracción <= 1 se escala a porcentaje", () => {
    expect(formatPct(0.205)).toBe("20.5%");
  });
  test("valor > 1 se trata como porcentaje directo", () => {
    expect(formatPct(13.9)).toBe("13.9%");
  });
  test("<= 0 o no finito → '-'", () => {
    expect(formatPct(0)).toBe("-");
    expect(formatPct(-1)).toBe("-");
    expect(formatPct(null)).toBe("-");
  });
});

test("visibleServiceKey agrupa sql_vm bajo vms", () => {
  expect(visibleServiceKey("sql_vm")).toBe("vms");
  expect(visibleServiceKey("disks")).toBe("disks");
  expect(visibleServiceKey(null)).toBe("");
});

test("statusMeta conoce los estados y cae a un default legible", () => {
  expect(statusMeta("calculated").label).toBe("Calculado");
  expect(statusMeta("manual_required").label).toBe("Requiere costo manual");
  expect(statusMeta("desconocido").label).toBe("desconocido");
});

test("pricingKind distingue IA asistida / manual / exacto", () => {
  expect(pricingKind(R({ calculation_notes: "sku=X assist_match=1" }))).toBe("ai");
  expect(pricingKind(R({ calculation_status: "manual_required" }))).toBe("manual");
  expect(pricingKind(R({ calculation_status: "calculated" }))).toBe("exact");
  expect(pricingKind(R({ calculation_status: "not_applicable" }))).toBe("none");
});

test("riConfirmed sólo con cobertura confirmada", () => {
  expect(riConfirmed(R({ ri_coverage: "confirmed" }))).toBe(true);
  expect(riConfirmed(R({ ri_coverage: "estimated" }))).toBe(false);
  expect(riConfirmed(R({ ri_coverage: null }))).toBe(false);
});

test("power labels: horas redondeadas y uptime sin decimales; '-' si null", () => {
  expect(powerHoursLabel(R({ power_running_hours: 719.6 }))).toBe("720 h");
  expect(powerHoursLabel(R({ power_running_hours: null }))).toBe("-");
  expect(powerUptimeLabel(R({ power_uptime_pct: 99.7 }))).toBe("100%");
  expect(powerUptimeLabel(R({ power_uptime_pct: null }))).toBe("-");
});

test("rowPayg usa payg_monthly y cae a costo manual", () => {
  expect(rowPayg(R({ payg_monthly: 10 }))).toBe(10);
  expect(rowPayg(R({ payg_monthly: null, manual_monthly_cost: 7 }))).toBe(7);
  expect(rowPayg(R({ payg_monthly: null, manual_monthly_cost: null }))).toBe(0);
});

describe("translateNote", () => {
  test("App Service incluye sku y capacidad", () => {
    const note = translateNote(R({ service_key: "appservice", calculation_notes: "sku=P1V2 capacity=3" }));
    expect(note).toContain("P1V2");
    expect(note).toContain("3 instancia(s)");
  });
  test("public_ip huérfana lo indica", () => {
    expect(translateNote(R({ service_key: "public_ip", calculation_notes: "sku=Standard category=orphan" })))
      .toContain("sin recurso asociado");
  });
  test("sin nota cae a texto genérico", () => {
    expect(translateNote(R({ service_key: "cosmos", calculation_notes: null })))
      .toBe("Costo calculado con metadata importada desde Azure.");
  });
});

test("subscriptionNames únicos y ordenados, con marcador de faltante", () => {
  const rows = [R({ subscription_name: "B" }), R({ subscription_name: "A" }), R({ subscription_name: null }), R({ subscription_name: "A" })];
  expect(subscriptionNames(rows)).toEqual(["(sin suscripción)", "A", "B"]);
});

test("applySubscriptionFilter: null = todas; array filtra", () => {
  const rows = [R({ subscription_name: "A" }), R({ subscription_name: "B" })];
  expect(applySubscriptionFilter(rows, null)).toHaveLength(2);
  expect(applySubscriptionFilter(rows, ["A"])).toHaveLength(1);
});

describe("filterResults", () => {
  const rows = [
    R({ resource_id: 1, service_key: "vms", resource_name: "vm-prod", ri_coverage: "confirmed" }),
    R({ resource_id: 2, service_key: "disks", resource_name: "disk-01" }),
    R({ resource_id: 3, service_key: "sql_vm", resource_name: "sqlvm-01" }),
  ];
  test("buscador full-text por nombre de recurso", () => {
    expect(filterResults(rows, { q: "disk-01", serviceKey: "", hideReserved: false })).toHaveLength(1);
  });
  test("filtro por servicio usa la clave visible (sql_vm → vms)", () => {
    const r = filterResults(rows, { q: "", serviceKey: "vms", hideReserved: false });
    expect(r.map((x) => x.resource_id).sort()).toEqual([1, 3]);
  });
  test("ocultar reservados quita ri_coverage=confirmed", () => {
    expect(filterResults(rows, { q: "", serviceKey: "", hideReserved: true }).map((x) => x.resource_id)).toEqual([2, 3]);
  });
  it("filterResults con onlyRiEligible oculta no elegibles y reservados", () => {
    const rows = [
      { ri_1y_monthly: 10, ri_coverage: null } as CostResult,
      { ri_1y_monthly: null, ri_3y_monthly: null } as CostResult,
      { ri_1y_monthly: 10, ri_coverage: "confirmed" } as CostResult,
    ];
    const out = filterResults(rows, { q: "", serviceKey: "", hideReserved: false, onlyRiEligible: true });
    expect(out).toHaveLength(1);
  });
});

test("groupByService agrega payg, conteo e issues por servicio visible", () => {
  const rows = [
    R({ service_key: "vms", payg_monthly: 100, calculation_status: "calculated" }),
    R({ service_key: "sql_vm", payg_monthly: 50, calculation_status: "calculated" }),
    R({ service_key: "disks", payg_monthly: 10, calculation_status: "price_not_found" }),
  ];
  const groups = groupByService(rows);
  const vms = groups.find((g) => g.serviceKey === "vms")!;
  expect(vms.count).toBe(2); // vms + sql_vm
  expect(vms.payg).toBe(150);
  expect(vms.issues).toBe(0);
  const disks = groups.find((g) => g.serviceKey === "disks")!;
  expect(disks.issues).toBe(1); // price_not_found cuenta como "por revisar"
});

describe("computeKpis", () => {
  test("PAYG suma con fallback a manual; cuenta calculados y revisión", () => {
    const rows = [
      R({ payg_monthly: 100, calculation_status: "calculated" }),
      R({ payg_monthly: null, manual_monthly_cost: 20, calculation_status: "manual_required" }),
      R({ payg_monthly: 5, calculation_status: "variable_pricing" }),
    ];
    const k = computeKpis(rows, []);
    expect(k.payg).toBe(125);
    expect(k.resources).toBe(3);
    expect(k.calculated).toBe(1);
    expect(k.review).toBe(2);
    expect(k.best).toBeNull();
  });
  test("best = escenario con mayor ahorro mensual", () => {
    const k = computeKpis([], [S({ scenario_id: 1, savings_monthly: 100 }), S({ scenario_id: 2, savings_monthly: 300 })]);
    expect(k.best?.scenario_id).toBe(2);
  });
});

test("bestScenario devuelve null sin escenarios", () => {
  expect(bestScenario([])).toBeNull();
});
