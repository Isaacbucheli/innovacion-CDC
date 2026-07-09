import { expect, test } from "vitest";
import { CATEGORY_META, normalizeCategory } from "@/lib/category";

test("normaliza ALTO/MEDIO/BAJO sin importar mayúsculas ni espacios", () => {
  expect(normalizeCategory("ALTO")).toBe("alto");
  expect(normalizeCategory("alto")).toBe("alto");
  expect(normalizeCategory(" Alto ")).toBe("alto");
  expect(normalizeCategory("MEDIO")).toBe("medio");
  expect(normalizeCategory("medio")).toBe("medio");
  expect(normalizeCategory("BAJO")).toBe("bajo");
  expect(normalizeCategory("Bajo")).toBe("bajo");
});

test("valores vacíos o fuera de la escala caen en other", () => {
  expect(normalizeCategory(null)).toBe("other");
  expect(normalizeCategory("")).toBe("other");
  expect(normalizeCategory("PENDIENTE")).toBe("other");
});

test("CATEGORY_META define badge y accent para todas las claves", () => {
  for (const key of ["alto", "medio", "bajo", "other"] as const) {
    expect(CATEGORY_META[key].badge).toBeTruthy();
    expect(CATEGORY_META[key].accent).toMatch(/^#/);
  }
  // Colores del spec: ALTO rojo, MEDIO ámbar, BAJO verde.
  expect(CATEGORY_META.alto.badge).toContain("red");
  expect(CATEGORY_META.medio.badge).toContain("amber");
  expect(CATEGORY_META.bajo.badge).toContain("green");
});
