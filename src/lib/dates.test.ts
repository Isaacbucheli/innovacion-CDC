import { describe, expect, it } from "vitest";
import { fmtDate, fmtDateISO, fmtDateOnly, fmtDateTime, parseApiDate } from "@/lib/dates";

describe("parseApiDate", () => {
  it("asume UTC cuando el string trae hora pero no zona (respuestas del API sin 'Z')", () => {
    // La corrida 87 real: la BD guarda 15:29:40 UTC y el API viejo lo mandaba sin zona.
    expect(parseApiDate("2026-07-31T15:29:40")?.getTime())
      .toBe(new Date("2026-07-31T15:29:40Z").getTime());
  });

  it("respeta la zona cuando viene explícita", () => {
    expect(parseApiDate("2026-07-31T15:29:40Z")?.getTime())
      .toBe(new Date("2026-07-31T15:29:40Z").getTime());
    expect(parseApiDate("2026-07-31T10:29:40-05:00")?.getTime())
      .toBe(new Date("2026-07-31T15:29:40Z").getTime());
  });

  it("devuelve null para vacío o inválido", () => {
    expect(parseApiDate(null)).toBeNull();
    expect(parseApiDate("")).toBeNull();
    expect(parseApiDate("no-fecha")).toBeNull();
  });
});

describe("fmtDateTime / fmtDate (hora de Quito)", () => {
  it("convierte 15:29 UTC a 10:29 de Quito", () => {
    const s = fmtDateTime("2026-07-31T15:29:40Z");
    expect(s).toContain("31/7/2026");
    expect(s).toContain("10:29:40");
  });

  it("cruza al día anterior cuando en UTC ya es el día siguiente", () => {
    // 01:00 UTC del 1/8 = 20:00 del 31/7 en Quito.
    expect(fmtDate("2026-08-01T01:00:00Z")).toBe("31/7/2026");
  });

  it("muestra — para null", () => {
    expect(fmtDateTime(null)).toBe("—");
    expect(fmtDate(undefined)).toBe("—");
  });
});

describe("fmtDateISO", () => {
  it("da la fecha de Quito en yyyy-MM-dd", () => {
    expect(fmtDateISO("2026-08-01T01:00:00Z")).toBe("2026-07-31");
    expect(fmtDateISO("2026-07-31T15:29:40Z")).toBe("2026-07-31");
  });
});

describe("fmtDateOnly (fechas calendario, sin desplazar por zona)", () => {
  it("no mueve al día anterior una fecha pura", () => {
    expect(fmtDateOnly("2026-07-15")).toBe("15/7/2026");
    expect(fmtDateOnly("2026-07-15T00:00:00Z")).toBe("15/7/2026");
  });

  it("muestra — para null", () => {
    expect(fmtDateOnly(null)).toBe("—");
  });
});
