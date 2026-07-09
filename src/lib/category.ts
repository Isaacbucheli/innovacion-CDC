// Normalización de la categoría de asignación de consultores (ALTO/MEDIO/BAJO),
// espejo conceptual de severity.ts y effect.ts. El badge muestra el texto original
// del campo; la clave normalizada solo decide colores, orden y peso de carga.

export type CategoryKey = "alto" | "medio" | "bajo" | "other";

export function normalizeCategory(raw: string | null): CategoryKey {
  const s = (raw ?? "").trim().toUpperCase();
  if (s.startsWith("ALT")) return "alto";
  if (s.startsWith("MED")) return "medio";
  if (s.startsWith("BAJ")) return "bajo";
  return "other"; // vacío o valores fuera de la escala
}

export const CATEGORY_META: Record<CategoryKey, { label: string; badge: string; accent: string }> = {
  alto: { label: "ALTO", badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200", accent: "#dc2626" },
  medio: { label: "MEDIO", badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200", accent: "#d97706" },
  bajo: { label: "BAJO", badge: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200", accent: "#16a34a" },
  other: { label: "—", badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200", accent: "#64748b" },
};

/** Orden para columnas TanStack: ALTO primero. */
export const CATEGORY_RANK: Record<CategoryKey, number> = { alto: 0, medio: 1, bajo: 2, other: 3 };
