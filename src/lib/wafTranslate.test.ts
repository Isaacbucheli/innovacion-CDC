import { beforeEach, expect, test, vi } from "vitest";
import { translateToEnglish, clearTranslationCache } from "@/lib/wafTranslate";
import { translateWafTexts } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  translateWafTexts: vi.fn(),
}));

const mock = translateWafTexts as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  clearTranslationCache();
  mock.mockReset();
});

test("deduplica textos y omite vacíos en una sola llamada", async () => {
  mock.mockResolvedValueOnce([{ key: "0", text: "Hello" }, { key: "1", text: "World" }]);
  const map = await translateToEnglish(["Hola", "Hola", "Mundo", "   "]);
  expect(mock).toHaveBeenCalledTimes(1);
  expect(mock).toHaveBeenCalledWith([{ key: "0", text: "Hola" }, { key: "1", text: "Mundo" }]);
  expect(map.get("Hola")).toBe("Hello");
  expect(map.get("Mundo")).toBe("World");
});

test("usa el cache y no vuelve a pedir lo ya traducido", async () => {
  mock.mockResolvedValueOnce([{ key: "0", text: "Hello" }]);
  await translateToEnglish(["Hola"]);
  const map = await translateToEnglish(["Hola"]);
  expect(mock).toHaveBeenCalledTimes(1); // segunda vez: cache
  expect(map.get("Hola")).toBe("Hello");
});
