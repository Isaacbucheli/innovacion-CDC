// Genera staticwebapp.config.json desde staticwebapp.config.template.json (R2).
//
// Fuente ÚNICA del host de la API: VITE_API_BASE_URL, tomada de:
//   1) process.env.VITE_API_BASE_URL  (permite inyectarla desde el workflow -> migración futura a "Opción B")
//   2) .env.production                 (fuente por defecto commiteada en el repo)
//
// El CSP es un archivo estático que sirve Azure SWA: el navegador necesita el host literal en
// connect-src, no puede leer variables en runtime. Por eso el host se inyecta aquí en el build
// (npm ejecuta este script como "prebuild" antes de "build") en vez de duplicarlo en src/lib/api.ts.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function fromEnvFile(name) {
  const path = join(root, name);
  if (!existsSync(path)) return undefined;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*VITE_API_BASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  }
  return undefined;
}

const host = process.env.VITE_API_BASE_URL || fromEnvFile(".env.production");
if (!host) {
  console.error(
    "[gen-swa-config] VITE_API_BASE_URL no está definido (ni en el entorno ni en .env.production). " +
      "No se puede generar el CSP; abortando el build.",
  );
  process.exit(1);
}

const template = readFileSync(join(root, "staticwebapp.config.template.json"), "utf8");
const out = template.replace(/__API_BASE_URL__/g, host);
JSON.parse(out); // valida que el resultado sea JSON bien formado antes de escribir
writeFileSync(join(root, "staticwebapp.config.json"), out);
console.log(`[gen-swa-config] staticwebapp.config.json generado con connect-src -> ${host}`);
