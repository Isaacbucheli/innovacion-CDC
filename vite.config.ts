import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Endurecimiento de CSP: quitamos `style-src 'unsafe-inline'` (ver
// staticwebapp.config.template.json). Para lograrlo sin romper el comportamiento,
// dos librerías que inyectan <style> en runtime se redirigen a CSSOM (no gobernado
// por CSP): (1) `react-style-singleton` vía alias a un shim propio, y (2) `sonner`
// vía este plugin, que reescribe su `__insertCSS` en el build de producción.
function cspSafeSonner() {
  const anchor = "function __insertCSS(code) {";
  return {
    name: "csp-safe-sonner",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!/sonner[\\/]dist[\\/]index\.(mjs|js)$/.test(id)) return null;
      if (!code.includes(anchor)) {
        throw new Error(
          "[csp-safe-sonner] No se encontró __insertCSS en sonner. " +
            "Probablemente subió de versión: revisa el parche CSP-safe antes de continuar.",
        );
      }
      const patched = code.replace(
        /function __insertCSS\(code\)\s*\{[\s\S]*?\n\}/,
        `function __insertCSS(code) {
  if (!code || typeof document === 'undefined') return;
  try {
    if (typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype && 'adoptedStyleSheets' in document) {
      var __s = new CSSStyleSheet();
      __s.replaceSync(code);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, __s];
      return;
    }
  } catch (e) { /* cae al fallback */ }
  var head = document.head || document.getElementsByTagName('head')[0];
  var style = document.createElement('style');
  head.appendChild(style);
  style.appendChild(document.createTextNode(code));
}`,
      );
      if (patched === code) {
        throw new Error(
          "[csp-safe-sonner] El patrón de __insertCSS cambió y no se pudo parchear. Revisa el plugin.",
        );
      }
      return { code: patched, map: null };
    },
  };
}

export default defineConfig({
  plugins: [cspSafeSonner(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // CSP: inyección de estilos vía CSSOM en lugar de <style> (ver shim).
      "react-style-singleton": path.resolve(__dirname, "./src/shims/react-style-singleton.ts"),
    },
  },
  server: {
    proxy: {
      // Backend ÚNICO en .NET. DEV apunta al .NET LOCAL (con su BD de desarrollo) — NUNCA a producción.
      // Override con VITE_DEV_API_TARGET si el backend local corre en otro puerto.
      "/api": {
        target: process.env.VITE_DEV_API_TARGET || "http://localhost:5169",
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    passWithNoTests: true,
    // Los tests de render de páginas pesadas (lazy-import + jsdom) completan de sobra
    // en aislamiento, pero bajo contención de workers en paralelo el arranque de jsdom
    // los empujaba más allá del default de 5s → timeouts intermitentes. 20s da margen
    // sin ocultar un cuelgue real (una prueba colgada agota igual el límite).
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
