import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
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
