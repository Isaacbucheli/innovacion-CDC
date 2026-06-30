import { expect, test } from "vitest";
import { vmStatusCounts, osCounts, healthCounts, parsePct, slaAverage, perfAverages, isWindows, isRunning } from "@/lib/report";
import type { ReportVmInventory, ReportPerfVm } from "@/types";

const vm = (status: string, os: string): ReportVmInventory => ({
  name: "vm", ip: null, status, os, size: "", vcpu: 1, ram_gb: 1, disks: 0, has_backup: false,
});

test("clasifica SO y estado", () => {
  expect(isWindows("Windows Server 2019")).toBe(true);
  expect(isWindows("Linux")).toBe(false);
  expect(isRunning("Running")).toBe(true);
  expect(isRunning("Stopped (deallocated)")).toBe(false);
});

test("cuenta VMs por estado y SO", () => {
  const inv = [vm("Running", "Windows"), vm("Running", "Linux"), vm("Stopped (deallocated)", "Linux")];
  expect(vmStatusCounts(inv)).toEqual({ running: 2, stopped: 1 });
  expect(osCounts(inv)).toEqual({ windows: 1, linux: 2 });
});

test("suma salud de recursos", () => {
  expect(healthCounts([
    { tipo: "a", total: 10, disponibles: 9, con_alerta: 1 },
    { tipo: "b", total: 5, disponibles: 5, con_alerta: 0 },
  ])).toEqual({ disponibles: 14, con_alerta: 1 });
  expect(healthCounts(undefined)).toEqual({ disponibles: 0, con_alerta: 0 });
});

test("parsePct y slaAverage", () => {
  expect(parsePct("100%")).toBe(100);
  expect(parsePct("99.5%")).toBe(99.5);
  expect(parsePct(88)).toBe(88);
  expect(slaAverage([
    { servicio: "a", acordado_h: 744, caidas_h: 0, disponibilidad: "100%" },
    { servicio: "b", acordado_h: 744, caidas_h: 7, disponibilidad: "99%" },
  ])).toBe(100); // (100+99)/2 = 99.5 → 100
  expect(slaAverage([])).toBe(0);
});

test("perfAverages redondea CPU y RAM", () => {
  const vms: ReportPerfVm[] = [
    { resource_name: "a", cpu_avg: 20, cpu_max: 0, ram_avg: 50, ram_max: 0 },
    { resource_name: "b", cpu_avg: 41, cpu_max: 0, ram_avg: 51, ram_max: 0 },
  ];
  expect(perfAverages(vms)).toEqual({ cpu: 31, ram: 51 }); // 30.5→31, 50.5→51
  expect(perfAverages([])).toEqual({ cpu: 0, ram: 0 });
});
