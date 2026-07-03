import { severityKey } from "@/lib/severity";

test("mapea severidades en español a claves", () => {
  expect(severityKey("ALTA")).toBe("high");
  expect(severityKey("MEDIA")).toBe("medium");
  expect(severityKey("BAJA")).toBe("low");
  expect(severityKey("CRÍTICA")).toBe("critical");
  expect(severityKey("CRITICA")).toBe("critical");
  expect(severityKey("desconocida")).toBe("info");
  expect(severityKey(null)).toBe("info");
});

test("mapea severidades en inglés del backend de optimización", () => {
  expect(severityKey("high")).toBe("high");
  expect(severityKey("medium")).toBe("medium");
  expect(severityKey("low")).toBe("low");
});
