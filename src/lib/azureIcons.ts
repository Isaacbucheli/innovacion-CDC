// Iconos oficiales de Azure incrustados en el bundle como data URIs, en vez de
// servirse como ~27 archivos .svg sueltos desde /assets/azure-icons/. Motivo: el SWA
// los devolvía con cache de 30s y algunas peticiones se atascaban (hasta ~60s), así
// que en cada navegación se veía "cargar" los iconos. Al incrustarlos, viajan dentro
// del JS (hasheado y cacheado a largo plazo) → cero peticiones por icono, carga instantánea.
// La CSP del SWA permite `img-src 'self' data:`, así que las data URIs funcionan.

const raws = import.meta.glob("../assets/azure-icons/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const MAP: Record<string, string> = {};
for (const [path, raw] of Object.entries(raws)) {
  const name = path.split("/").pop()!.replace(".svg", "");
  // encodeURIComponent escapa el '#' de los colores (p. ej. fill="#A3C243"), que rompería la data URI.
  MAP[name] = `data:image/svg+xml,${encodeURIComponent(raw)}`;
}

/** Data URI del icono Azure por nombre (sin extensión). Fallback: "resources". */
export function azIcon(name: string): string {
  return MAP[name] ?? MAP["resources"] ?? "";
}
