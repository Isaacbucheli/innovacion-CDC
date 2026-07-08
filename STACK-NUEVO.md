# Stack (front React) — configuración de entorno

> Este front y la API .NET
> ([`optimizacion-costos-api-dotnet`](https://github.com/Isaacbucheli/optimizacion-costos-api-dotnet))
> SON la plataforma. Los **nombres y URLs concretos** (SWA, host de la API, BD) se administran
> **fuera del repo** (documentación privada del equipo). El repo es público — no escribirlos aquí.

## Cómo apunta el front al backend

- **DEV:** proxy de Vite `/api` → `http://localhost:5169` (la API .NET local, con su BD de desarrollo).
  Override: `VITE_DEV_API_TARGET=<url>`.
- **PROD:** `VITE_API_BASE_URL` = URL de la API .NET (con fallback en `src/lib/api.ts`).
  Nunca apuntar a otro backend que no sea el de la plataforma.

## CSP (`staticwebapp.config.json`)

- `connect-src` debe listar el host de la API — sin esto el navegador bloquea las llamadas con
  "Failed to fetch" aunque curl funcione (lección aprendida).
- `img-src` incluye `blob:` (los logos de cliente se renderizan desde objectURL).

## CORS

El `CORS_ORIGINS` de la API debe incluir el origen de este SWA.
