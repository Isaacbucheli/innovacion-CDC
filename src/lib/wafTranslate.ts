import { translateWafTexts } from "@/lib/api";

// Cache en memoria de sesión (es→en). NO se persiste: se pierde al recargar.
const cache = new Map<string, string>();

export function clearTranslationCache(): void {
  cache.clear();
}

// Traduce al inglés un conjunto de textos. Deduplica, omite vacíos y reusa el cache.
// Devuelve un Map textoEs → textoEn (solo para los textos no vacíos).
export async function translateToEnglish(texts: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(texts.map((t) => t ?? "").filter((t) => t.trim() !== ""))];
  const missing = uniq.filter((t) => !cache.has(t));
  if (missing.length > 0) {
    const res = await translateWafTexts(missing.map((text, i) => ({ key: String(i), text })));
    const byKey = new Map(res.map((r) => [r.key, r.text]));
    missing.forEach((src, i) => cache.set(src, byKey.get(String(i)) ?? src));
  }
  const out = new Map<string, string>();
  for (const t of texts) {
    const s = t ?? "";
    if (s.trim() !== "") out.set(s, cache.get(s) ?? s);
  }
  return out;
}
