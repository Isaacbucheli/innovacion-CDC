import { expect, test } from "vitest";
import { applyPerm, buildSavePayload, scrubEdits, toMap, toRows } from "@/components/users/ModulePermissionsPanel";
import type { ModuleDef, ModulePermissionRow } from "@/lib/api";

const modules: ModuleDef[] = [
  { key: "alerts", label: "Alertas", group: "Monitoreo" },
  { key: "costos", label: "Costos", group: "Finanzas" },
  { key: "policies", label: "Políticas", group: "Gobierno" },
];

test("toRows emite TODOS los módulos del catálogo, incluso los ausentes del mapa", () => {
  const map = { alerts: { can_view: true, can_edit: false } };
  const rows = toRows(map, modules);
  expect(rows).toEqual([
    { module_key: "alerts", can_view: true, can_edit: false },
    { module_key: "costos", can_view: false, can_edit: false },
    { module_key: "policies", can_view: false, can_edit: false },
  ]);
});

test("toRows preserva los valores de las claves presentes", () => {
  const map = {
    alerts: { can_view: true, can_edit: true },
    costos: { can_view: true, can_edit: false },
    policies: { can_view: false, can_edit: false },
  };
  const rows = toRows(map, modules);
  expect(rows).toEqual([
    { module_key: "alerts", can_view: true, can_edit: true },
    { module_key: "costos", can_view: true, can_edit: false },
    { module_key: "policies", can_view: false, can_edit: false },
  ]);
});

test("scrubEdits del lector: un can_edit:true llega en false por el camino de lector", () => {
  const rowsFromGet: ModulePermissionRow[] = [
    { module_key: "alerts", can_view: true, can_edit: true }, // obsoleto: no debería sobrevivir
  ];
  const lectorMap = scrubEdits(toMap(rowsFromGet));
  expect(lectorMap.alerts).toEqual({ can_view: true, can_edit: false });

  // Y tampoco puede colarse de vuelta en el payload de guardado.
  const rows = toRows(scrubEdits(lectorMap), modules);
  const alertsRow = rows.find((r) => r.module_key === "alerts");
  expect(alertsRow?.can_edit).toBe(false);
});

test("applyPerm: marcar editar activa ver", () => {
  const cur = { can_view: false, can_edit: false };
  expect(applyPerm(cur, "can_edit", true)).toEqual({ can_view: true, can_edit: true });
});

test("applyPerm: desmarcar ver desactiva editar", () => {
  const cur = { can_view: true, can_edit: true };
  expect(applyPerm(cur, "can_view", false)).toEqual({ can_view: false, can_edit: false });
});

test("buildSavePayload viaja con los tres roles y scrubbea lector y monitoreo", () => {
  const map = { alerts: { can_view: true, can_edit: true } };
  const payload = buildSavePayload(map, map, map, modules);
  expect(Object.keys(payload)).toEqual(["consultor", "lector", "monitoreo"]);
  expect(payload.consultor.find((r) => r.module_key === "alerts")?.can_edit).toBe(true);
  expect(payload.lector.find((r) => r.module_key === "alerts")?.can_edit).toBe(false);
  expect(payload.monitoreo.find((r) => r.module_key === "alerts")?.can_edit).toBe(false);
});

test("applyPerm: toggles simples de ver/editar pasan sin efectos colaterales", () => {
  const cur = { can_view: false, can_edit: false };
  expect(applyPerm(cur, "can_view", true)).toEqual({ can_view: true, can_edit: false });

  const cur2 = { can_view: true, can_edit: true };
  expect(applyPerm(cur2, "can_edit", false)).toEqual({ can_view: true, can_edit: false });
});
