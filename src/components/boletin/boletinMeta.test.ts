import { expect, test } from "vitest";
import { htmlToText } from "@/components/boletin/boletinMeta";

test("aplana HTML con tags y entidades a texto plano de una sola línea", () => {
  const html = "<p>Este servicio se <b>retira</b>&nbsp;el&nbsp;próximo trimestre.</p>\n<p>Migra a la v2.</p>";
  expect(htmlToText(html)).toBe("Este servicio se retira el próximo trimestre. Migra a la v2.");
});

test("null o vacío devuelve cadena vacía", () => {
  expect(htmlToText(null)).toBe("");
  expect(htmlToText("")).toBe("");
});
