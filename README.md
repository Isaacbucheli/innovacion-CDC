# Innovación CDC — Plataforma de Optimización y Mejoras (frontend)

Frontend React de la Plataforma CDC. SPA que consume la API .NET
([`optimizacion-costos-api-dotnet`](https://github.com/Isaacbucheli/optimizacion-costos-api-dotnet)),
el backend único de la plataforma.

Se despliega como **Azure Static Web App** (push a `main` → GitHub Actions). La URL del sitio y el
host de la API se administran fuera del repo (documentación privada del equipo); en el código la API
se resuelve vía `VITE_API_BASE_URL`. El login es contra `/auth/login` de la API (JWT); roles
`admin` / `consultor` / `lector`.

## Módulos

- **Matriz costos Azure:** Optimización de costos (matriz, escenarios de ahorro, cobertura RI, uptime, export Excel v3 con margen comercial), Oportunidades de Optimización (barrido del tenant), Catálogo de servicios.
- **Matriz mejoras Azure (WAF):** Recomendaciones por pilar, Validación inteligente (curación IA, admin), Historial de ingestas, Costo referencial Azure.
- **Informes:** Informe de gestión mensual.
- **Gestión CDC:** Reservas por vencer, Catálogo de alertas Azure Monitor + biblioteca KQL.
- **Administración** (admin): Clientes (alta, credenciales Azure — service principal o sesión de usuario vía Lighthouse —, suscripciones, logos), Usuarios y perfiles.

El catálogo navegable vive en [`src/lib/modules.ts`](src/lib/modules.ts) (espejo del menú).

## Stack

React 19 + TypeScript + Vite · Tailwind CSS + shadcn/ui (Radix) · TanStack Table ·
Recharts · react-hook-form + zod · sonner (toasts) · lucide + iconos oficiales de Azure ·
next-themes (claro/oscuro) · Vitest + Testing Library · oxlint.

## Scripts

```bash
npm run dev      # Vite con proxy /api → API .NET local (http://localhost:5169, override VITE_DEV_API_TARGET)
npm run test     # Vitest (199 tests)
npm run lint     # oxlint
npm run build    # tsc -b && vite build  ← ESTA es la verificación real
```

> ⚠️ **Verificar siempre con `npm run build`**, no con `tsc --noEmit`: el build de CI compila
> también los tests (`tsc -b`), y si el build falla en el SWA, Oryx sigue sirviendo el bundle
> viejo sin avisar.

En dev el proxy apunta al backend .NET **local** (con su BD de desarrollo); nunca a producción.

## Estructura

```
src/
  components/
    <modulo>/        # una carpeta por módulo: costs, waf, clients, credentials,
                     # alerts, optimization, reports, reservations, services, users
    ui/              # shadcn/ui (Button, Dialog, Table, ...)
    AppShell.tsx     # layout: menú lateral, marca, CommandPalette (Ctrl K), tema
    AuthGate.tsx     # sesión + login
  lib/               # api.ts (cliente HTTP único) + helpers por dominio, con tests .test.ts
  hooks/
  types.ts           # contratos de la API (snake_case)
```

## Convenciones de UI

- Paginación con `DataTablePagination`: 10 por página, opciones 10/20/50/100; tablas **sin scroll interno**.
- Acciones nuevas van al menú "Acciones"/"Opciones" del módulo, no como botón suelto en el header.
- Atajos con `Ctrl K` (Windows) vía CommandPalette.
- Brandbook BIT: Montserrat, tokens de marca, tema claro/oscuro.
- Iconos de servicios Azure: usar los oficiales embebidos (`lib/azureIcons.ts`) cuando existan.

## Deploy

Push a `main` → GitHub Actions (workflow del SWA) → build (`dist/`) y publicación (~1 min).
Cada deploy a producción requiere OK explícito.

**CSP** ([staticwebapp.config.json](staticwebapp.config.json)): `connect-src` debe listar el host de la API — si se cambia de backend y no se actualiza, el navegador bloquea todo con "Failed to fetch" aunque curl funcione. `img-src` incluye `blob:` (logos de cliente).
