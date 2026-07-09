import { EFFECT_META, normalizeEffect } from "@/lib/effect";

test("normaliza los efectos del Excel a claves", () => {
  expect(normalizeEffect("Deny")).toBe("deny");
  expect(normalizeEffect("Modify")).toBe("modify");
  expect(normalizeEffect("Audit")).toBe("audit");
  expect(normalizeEffect("DeployIfNotExists")).toBe("other");
  expect(normalizeEffect("")).toBe("other");
  expect(normalizeEffect(null)).toBe("other");
});

test("'Deny o Audit' colorea como deny (deny tiene precedencia)", () => {
  expect(normalizeEffect("Deny o Audit")).toBe("deny");
  expect(normalizeEffect("deny o audit")).toBe("deny");
});

test("cada efecto tiene meta con badge y accent", () => {
  for (const key of ["deny", "modify", "audit", "other"] as const) {
    expect(EFFECT_META[key].badge).toBeTruthy();
    expect(EFFECT_META[key].accent).toMatch(/^#/);
  }
});
