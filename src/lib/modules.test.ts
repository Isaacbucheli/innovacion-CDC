import { describe, expect, it } from "vitest";
import { MODULE_GROUPS } from "./modules";

const claves = () => MODULE_GROUPS.flatMap((g) => g.items.map((i) => i.key));

describe("MODULE_GROUPS", () => {
  it("incluye el informe de valor en el grupo Informes", () => {
    const informes = MODULE_GROUPS.find((g) => g.group === "Informes");
    expect(informes).toBeDefined();
    expect(informes!.items.map((i) => i.key)).toContain("informe-valor");
  });

  it("no tiene claves repetidas", () => {
    const k = claves();
    expect(new Set(k).size).toBe(k.length);
  });
});
