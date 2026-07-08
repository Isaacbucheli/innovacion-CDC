import { describe, expect, test } from "vitest";
import { checkMeta, computeKpis, groupFindings, savingsByGroup, sortBySavings } from "@/lib/optimization";
import type { OptFinding } from "@/types";

const F = (over: Partial<OptFinding>): OptFinding => ({
  check_id: "orphaned_disks",
  category: "cost_waste",
  severity: "medium",
  subscription_id: "sub",
  azure_resource_id: "/id",
  resource_name: "r",
  resource_type: "t",
  region: "eastus2",
  details: {},
  estimated_monthly_savings: null,
  currency: "USD",
  fingerprint: "ab",
  state: "abierto",
  notes: null,
  ...over,
});

describe("checkMeta", () => {
  test("mapea checks conocidos a sección y grupo", () => {
    expect(checkMeta("vms_without_ahb")).toMatchObject({ section: "rate", group: "ahb" });
    expect(checkMeta("orphaned_disks")).toMatchObject({ section: "usage", group: "storage" });
    expect(checkMeta("orphaned_public_ips")).toMatchObject({ section: "usage", group: "networking" });
    expect(checkMeta("stopped_not_deallocated_vms")).toMatchObject({ section: "usage", group: "compute" });
  });
  test("check desconocido cae a usage/other con el id como título", () => {
    expect(checkMeta("nuevo_check")).toEqual({ title: "nuevo_check", section: "usage", group: "other" });
  });
});

describe("sortBySavings", () => {
  test("ordena descendente con nulls al final, sin mutar", () => {
    const input = [F({ estimated_monthly_savings: 10 }), F({ estimated_monthly_savings: null }), F({ estimated_monthly_savings: 50 })];
    const sorted = sortBySavings(input);
    expect(sorted.map((f) => f.estimated_monthly_savings)).toEqual([50, 10, null]);
    expect(input[0].estimated_monthly_savings).toBe(10); // no mutó
  });
});

describe("groupFindings", () => {
  test("Rate va antes que Usage; grupos ordenados; solo no vacíos; subtotales correctos", () => {
    const findings = [
      F({ check_id: "vms_without_ahb", estimated_monthly_savings: 100 }),
      F({ check_id: "orphaned_disks", estimated_monthly_savings: 40 }),
      F({ check_id: "old_snapshots", estimated_monthly_savings: 10 }),
      F({ check_id: "stopped_not_deallocated_vms", estimated_monthly_savings: 200 }),
      F({ check_id: "orphaned_nics", estimated_monthly_savings: null }),
    ];
    const secs = groupFindings(findings);
    expect(secs.map((s) => s.section)).toEqual(["rate", "usage"]);

    const usage = secs[1];
    // orden de grupos: compute, storage, networking
    expect(usage.groups.map((g) => g.group)).toEqual(["compute", "storage", "networking"]);
    const storage = usage.groups.find((g) => g.group === "storage")!;
    expect(storage.savings).toBe(50); // 40 + 10
    expect(storage.count).toBe(2);
    expect(usage.count).toBe(4); // 1 compute + 2 storage + 1 networking
    expect(usage.savings).toBe(250); // 200 + 50 + 0

    expect(secs[0].savings).toBe(100); // rate = AHB
  });

  test("sin findings devuelve arreglo vacío", () => {
    expect(groupFindings([])).toEqual([]);
  });
});

describe("savingsByGroup", () => {
  test("agrega ahorro por grupo y omite los que no ahorran", () => {
    const slices = savingsByGroup([
      F({ check_id: "vms_without_ahb", estimated_monthly_savings: 100 }),
      F({ check_id: "orphaned_disks", estimated_monthly_savings: 40 }),
      F({ check_id: "orphaned_nics", estimated_monthly_savings: null }), // networking sin ahorro → excluido
    ]);
    expect(slices.map((s) => s.group)).toEqual(["ahb", "storage"]);
    expect(slices.find((s) => s.group === "ahb")!.savings).toBe(100);
  });
});

describe("computeKpis", () => {
  test("suma ahorro y cuenta por severidad", () => {
    const k = computeKpis([
      F({ severity: "high", estimated_monthly_savings: 200 }),
      F({ severity: "medium", estimated_monthly_savings: 50 }),
      F({ severity: "low", estimated_monthly_savings: null }),
      F({ severity: "medium", estimated_monthly_savings: 25 }),
    ]);
    expect(k.totalSavings).toBe(275);
    expect(k.count).toBe(4);
    expect(k.severity).toEqual({ high: 1, medium: 2, low: 1 });
  });
});

import { optimizationExcelFileName, STATE_ORDER } from "@/lib/optimization";

test("nombre del excel: slug del cliente + fecha del barrido", () => {
  expect(optimizationExcelFileName("Banco Delta", "2026-07-03T14:00:00Z"))
    .toBe("oportunidades-optimizacion-Banco-Delta-20260703.xlsx");
  expect(optimizationExcelFileName("A/B:C", "")).toBe("oportunidades-optimizacion-A-B-C-export.xlsx");
});

test("STATE_ORDER cubre los 4 estados en orden", () => {
  expect(STATE_ORDER).toEqual(["abierto", "en_progreso", "resuelto", "ignorado"]);
});
