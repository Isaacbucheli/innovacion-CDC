# Stack nuevo (front React) — configuración de destino

> **Regla:** el front nuevo habla SOLO con el backend .NET del stack nuevo. NUNCA con el antiguo
> (FastAPI de prod ni el .NET que está sobre la BD de prod).

## Identidad
- **SWA del stack nuevo:** **`swa-optimizacion-costos-frontend`**.
- **Backend:** .NET único (B1–B8), conectado a **`sqldb-optimizacion-costos-valida`**
  (ver `optimizacion-costos-api-dotnet/STACK-NUEVO.md`).

## Cómo apunta el front al backend
- **DEV:** proxy de Vite `/api` → `http://localhost:5169` (el .NET local, que usa `-valida`).
  Override: `VITE_DEV_API_TARGET=<url>`.
- **PROD:** `VITE_API_BASE_URL` = URL del backend .NET del stack nuevo (la fija la tarea I).
  **No hay fallback a prod**: si no se setea, las llamadas van al propio origen y fallan (no a prod).

## CSP (staticwebapp.config.json)
- `connect-src` hoy está en `'self'` (se quitaron los hosts de prod).
- **Tarea I:** agregar el host del backend .NET nuevo a `connect-src` (sin esto el navegador bloquea
  las llamadas — lección aprendida del piloto). NUNCA volver a listar los backends de prod.

## Pendiente de la tarea I (requiere OK del usuario)
- Provisionar el SWA `swa-optimizacion-costos-frontend` + su `VITE_API_BASE_URL`.
- Completar `connect-src` con el backend nuevo.
- CORS del backend .NET debe incluir el origen del SWA nuevo.
