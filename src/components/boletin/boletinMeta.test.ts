import { expect, test } from "vitest";
import {
  groupTexts, htmlToText, novedadDescripcion, novedadTitle, NOVEDAD_CATEGORIA_META, SOURCE_LABEL,
} from "@/components/boletin/boletinMeta";
import type { BoletinGroup, NovedadCliente } from "@/types";

test("SOURCE_LABEL cubre la fuente eol", () => {
  expect(SOURCE_LABEL.eol).toBe("Catálogo BIT");
});

test("NOVEDAD_CATEGORIA_META cubre las 4 categorías BIT con label e icono", () => {
  expect(Object.keys(NOVEDAD_CATEGORIA_META)).toEqual([
    "productividad_ia", "seguridad_identidad", "resiliencia_plataforma", "costo_operacion",
  ]);
  expect(NOVEDAD_CATEGORIA_META.productividad_ia.label).toBe("Productividad e IA");
  expect(NOVEDAD_CATEGORIA_META.seguridad_identidad.label).toBe("Seguridad e identidad");
  expect(NOVEDAD_CATEGORIA_META.resiliencia_plataforma.label).toBe("Resiliencia y plataforma");
  expect(NOVEDAD_CATEGORIA_META.costo_operacion.label).toBe("Costo y operación");
  for (const meta of Object.values(NOVEDAD_CATEGORIA_META)) expect(meta.icon).toBeDefined();
});

const novedadBase: NovedadCliente = {
  id: 1, novedad_id: 10, titulo: "New feature", titulo_es: "Nueva funcionalidad",
  descripcion: "English description", descripcion_es: "Descripción en español",
  link: "https://example.test/x", estado_feed: "launched", categoria_bit: "productividad_ia",
  published_at: "2026-07-20T17:00:00Z", por_que: "Le ahorra tiempo al cliente.", estado: "pendiente",
  recursos: null, decidido_por: null, decidido_at: null,
};

test("novedadTitle/novedadDescripcion muestran español por defecto y caen al EN si falta traducción", () => {
  expect(novedadTitle(novedadBase, false)).toBe("Nueva funcionalidad");
  expect(novedadDescripcion(novedadBase, false)).toBe("Descripción en español");
  expect(novedadTitle({ ...novedadBase, titulo_es: null }, false)).toBe("New feature");
});

test("novedadTitle/novedadDescripcion en modo inglés muestran el original del feed", () => {
  expect(novedadTitle(novedadBase, true)).toBe("New feature");
  expect(novedadDescripcion(novedadBase, true)).toBe("English description");
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
