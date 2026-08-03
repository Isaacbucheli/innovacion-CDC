import { expect, test } from "vitest";
import { groupTexts, htmlToText, SOURCE_LABEL } from "@/components/boletin/boletinMeta";
import type { BoletinGroup } from "@/types";

test("SOURCE_LABEL cubre la fuente eol", () => {
  expect(SOURCE_LABEL.eol).toBe("Catálogo BIT");
});

test("aplana HTML con tags y entidades a texto plano de una sola línea", () => {
  const html = "<p>Este servicio se <b>retira</b>&nbsp;el&nbsp;próximo trimestre.</p>\n<p>Migra a la v2.</p>";
  expect(htmlToText(html)).toBe("Este servicio se retira el próximo trimestre. Migra a la v2.");
});

test("null o vacío devuelve cadena vacía", () => {
  expect(htmlToText(null)).toBe("");
  expect(htmlToText("")).toBe("");
});

const base: BoletinGroup = {
  source: "advisor", announcement_key: "k", title: "Support ends", retiring_feature: "F",
  retirement_date: null, urgency: "sin_fecha", recommended_action: "Migrate", learn_more_url: null,
  summary: null, resource_count: 0, derived_resource_count: 0, subscription_ids: [], resources: [],
  title_es: "El soporte termina", summary_es: null, recommended_action_es: "Migra",
};

test("groupTexts muestra español por defecto y cae al EN si falta traducción", () => {
  expect(groupTexts(base, false).title).toBe("El soporte termina");
  expect(groupTexts(base, false).action).toBe("Migra");
  expect(groupTexts({ ...base, title_es: null }, false).title).toBe("Support ends");
});

test("groupTexts en modo inglés muestra el original de Azure", () => {
  expect(groupTexts(base, true).title).toBe("Support ends");
  expect(groupTexts(base, true).action).toBe("Migrate");
});
