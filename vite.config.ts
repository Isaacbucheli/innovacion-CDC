import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    proxy: {
      "/api": {
        target: "https://app-optimizacion-costos-api.azurewebsites.net",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
      // Catálogo de alertas: backend .NET (migración estranguladora).
      "/dotnet-api": {
        target: "https://app-optimizacion-costos-api-dotnet.azurewebsites.net",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/dotnet-api/, ""),
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    passWithNoTests: true,
  },
});
