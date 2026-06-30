// Filtro avanzado por columna estilo Aranda: dos condiciones (operador + valor)
// combinadas con un conector lógico Y/O. Vacío = condición inactiva (no filtra).

export type FilterOp = "contains" | "not_contains" | "eq" | "ne" | "starts" | "ends";
export type Connector = "and" | "or";

export interface Condition { op: FilterOp; val: string }
export interface ColumnFilterValue { a: Condition; conn: Connector; b: Condition }

export const FILTER_OPERATORS: { value: FilterOp; label: string }[] = [
  { value: "contains", label: "contiene" },
  { value: "not_contains", label: "no contiene" },
  { value: "eq", label: "igual a (=)" },
  { value: "ne", label: "distinto de (≠)" },
  { value: "starts", label: "empieza con" },
  { value: "ends", label: "termina con" },
];

export function emptyColumnFilter(): ColumnFilterValue {
  return { a: { op: "contains", val: "" }, conn: "and", b: { op: "contains", val: "" } };
}

export function isFilterActive(fv: ColumnFilterValue | undefined): boolean {
  return !!fv && (fv.a.val.trim() !== "" || fv.b.val.trim() !== "");
}

function matchOne(text: string, op: FilterOp, val: string): boolean {
  const t = text.toLowerCase();
  const v = val.trim().toLowerCase();
  switch (op) {
    case "contains": return t.includes(v);
    case "not_contains": return !t.includes(v);
    case "eq": return t === v;
    case "ne": return t !== v;
    case "starts": return t.startsWith(v);
    case "ends": return t.endsWith(v);
    default: return true;
  }
}

// Evalúa una fila (su texto ya extraído) contra el valor de filtro de la columna.
export function evalColumnFilter(text: string, fv: ColumnFilterValue | undefined): boolean {
  if (!fv) return true;
  const aActive = fv.a.val.trim() !== "";
  const bActive = fv.b.val.trim() !== "";
  if (!aActive && !bActive) return true;
  if (aActive && !bActive) return matchOne(text, fv.a.op, fv.a.val);
  if (!aActive && bActive) return matchOne(text, fv.b.op, fv.b.val);
  const mA = matchOne(text, fv.a.op, fv.a.val);
  const mB = matchOne(text, fv.b.op, fv.b.val);
  return fv.conn === "or" ? mA || mB : mA && mB;
}
