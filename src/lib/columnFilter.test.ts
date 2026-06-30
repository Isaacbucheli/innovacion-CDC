import { expect, test } from "vitest";
import { evalColumnFilter, isFilterActive, emptyColumnFilter, type ColumnFilterValue } from "@/lib/columnFilter";

function fv(partial: Partial<ColumnFilterValue>): ColumnFilterValue {
  return { ...emptyColumnFilter(), ...partial };
}

test("filtro vacío no filtra (todo pasa)", () => {
  expect(evalColumnFilter("lo que sea", undefined)).toBe(true);
  expect(evalColumnFilter("lo que sea", emptyColumnFilter())).toBe(true);
});

test("operador contiene (case-insensitive)", () => {
  const f = fv({ a: { op: "contains", val: "mfa" } });
  expect(evalColumnFilter("Habilitar MFA", f)).toBe(true);
  expect(evalColumnFilter("Backups diarios", f)).toBe(false);
});

test("operador igual a (=) exacto", () => {
  const f = fv({ a: { op: "eq", val: "Alta" } });
  expect(evalColumnFilter("Alta", f)).toBe(true);
  expect(evalColumnFilter("Media", f)).toBe(false);
});

test("operadores empieza/termina y distinto", () => {
  expect(evalColumnFilter("2.13", fv({ a: { op: "starts", val: "2." } }))).toBe(true);
  expect(evalColumnFilter("2.13", fv({ a: { op: "ends", val: "13" } }))).toBe(true);
  expect(evalColumnFilter("Baja", fv({ a: { op: "ne", val: "Alta" } }))).toBe(true);
});

test("dos condiciones con conector Y", () => {
  const f = fv({ a: { op: "contains", val: "cuenta" }, conn: "and", b: { op: "contains", val: "invitado" } });
  expect(evalColumnFilter("Eliminar cuentas de invitado", f)).toBe(true);
  expect(evalColumnFilter("Eliminar cuentas locales", f)).toBe(false);
});

test("dos condiciones con conector O", () => {
  const f = fv({ a: { op: "eq", val: "Alta" }, conn: "or", b: { op: "eq", val: "Media" } });
  expect(evalColumnFilter("Alta", f)).toBe(true);
  expect(evalColumnFilter("Media", f)).toBe(true);
  expect(evalColumnFilter("Baja", f)).toBe(false);
});

test("isFilterActive detecta valores no vacíos", () => {
  expect(isFilterActive(undefined)).toBe(false);
  expect(isFilterActive(emptyColumnFilter())).toBe(false);
  expect(isFilterActive(fv({ a: { op: "contains", val: "x" } }))).toBe(true);
});
